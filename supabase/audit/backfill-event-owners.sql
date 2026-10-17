-- ADMIN ONLY, AFTER the migration. Fill only independently confirmed mappings.
-- Default is a dry run: leave ROLLBACK until the preview and counts are approved.
-- Never derive ownership from club, event name, the current login, or the first user.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='120s';

CREATE TEMP TABLE event_owner_map (
  event_id uuid PRIMARY KEY,
  owner_id uuid NOT NULL,
  evidence text NOT NULL CHECK (length(btrim(evidence))>0)
) ON COMMIT DROP;

-- INSERT CONFIRMED MAPPINGS HERE
-- INSERT INTO event_owner_map(event_id,owner_id,evidence) VALUES
-- ('confirmed-event-uuid','confirmed-auth-user-uuid','Reference to confirmed ownership');

LOCK TABLE public.shooting_events IN SHARE ROW EXCLUSIVE MODE;

SELECT e.id,e.name,e.event_date,e.owner_id AS previous_owner,
       m.owner_id AS confirmed_owner,m.evidence
FROM event_owner_map m JOIN public.shooting_events e ON e.id=m.event_id
ORDER BY e.event_date,e.id;

DO $backfill$
DECLARE expected bigint; changed bigint;
BEGIN
  SELECT count(*) INTO expected FROM event_owner_map;
  IF expected=0 THEN RAISE EXCEPTION 'No confirmed mappings supplied'; END IF;
  IF EXISTS(SELECT 1 FROM event_owner_map m LEFT JOIN public.shooting_events e ON e.id=m.event_id WHERE e.id IS NULL) THEN
    RAISE EXCEPTION 'Unknown event in mapping' USING ERRCODE='23503';
  END IF;
  IF EXISTS(SELECT 1 FROM event_owner_map m LEFT JOIN auth.users u ON u.id=m.owner_id WHERE u.id IS NULL) THEN
    RAISE EXCEPTION 'Unknown auth user in mapping' USING ERRCODE='23503';
  END IF;
  IF EXISTS(SELECT 1 FROM event_owner_map m JOIN public.shooting_events e ON e.id=m.event_id
            WHERE e.owner_id IS NOT NULL) THEN
    RAISE EXCEPTION 'Already assigned event found. Ownership transfers need separate review.';
  END IF;
  UPDATE public.shooting_events e SET owner_id=m.owner_id
  FROM event_owner_map m WHERE e.id=m.event_id AND e.owner_id IS NULL;
  GET DIAGNOSTICS changed=ROW_COUNT;
  IF changed<>expected THEN RAISE EXCEPTION 'Expected % assignments, changed %',expected,changed; END IF;
END $backfill$;

SELECT count(*) AS still_unassigned_events FROM public.shooting_events WHERE owner_id IS NULL;
SELECT e.id,e.name,e.owner_id FROM public.shooting_events e JOIN event_owner_map m ON m.event_id=e.id;

-- Replace only this final ROLLBACK with COMMIT after reviewing a successful dry run.
ROLLBACK;
