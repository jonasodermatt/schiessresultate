-- ADMIN ONLY, AFTER 202610170001_event_owner_isolation.sql.
-- User explicitly authorized assigning all existing events and shooters to their account.
-- Set the verified auth.users UUID below. Never use auth.uid() in the SQL Editor.
-- Existing assignments to a different account cause an atomic abort.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='120s';

CREATE TEMP TABLE assignment_target(owner_id uuid NOT NULL) ON COMMIT DROP;

DO $target$
DECLARE account_id uuid := 'ca9cc641-96b7-4cec-8d25-6f4ef3f53eff'::uuid; -- TARGET_ACCOUNT_ID
BEGIN
  IF account_id IS NULL THEN
    RAISE EXCEPTION 'Set the confirmed account UUID before running this script';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM auth.users WHERE id=account_id) THEN
    RAISE EXCEPTION 'The target account does not exist' USING ERRCODE='23503';
  END IF;
  INSERT INTO assignment_target VALUES(account_id);
END $target$;

LOCK TABLE public.shooting_events,public.shooters IN SHARE ROW EXCLUSIVE MODE;

DO $assign$
DECLARE account_id uuid; expected_events bigint; expected_shooters bigint; changed bigint;
BEGIN
  SELECT owner_id INTO STRICT account_id FROM assignment_target;
  IF EXISTS(SELECT 1 FROM public.shooting_events WHERE owner_id IS NOT NULL AND owner_id<>account_id)
    OR EXISTS(SELECT 1 FROM public.shooters WHERE owner_id IS NOT NULL AND owner_id<>account_id) THEN
    RAISE EXCEPTION 'Data already belongs to another account; no assignments were changed';
  END IF;
  SELECT count(*) INTO expected_events FROM public.shooting_events WHERE owner_id IS NULL;
  SELECT count(*) INTO expected_shooters FROM public.shooters WHERE owner_id IS NULL;

  UPDATE public.shooting_events SET owner_id=account_id WHERE owner_id IS NULL;
  GET DIAGNOSTICS changed=ROW_COUNT;
  IF changed<>expected_events THEN RAISE EXCEPTION 'Unexpected event assignment count'; END IF;

  UPDATE public.shooters SET owner_id=account_id WHERE owner_id IS NULL;
  GET DIAGNOSTICS changed=ROW_COUNT;
  IF changed<>expected_shooters THEN RAISE EXCEPTION 'Unexpected shooter assignment count'; END IF;

  IF EXISTS(SELECT 1 FROM public.shooting_events WHERE owner_id IS DISTINCT FROM account_id)
    OR EXISTS(SELECT 1 FROM public.shooters WHERE owner_id IS DISTINCT FROM account_id) THEN
    RAISE EXCEPTION 'Incomplete assignment';
  END IF;
END $assign$;

SELECT t.owner_id AS target_account,
  (SELECT count(*) FROM public.shooting_events e WHERE e.owner_id=t.owner_id) AS owned_events,
  (SELECT count(*) FROM public.shooters s WHERE s.owner_id=t.owner_id) AS owned_shooters
FROM assignment_target t;

-- Related registrations, shots, rankings and finances inherit access from their event.
COMMIT;
