-- EasyShooter owner isolation. Based on the supplied PostgreSQL 17.6 inventory.
-- Run ONCE as database administrator, during a maintenance window, after a backup.
-- Never fills owner_id for existing events or shooters. Unresolved rows stay private.
-- All schema/data checks and changes are atomic. Any error requires ROLLBACK.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';
SET LOCAL search_path = public, pg_catalog;

-- Fail closed on schema drift. No IF EXISTS that silently skips required objects.
DO $preflight$
DECLARE r record; actual text[];
BEGIN
  IF current_setting('server_version_num')::integer < 150000 THEN
    RAISE EXCEPTION 'PostgreSQL 15+ required for security_invoker views';
  END IF;
  SELECT array_agg(c.relname::text ORDER BY c.relname) INTO actual
  FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='public' AND c.relname LIKE 'shooting_event%' AND c.relkind IN ('r','p','v','m','f');
  IF actual IS DISTINCT FROM ARRAY['shooting_event_categories','shooting_event_combination_stitches','shooting_event_combinations','shooting_event_group_members','shooting_event_groups','shooting_event_nachdoppel_evaluation','shooting_event_payouts','shooting_event_ranked_shots','shooting_event_ranking_base','shooting_event_ranking_glueck','shooting_event_ranking_jm','shooting_event_ranking_kunst','shooting_event_ranking_militaer','shooting_event_ranking_nachdoppel','shooting_event_ranking_ruetli','shooting_event_ranking_section','shooting_event_registration_stitches','shooting_event_registrations','shooting_event_ruetli_evaluation','shooting_event_stitch_blocks','shooting_event_stitch_evaluation','shooting_event_stitch_instant_payout_rules','shooting_event_stitch_instant_payouts','shooting_event_stitch_passes','shooting_event_stitch_payout_settlements','shooting_event_stitch_shots','shooting_event_stitches','shooting_event_total_stitch_evaluation','shooting_events']::text[] THEN
    RAISE EXCEPTION 'Event relation inventory changed. Export and review the current schema first.';
  END IF;
  FOR r IN SELECT * FROM (VALUES
    ('shooting_event_categories', 'id', 'uuid', true),
    ('shooting_event_categories', 'shooting_event_id', 'uuid', true),
    ('shooting_event_categories', 'code', 'text', true),
    ('shooting_event_categories', 'name', 'text', true),
    ('shooting_event_categories', 'min_age', 'integer', true),
    ('shooting_event_categories', 'max_age', 'integer', false),
    ('shooting_event_categories', 'sort_order', 'integer', true),
    ('shooting_event_combination_stitches', 'id', 'uuid', true),
    ('shooting_event_combination_stitches', 'combination_id', 'uuid', true),
    ('shooting_event_combination_stitches', 'event_stitch_id', 'uuid', true),
    ('shooting_event_combination_stitches', 'weight_percent', 'numeric(6,3)', true),
    ('shooting_event_combination_stitches', 'sort_order', 'integer', true),
    ('shooting_event_combinations', 'id', 'uuid', true),
    ('shooting_event_combinations', 'shooting_event_id', 'uuid', true),
    ('shooting_event_combinations', 'name', 'text', true),
    ('shooting_event_combinations', 'description', 'text', false),
    ('shooting_event_combinations', 'active', 'boolean', true),
    ('shooting_event_combinations', 'sort_order', 'integer', true),
    ('shooting_event_combinations', 'created_at', 'timestamp with time zone', true),
    ('shooting_event_combinations', 'tie_break_mode', 'text', true),
    ('shooting_event_combinations', 'tie_break_stitch_id', 'uuid', false),
    ('shooting_event_group_members', 'id', 'uuid', true),
    ('shooting_event_group_members', 'group_id', 'uuid', true),
    ('shooting_event_group_members', 'registration_id', 'uuid', true),
    ('shooting_event_group_members', 'sort_order', 'integer', true),
    ('shooting_event_groups', 'id', 'uuid', true),
    ('shooting_event_groups', 'shooting_event_id', 'uuid', true),
    ('shooting_event_groups', 'name', 'text', true),
    ('shooting_event_groups', 'max_members', 'integer', false),
    ('shooting_event_groups', 'active', 'boolean', true),
    ('shooting_event_groups', 'created_at', 'timestamp with time zone', true),
    ('shooting_event_payouts', 'id', 'uuid', true),
    ('shooting_event_payouts', 'shooting_event_id', 'uuid', true),
    ('shooting_event_payouts', 'event_stitch_id', 'uuid', false),
    ('shooting_event_payouts', 'combination_id', 'uuid', false),
    ('shooting_event_payouts', 'group_ranking', 'boolean', true),
    ('shooting_event_payouts', 'rank_from', 'integer', true),
    ('shooting_event_payouts', 'rank_to', 'integer', true),
    ('shooting_event_payouts', 'amount_chf', 'numeric(10,2)', true),
    ('shooting_event_payouts', 'description', 'text', false),
    ('shooting_event_payouts', 'created_at', 'timestamp with time zone', true),
    ('shooting_event_registration_stitches', 'id', 'uuid', true),
    ('shooting_event_registration_stitches', 'registration_id', 'uuid', true),
    ('shooting_event_registration_stitches', 'event_stitch_id', 'uuid', true),
    ('shooting_event_registration_stitches', 'weapon_id_override', 'uuid', false),
    ('shooting_event_registration_stitches', 'created_at', 'timestamp with time zone', true),
    ('shooting_event_registration_stitches', 'status', 'text', true),
    ('shooting_event_registration_stitches', 'registered_passes', 'integer', true),
    ('shooting_event_registration_stitches', 'price_override_chf', 'numeric', false),
    ('shooting_event_registration_stitches', 'additional_pass_price_override_chf', 'numeric', false),
    ('shooting_event_registrations', 'id', 'uuid', true),
    ('shooting_event_registrations', 'shooting_event_id', 'uuid', true),
    ('shooting_event_registrations', 'shooter_id', 'uuid', true),
    ('shooting_event_registrations', 'category', 'text', false),
    ('shooting_event_registrations', 'weapon_id', 'uuid', false),
    ('shooting_event_registrations', 'notes', 'text', false),
    ('shooting_event_registrations', 'created_at', 'timestamp with time zone', true),
    ('shooting_event_registrations', 'category_id', 'uuid', false),
    ('shooting_event_registrations', 'club_id', 'uuid', false),
    ('shooting_event_registrations', 'start_number', 'integer', false),
    ('shooting_event_stitch_blocks', 'id', 'uuid', true),
    ('shooting_event_stitch_blocks', 'event_stitch_id', 'uuid', true),
    ('shooting_event_stitch_blocks', 'block_number', 'integer', true),
    ('shooting_event_stitch_blocks', 'block_type', 'text', true),
    ('shooting_event_stitch_blocks', 'shot_count', 'integer', true),
    ('shooting_event_stitch_blocks', 'created_at', 'timestamp with time zone', true),
    ('shooting_event_stitch_instant_payout_rules', 'id', 'uuid', true),
    ('shooting_event_stitch_instant_payout_rules', 'event_stitch_id', 'uuid', true),
    ('shooting_event_stitch_instant_payout_rules', 'score', 'numeric(8,2)', true),
    ('shooting_event_stitch_instant_payout_rules', 'sort_order', 'integer', true),
    ('shooting_event_stitch_instant_payout_rules', 'created_at', 'timestamp with time zone', true),
    ('shooting_event_stitch_instant_payout_rules', 'first_amount_chf', 'numeric(10,2)', true),
    ('shooting_event_stitch_instant_payout_rules', 'repeat_amount_chf', 'numeric(10,2)', true),
    ('shooting_event_stitch_instant_payouts', 'id', 'uuid', true),
    ('shooting_event_stitch_instant_payouts', 'event_stitch_id', 'uuid', true),
    ('shooting_event_stitch_instant_payouts', 'registration_id', 'uuid', true),
    ('shooting_event_stitch_instant_payouts', 'pass_id', 'uuid', false),
    ('shooting_event_stitch_instant_payouts', 'shot_id', 'uuid', false),
    ('shooting_event_stitch_instant_payouts', 'rule_id', 'uuid', false),
    ('shooting_event_stitch_instant_payouts', 'score', 'numeric(8,2)', true),
    ('shooting_event_stitch_instant_payouts', 'occurrence', 'integer', true),
    ('shooting_event_stitch_instant_payouts', 'amount_chf', 'numeric(10,2)', true),
    ('shooting_event_stitch_instant_payouts', 'created_at', 'timestamp with time zone', true),
    ('shooting_event_stitch_passes', 'id', 'uuid', true),
    ('shooting_event_stitch_passes', 'registration_stitch_id', 'uuid', true),
    ('shooting_event_stitch_passes', 'pass_number', 'integer', true),
    ('shooting_event_stitch_passes', 'created_at', 'timestamp with time zone', true),
    ('shooting_event_stitch_passes', 'status', 'text', true),
    ('shooting_event_stitch_passes', 'completed_at', 'timestamp with time zone', false),
    ('shooting_event_stitch_payout_settlements', 'id', 'uuid', true),
    ('shooting_event_stitch_payout_settlements', 'event_stitch_id', 'uuid', true),
    ('shooting_event_stitch_payout_settlements', 'registration_id', 'uuid', true),
    ('shooting_event_stitch_payout_settlements', 'rank', 'integer', false),
    ('shooting_event_stitch_payout_settlements', 'ranking_payout_chf', 'numeric(10,2)', true),
    ('shooting_event_stitch_payout_settlements', 'instant_payout_chf', 'numeric(10,2)', true),
    ('shooting_event_stitch_payout_settlements', 'total_payout_chf', 'numeric(10,2)', true),
    ('shooting_event_stitch_payout_settlements', 'finalized_at', 'timestamp with time zone', true),
    ('shooting_event_stitch_shots', 'id', 'uuid', true),
    ('shooting_event_stitch_shots', 'pass_id', 'uuid', true),
    ('shooting_event_stitch_shots', 'shot_number', 'integer', true),
    ('shooting_event_stitch_shots', 'score', 'integer', true),
    ('shooting_event_stitch_shots', 'x_position', 'numeric', false),
    ('shooting_event_stitch_shots', 'y_position', 'numeric', false),
    ('shooting_event_stitch_shots', 'created_at', 'timestamp with time zone', true),
    ('shooting_event_stitch_shots', 'tie_break_score', 'integer', false),
    ('shooting_event_stitch_shots', 'block_id', 'uuid', false),
    ('shooting_event_stitches', 'id', 'uuid', true),
    ('shooting_event_stitches', 'shooting_event_id', 'uuid', true),
    ('shooting_event_stitches', 'name', 'text', true),
    ('shooting_event_stitches', 'code', 'text', true),
    ('shooting_event_stitches', 'sort_order', 'integer', true),
    ('shooting_event_stitches', 'scoring_type', 'text', true),
    ('shooting_event_stitches', 'shots_per_pass', 'integer', false),
    ('shooting_event_stitches', 'max_passes', 'integer', false),
    ('shooting_event_stitches', 'ranking_mode', 'text', true),
    ('shooting_event_stitches', 'active', 'boolean', true),
    ('shooting_event_stitches', 'created_at', 'timestamp with time zone', true),
    ('shooting_event_stitches', 'program_id', 'uuid', false),
    ('shooting_event_stitches', 'price_chf', 'numeric(10,2)', true),
    ('shooting_event_stitches', 'additional_pass_price_chf', 'numeric(10,2)', true),
    ('shooting_event_stitches', 'jj_price_chf', 'numeric', false),
    ('shooting_event_stitches', 'jj_additional_pass_price_chf', 'numeric', false),
    ('shooting_event_stitches', 'payout_enabled', 'boolean', true),
    ('shooting_event_stitches', 'payout_percentage', 'numeric(5,2)', true),
    ('shooting_event_stitches', 'payout_winner_mode', 'text', true),
    ('shooting_event_stitches', 'payout_winner_numerator', 'integer', true),
    ('shooting_event_stitches', 'payout_winner_denominator', 'integer', true),
    ('shooting_event_stitches', 'payout_fixed_winner_count', 'integer', false),
    ('shooting_event_stitches', 'payout_min_first_chf', 'numeric(10,2)', false),
    ('shooting_event_stitches', 'payout_min_second_chf', 'numeric(10,2)', false),
    ('shooting_event_stitches', 'payout_min_third_chf', 'numeric(10,2)', false),
    ('shooting_event_stitches', 'payout_min_last_chf', 'numeric(10,2)', false),
    ('shooting_event_stitches', 'payout_step_chf', 'numeric(10,2)', true),
    ('shooting_event_stitches', 'payout_curve_exponent', 'numeric(6,3)', true),
    ('shooting_event_stitches', 'payout_instant_max_chf', 'numeric(10,2)', false),
    ('shooting_events', 'id', 'uuid', true),
    ('shooting_events', 'club_id', 'uuid', true),
    ('shooting_events', 'name', 'text', true),
    ('shooting_events', 'event_date', 'date', true),
    ('shooting_events', 'shooting_range_id', 'uuid', false),
    ('shooting_events', 'distance_m', 'integer', true),
    ('shooting_events', 'notes', 'text', false),
    ('shooting_events', 'status', 'text', true),
    ('shooting_events', 'created_at', 'timestamp with time zone', true),
    ('shooting_events', 'group_ranking_stitch_id', 'uuid', false),
    ('shooters', 'id', 'uuid', true),
    ('shooters', 'master_number', 'integer', true),
    ('shooters', 'first_name', 'text', true),
    ('shooters', 'last_name', 'text', true),
    ('shooters', 'birth_year', 'integer', false),
    ('shooters', 'birth_date', 'date', false),
    ('shooters', 'club_id', 'uuid', false),
    ('shooters', 'active', 'boolean', true),
    ('shooters', 'created_at', 'timestamp with time zone', true),
    ('shooters', 'updated_at', 'timestamp with time zone', true)
  ) AS expected(tbl,col,typ,nn) LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_attribute a
      WHERE a.attrelid=to_regclass('public.'||r.tbl) AND a.attname=r.col
      AND NOT a.attisdropped AND format_type(a.atttypid,a.atttypmod)=r.typ AND a.attnotnull=r.nn) THEN
      RAISE EXCEPTION 'Schema mismatch: %.%', r.tbl,r.col;
    END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid IN ('public.shooting_events'::regclass,'public.shooters'::regclass)
    AND attname='owner_id' AND NOT attisdropped) THEN
    RAISE EXCEPTION 'owner_id already exists: do not rerun or overwrite an existing ownership model';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint c WHERE c.contype='f'
    AND c.confrelid IN ('public.shooting_event_categories'::regclass,'public.shooting_event_combination_stitches'::regclass,'public.shooting_event_combinations'::regclass,'public.shooting_event_group_members'::regclass,'public.shooting_event_groups'::regclass,'public.shooting_event_payouts'::regclass,'public.shooting_event_registration_stitches'::regclass,'public.shooting_event_registrations'::regclass,'public.shooting_event_stitch_blocks'::regclass,'public.shooting_event_stitch_instant_payout_rules'::regclass,'public.shooting_event_stitch_instant_payouts'::regclass,'public.shooting_event_stitch_passes'::regclass,'public.shooting_event_stitch_payout_settlements'::regclass,'public.shooting_event_stitch_shots'::regclass,'public.shooting_event_stitches'::regclass,'public.shooting_events'::regclass)
    AND c.conrelid NOT IN ('public.shooting_event_categories'::regclass,'public.shooting_event_combination_stitches'::regclass,'public.shooting_event_combinations'::regclass,'public.shooting_event_group_members'::regclass,'public.shooting_event_groups'::regclass,'public.shooting_event_payouts'::regclass,'public.shooting_event_registration_stitches'::regclass,'public.shooting_event_registrations'::regclass,'public.shooting_event_stitch_blocks'::regclass,'public.shooting_event_stitch_instant_payout_rules'::regclass,'public.shooting_event_stitch_instant_payouts'::regclass,'public.shooting_event_stitch_passes'::regclass,'public.shooting_event_stitch_payout_settlements'::regclass,'public.shooting_event_stitch_shots'::regclass,'public.shooting_event_stitches'::regclass,'public.shooting_events'::regclass)) THEN
    RAISE EXCEPTION 'An unreviewed table references event data';
  END IF;
  IF EXISTS (
    WITH RECURSIVE affected(oid) AS (
      SELECT unnest(ARRAY['public.shooting_event_categories'::regclass::oid,'public.shooting_event_combination_stitches'::regclass::oid,'public.shooting_event_combinations'::regclass::oid,'public.shooting_event_group_members'::regclass::oid,'public.shooting_event_groups'::regclass::oid,'public.shooting_event_payouts'::regclass::oid,'public.shooting_event_registration_stitches'::regclass::oid,'public.shooting_event_registrations'::regclass::oid,'public.shooting_event_stitch_blocks'::regclass::oid,'public.shooting_event_stitch_instant_payout_rules'::regclass::oid,'public.shooting_event_stitch_instant_payouts'::regclass::oid,'public.shooting_event_stitch_passes'::regclass::oid,'public.shooting_event_stitch_payout_settlements'::regclass::oid,'public.shooting_event_stitch_shots'::regclass::oid,'public.shooting_event_stitches'::regclass::oid,'public.shooting_events'::regclass::oid])
      UNION
      SELECT rw.ev_class FROM affected a JOIN pg_depend d ON d.refobjid=a.oid AND d.refclassid='pg_class'::regclass
        JOIN pg_rewrite rw ON d.classid='pg_rewrite'::regclass AND d.objid=rw.oid
    ) SELECT 1 FROM affected a JOIN pg_class c ON c.oid=a.oid
      WHERE c.relkind IN ('v','m') AND c.oid NOT IN ('public.shooting_event_nachdoppel_evaluation'::regclass,'public.shooting_event_ranked_shots'::regclass,'public.shooting_event_ranking_base'::regclass,'public.shooting_event_ranking_glueck'::regclass,'public.shooting_event_ranking_jm'::regclass,'public.shooting_event_ranking_kunst'::regclass,'public.shooting_event_ranking_militaer'::regclass,'public.shooting_event_ranking_nachdoppel'::regclass,'public.shooting_event_ranking_ruetli'::regclass,'public.shooting_event_ranking_section'::regclass,'public.shooting_event_ruetli_evaluation'::regclass,'public.shooting_event_stitch_evaluation'::regclass,'public.shooting_event_total_stitch_evaluation'::regclass)
  ) THEN RAISE EXCEPTION 'Unreviewed dependent view found'; END IF;
  IF md5(btrim(regexp_replace(pg_get_viewdef('public.shooting_event_nachdoppel_evaluation'::regclass,true),'\s+',' ','g'))) <> 'a6b8cbb57da1201e05561a3293fbf0b5' THEN
    RAISE EXCEPTION 'View definition changed: shooting_event_nachdoppel_evaluation';
  END IF;
  IF md5(btrim(regexp_replace(pg_get_viewdef('public.shooting_event_ranked_shots'::regclass,true),'\s+',' ','g'))) <> 'c822800e01e42fd8d7beb6ad53a58dc8' THEN
    RAISE EXCEPTION 'View definition changed: shooting_event_ranked_shots';
  END IF;
  IF md5(btrim(regexp_replace(pg_get_viewdef('public.shooting_event_ranking_base'::regclass,true),'\s+',' ','g'))) <> '95b7d2e4cc2ce27a535ef4096ad955cc' THEN
    RAISE EXCEPTION 'View definition changed: shooting_event_ranking_base';
  END IF;
  IF md5(btrim(regexp_replace(pg_get_viewdef('public.shooting_event_ranking_glueck'::regclass,true),'\s+',' ','g'))) <> '090a82e929da368d6b666e1031e73766' THEN
    RAISE EXCEPTION 'View definition changed: shooting_event_ranking_glueck';
  END IF;
  IF md5(btrim(regexp_replace(pg_get_viewdef('public.shooting_event_ranking_jm'::regclass,true),'\s+',' ','g'))) <> 'b1b6961e7a8199ba56a509d9e2ddd62e' THEN
    RAISE EXCEPTION 'View definition changed: shooting_event_ranking_jm';
  END IF;
  IF md5(btrim(regexp_replace(pg_get_viewdef('public.shooting_event_ranking_kunst'::regclass,true),'\s+',' ','g'))) <> '0e2f5fc55924a0f8f99013e956d0a242' THEN
    RAISE EXCEPTION 'View definition changed: shooting_event_ranking_kunst';
  END IF;
  IF md5(btrim(regexp_replace(pg_get_viewdef('public.shooting_event_ranking_militaer'::regclass,true),'\s+',' ','g'))) <> '8b81855703b0cdd2db4ee106131ffeaa' THEN
    RAISE EXCEPTION 'View definition changed: shooting_event_ranking_militaer';
  END IF;
  IF md5(btrim(regexp_replace(pg_get_viewdef('public.shooting_event_ranking_nachdoppel'::regclass,true),'\s+',' ','g'))) <> '8b2bfeee33837aa1f86e154e052b4b00' THEN
    RAISE EXCEPTION 'View definition changed: shooting_event_ranking_nachdoppel';
  END IF;
  IF md5(btrim(regexp_replace(pg_get_viewdef('public.shooting_event_ranking_ruetli'::regclass,true),'\s+',' ','g'))) <> '169911833cd10d43474689994e36a5eb' THEN
    RAISE EXCEPTION 'View definition changed: shooting_event_ranking_ruetli';
  END IF;
  IF md5(btrim(regexp_replace(pg_get_viewdef('public.shooting_event_ranking_section'::regclass,true),'\s+',' ','g'))) <> '4429ff1d6d44b95af9b4e04e3631194e' THEN
    RAISE EXCEPTION 'View definition changed: shooting_event_ranking_section';
  END IF;
  IF md5(btrim(regexp_replace(pg_get_viewdef('public.shooting_event_ruetli_evaluation'::regclass,true),'\s+',' ','g'))) <> 'dad7467f41e9b18726912e73611ec70e' THEN
    RAISE EXCEPTION 'View definition changed: shooting_event_ruetli_evaluation';
  END IF;
  IF md5(btrim(regexp_replace(pg_get_viewdef('public.shooting_event_stitch_evaluation'::regclass,true),'\s+',' ','g'))) <> '40c4439201ad6a0f9576ec627b0da070' THEN
    RAISE EXCEPTION 'View definition changed: shooting_event_stitch_evaluation';
  END IF;
  IF md5(btrim(regexp_replace(pg_get_viewdef('public.shooting_event_total_stitch_evaluation'::regclass,true),'\s+',' ','g'))) <> 'f9ed44955380861ade4b391fc32d7aae' THEN
    RAISE EXCEPTION 'View definition changed: shooting_event_total_stitch_evaluation';
  END IF;
  FOR r IN SELECT * FROM (VALUES
    ('shooting_event_categories', 'shooting_event_categories_pkey', 'PRIMARY KEY (id)'),
    ('shooting_event_categories', 'shooting_event_categories_shooting_event_id_code_key', 'UNIQUE (shooting_event_id, code)'),
    ('shooting_event_categories', 'shooting_event_categories_shooting_event_id_fkey', 'FOREIGN KEY (shooting_event_id) REFERENCES shooting_events(id) ON DELETE CASCADE'),
    ('shooting_event_combination_stitches', 'shooting_event_combination_st_combination_id_event_stitch_i_key', 'UNIQUE (combination_id, event_stitch_id)'),
    ('shooting_event_combination_stitches', 'shooting_event_combination_stitches_combination_id_fkey', 'FOREIGN KEY (combination_id) REFERENCES shooting_event_combinations(id) ON DELETE CASCADE'),
    ('shooting_event_combination_stitches', 'shooting_event_combination_stitches_event_stitch_id_fkey', 'FOREIGN KEY (event_stitch_id) REFERENCES shooting_event_stitches(id) ON DELETE CASCADE'),
    ('shooting_event_combination_stitches', 'shooting_event_combination_stitches_pkey', 'PRIMARY KEY (id)'),
    ('shooting_event_combinations', 'shooting_event_combinations_pkey', 'PRIMARY KEY (id)'),
    ('shooting_event_combinations', 'shooting_event_combinations_shooting_event_id_fkey', 'FOREIGN KEY (shooting_event_id) REFERENCES shooting_events(id) ON DELETE CASCADE'),
    ('shooting_event_combinations', 'shooting_event_combinations_tie_break_mode_check', 'CHECK ((tie_break_mode = ANY (ARRAY[''age_older''::text, ''age_younger''::text, ''stitch''::text, ''alphabetical''::text])))'),
    ('shooting_event_combinations', 'shooting_event_combinations_tie_break_stitch_id_fkey', 'FOREIGN KEY (tie_break_stitch_id) REFERENCES shooting_event_stitches(id) ON DELETE SET NULL'),
    ('shooting_event_group_members', 'shooting_event_group_members_group_id_fkey', 'FOREIGN KEY (group_id) REFERENCES shooting_event_groups(id) ON DELETE CASCADE'),
    ('shooting_event_group_members', 'shooting_event_group_members_group_id_registration_id_key', 'UNIQUE (group_id, registration_id)'),
    ('shooting_event_group_members', 'shooting_event_group_members_pkey', 'PRIMARY KEY (id)'),
    ('shooting_event_group_members', 'shooting_event_group_members_registration_id_fkey', 'FOREIGN KEY (registration_id) REFERENCES shooting_event_registrations(id) ON DELETE CASCADE'),
    ('shooting_event_groups', 'shooting_event_groups_pkey', 'PRIMARY KEY (id)'),
    ('shooting_event_groups', 'shooting_event_groups_shooting_event_id_fkey', 'FOREIGN KEY (shooting_event_id) REFERENCES shooting_events(id) ON DELETE CASCADE'),
    ('shooting_event_groups', 'shooting_event_groups_shooting_event_id_name_key', 'UNIQUE (shooting_event_id, name)'),
    ('shooting_event_payouts', 'shooting_event_payouts_amount_chf_check', 'CHECK ((amount_chf >= (0)::numeric))'),
    ('shooting_event_payouts', 'shooting_event_payouts_check', 'CHECK ((rank_to >= rank_from))'),
    ('shooting_event_payouts', 'shooting_event_payouts_combination_id_fkey', 'FOREIGN KEY (combination_id) REFERENCES shooting_event_combinations(id) ON DELETE CASCADE'),
    ('shooting_event_payouts', 'shooting_event_payouts_event_stitch_id_fkey', 'FOREIGN KEY (event_stitch_id) REFERENCES shooting_event_stitches(id) ON DELETE CASCADE'),
    ('shooting_event_payouts', 'shooting_event_payouts_pkey', 'PRIMARY KEY (id)'),
    ('shooting_event_payouts', 'shooting_event_payouts_rank_from_check', 'CHECK ((rank_from >= 1))'),
    ('shooting_event_payouts', 'shooting_event_payouts_shooting_event_id_fkey', 'FOREIGN KEY (shooting_event_id) REFERENCES shooting_events(id) ON DELETE CASCADE'),
    ('shooting_event_registration_stitches', 'shooting_event_registration_stitches_event_stitch_id_fkey', 'FOREIGN KEY (event_stitch_id) REFERENCES shooting_event_stitches(id) ON DELETE CASCADE'),
    ('shooting_event_registration_stitches', 'shooting_event_registration_stitches_pkey', 'PRIMARY KEY (id)'),
    ('shooting_event_registration_stitches', 'shooting_event_registration_stitches_registered_passes_check', 'CHECK ((registered_passes >= 1))'),
    ('shooting_event_registration_stitches', 'shooting_event_registration_stitches_registration_id_fkey', 'FOREIGN KEY (registration_id) REFERENCES shooting_event_registrations(id) ON DELETE CASCADE'),
    ('shooting_event_registration_stitches', 'shooting_event_registration_stitches_status_check', 'CHECK ((status = ANY (ARRAY[''registered''::text, ''started''::text, ''completed''::text, ''dns''::text])))'),
    ('shooting_event_registration_stitches', 'shooting_event_registration_stitches_unique', 'UNIQUE (registration_id, event_stitch_id)'),
    ('shooting_event_registration_stitches', 'shooting_event_registration_stitches_weapon_id_override_fkey', 'FOREIGN KEY (weapon_id_override) REFERENCES competition_weapons(id)'),
    ('shooting_event_registrations', 'shooting_event_registration_unique', 'UNIQUE (shooting_event_id, shooter_id)'),
    ('shooting_event_registrations', 'shooting_event_registrations_category_id_fkey', 'FOREIGN KEY (category_id) REFERENCES shooting_event_categories(id)'),
    ('shooting_event_registrations', 'shooting_event_registrations_club_id_fkey', 'FOREIGN KEY (club_id) REFERENCES clubs(id)'),
    ('shooting_event_registrations', 'shooting_event_registrations_pkey', 'PRIMARY KEY (id)'),
    ('shooting_event_registrations', 'shooting_event_registrations_shooter_id_fkey', 'FOREIGN KEY (shooter_id) REFERENCES shooters(id)'),
    ('shooting_event_registrations', 'shooting_event_registrations_shooting_event_id_fkey', 'FOREIGN KEY (shooting_event_id) REFERENCES shooting_events(id) ON DELETE CASCADE'),
    ('shooting_event_registrations', 'shooting_event_registrations_weapon_id_fkey', 'FOREIGN KEY (weapon_id) REFERENCES competition_weapons(id)'),
    ('shooting_event_stitch_blocks', 'shooting_event_stitch_blocks_block_type_check', 'CHECK ((block_type = ANY (ARRAY[''single''::text, ''series''::text])))'),
    ('shooting_event_stitch_blocks', 'shooting_event_stitch_blocks_event_stitch_id_fkey', 'FOREIGN KEY (event_stitch_id) REFERENCES shooting_event_stitches(id) ON DELETE CASCADE'),
    ('shooting_event_stitch_blocks', 'shooting_event_stitch_blocks_pkey', 'PRIMARY KEY (id)'),
    ('shooting_event_stitch_blocks', 'shooting_event_stitch_blocks_shot_count_check', 'CHECK ((shot_count > 0))'),
    ('shooting_event_stitch_blocks', 'shooting_event_stitch_blocks_unique', 'UNIQUE (event_stitch_id, block_number)'),
    ('shooting_event_stitch_instant_payout_rules', 'shooting_event_stitch_instant_payout_rules_event_stitch_id_fkey', 'FOREIGN KEY (event_stitch_id) REFERENCES shooting_event_stitches(id) ON DELETE CASCADE'),
    ('shooting_event_stitch_instant_payout_rules', 'shooting_event_stitch_instant_payout_rules_first_amount_check', 'CHECK ((first_amount_chf >= (0)::numeric))'),
    ('shooting_event_stitch_instant_payout_rules', 'shooting_event_stitch_instant_payout_rules_pkey', 'PRIMARY KEY (id)'),
    ('shooting_event_stitch_instant_payout_rules', 'shooting_event_stitch_instant_payout_rules_repeat_amount_check', 'CHECK ((repeat_amount_chf >= (0)::numeric))'),
    ('shooting_event_stitch_instant_payouts', 'shooting_event_stitch_instant_payouts_event_stitch_id_fkey', 'FOREIGN KEY (event_stitch_id) REFERENCES shooting_event_stitches(id) ON DELETE CASCADE'),
    ('shooting_event_stitch_instant_payouts', 'shooting_event_stitch_instant_payouts_pass_id_fkey', 'FOREIGN KEY (pass_id) REFERENCES shooting_event_stitch_passes(id) ON DELETE SET NULL'),
    ('shooting_event_stitch_instant_payouts', 'shooting_event_stitch_instant_payouts_pkey', 'PRIMARY KEY (id)'),
    ('shooting_event_stitch_instant_payouts', 'shooting_event_stitch_instant_payouts_registration_id_fkey', 'FOREIGN KEY (registration_id) REFERENCES shooting_event_registrations(id) ON DELETE CASCADE'),
    ('shooting_event_stitch_instant_payouts', 'shooting_event_stitch_instant_payouts_rule_id_fkey', 'FOREIGN KEY (rule_id) REFERENCES shooting_event_stitch_instant_payout_rules(id) ON DELETE SET NULL'),
    ('shooting_event_stitch_instant_payouts', 'shooting_event_stitch_instant_payouts_shot_id_fkey', 'FOREIGN KEY (shot_id) REFERENCES shooting_event_stitch_shots(id) ON DELETE SET NULL'),
    ('shooting_event_stitch_passes', 'shooting_event_stitch_passes_number_check', 'CHECK ((pass_number >= 1))'),
    ('shooting_event_stitch_passes', 'shooting_event_stitch_passes_pkey', 'PRIMARY KEY (id)'),
    ('shooting_event_stitch_passes', 'shooting_event_stitch_passes_registration_stitch_id_fkey', 'FOREIGN KEY (registration_stitch_id) REFERENCES shooting_event_registration_stitches(id) ON DELETE CASCADE'),
    ('shooting_event_stitch_passes', 'shooting_event_stitch_passes_status_check', 'CHECK ((status = ANY (ARRAY[''open''::text, ''completed''::text])))'),
    ('shooting_event_stitch_passes', 'shooting_event_stitch_passes_unique', 'UNIQUE (registration_stitch_id, pass_number)'),
    ('shooting_event_stitch_payout_settlements', 'shooting_event_stitch_payout__event_stitch_id_registration__key', 'UNIQUE (event_stitch_id, registration_id)'),
    ('shooting_event_stitch_payout_settlements', 'shooting_event_stitch_payout_settlements_event_stitch_id_fkey', 'FOREIGN KEY (event_stitch_id) REFERENCES shooting_event_stitches(id) ON DELETE CASCADE'),
    ('shooting_event_stitch_payout_settlements', 'shooting_event_stitch_payout_settlements_pkey', 'PRIMARY KEY (id)'),
    ('shooting_event_stitch_payout_settlements', 'shooting_event_stitch_payout_settlements_registration_id_fkey', 'FOREIGN KEY (registration_id) REFERENCES shooting_event_registrations(id) ON DELETE CASCADE'),
    ('shooting_event_stitch_shots', 'shooting_event_stitch_shots_block_id_fkey', 'FOREIGN KEY (block_id) REFERENCES shooting_event_stitch_blocks(id)'),
    ('shooting_event_stitch_shots', 'shooting_event_stitch_shots_number_check', 'CHECK ((shot_number >= 1))'),
    ('shooting_event_stitch_shots', 'shooting_event_stitch_shots_pass_id_fkey', 'FOREIGN KEY (pass_id) REFERENCES shooting_event_stitch_passes(id) ON DELETE CASCADE'),
    ('shooting_event_stitch_shots', 'shooting_event_stitch_shots_pkey', 'PRIMARY KEY (id)'),
    ('shooting_event_stitch_shots', 'shooting_event_stitch_shots_score_check', 'CHECK (((score >= 0) AND (score <= 100)))'),
    ('shooting_event_stitch_shots', 'shooting_event_stitch_shots_tie_break_score_check', 'CHECK (((tie_break_score IS NULL) OR ((tie_break_score >= 0) AND (tie_break_score <= 100))))'),
    ('shooting_event_stitch_shots', 'shooting_event_stitch_shots_unique', 'UNIQUE (pass_id, shot_number)'),
    ('shooting_event_stitches', 'shooting_event_stitches_payout_instant_max_check', 'CHECK (((payout_instant_max_chf IS NULL) OR (payout_instant_max_chf >= (0)::numeric)))'),
    ('shooting_event_stitches', 'shooting_event_stitches_payout_percentage_check', 'CHECK (((payout_percentage >= (0)::numeric) AND (payout_percentage <= (100)::numeric)))'),
    ('shooting_event_stitches', 'shooting_event_stitches_payout_step_check', 'CHECK ((payout_step_chf > (0)::numeric))'),
    ('shooting_event_stitches', 'shooting_event_stitches_payout_winner_mode_check', 'CHECK ((payout_winner_mode = ANY (ARRAY[''fraction''::text, ''fixed''::text, ''all''::text])))'),
    ('shooting_event_stitches', 'shooting_event_stitches_pkey', 'PRIMARY KEY (id)'),
    ('shooting_event_stitches', 'shooting_event_stitches_program_id_fkey', 'FOREIGN KEY (program_id) REFERENCES shooting_programs(id)'),
    ('shooting_event_stitches', 'shooting_event_stitches_scoring_type_check', 'CHECK ((scoring_type = ANY (ARRAY[''A5''::text, ''A10''::text, ''A100''::text])))'),
    ('shooting_event_stitches', 'shooting_event_stitches_shooting_event_id_fkey', 'FOREIGN KEY (shooting_event_id) REFERENCES shooting_events(id) ON DELETE CASCADE'),
    ('shooting_event_stitches', 'shooting_event_stitches_unique', 'UNIQUE (shooting_event_id, code)'),
    ('shooting_events', 'shooting_events_club_id_fkey', 'FOREIGN KEY (club_id) REFERENCES clubs(id)'),
    ('shooting_events', 'shooting_events_group_ranking_stitch_id_fkey', 'FOREIGN KEY (group_ranking_stitch_id) REFERENCES shooting_event_stitches(id) ON DELETE SET NULL'),
    ('shooting_events', 'shooting_events_pkey', 'PRIMARY KEY (id)'),
    ('shooting_events', 'shooting_events_shooting_range_id_fkey', 'FOREIGN KEY (shooting_range_id) REFERENCES shooting_ranges(id)'),
    ('shooting_events', 'shooting_events_status_check', 'CHECK ((status = ANY (ARRAY[''draft''::text, ''open''::text, ''completed''::text])))')
  ) AS expected(tbl,con,def) LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_constraint c WHERE c.conrelid=to_regclass('public.'||r.tbl)
      AND c.conname=r.con AND pg_get_constraintdef(c.oid)=r.def AND c.convalidated) THEN
      RAISE EXCEPTION 'Constraint mismatch: %.%',r.tbl,r.con;
    END IF;
  END LOOP;
  IF (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='public' AND p.prokind IN ('f','p')) <> 4 THEN
    RAISE EXCEPTION 'Public function inventory changed; review RPC and trigger security first';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE oid=to_regprocedure('public.check_event_stitch_pass_limit()')
    AND NOT prosecdef AND md5(replace(prosrc,chr(13),''))='74f163462437dbcc3f353c74b4adf971') THEN
    RAISE EXCEPTION 'Function changed: check_event_stitch_pass_limit()';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE oid=to_regprocedure('public.check_event_stitch_score()')
    AND NOT prosecdef AND md5(replace(prosrc,chr(13),''))='0cecc6b88f7391e4811a87915e2ebd0c') THEN
    RAISE EXCEPTION 'Function changed: check_event_stitch_score()';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE oid=to_regprocedure('public.delete_shooting_event(uuid)')
    AND NOT prosecdef AND md5(replace(prosrc,chr(13),''))='2a9dfeb122a09d8ec409fd3f80e2713d') THEN
    RAISE EXCEPTION 'Function changed: delete_shooting_event(uuid)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE oid=to_regprocedure('public.check_event_stitch_shot_limit()')
    AND NOT prosecdef AND md5(replace(prosrc,chr(13),''))='24078472dd5d257184783a3e17787e62') THEN
    RAISE EXCEPTION 'Function changed: check_event_stitch_shot_limit()';
  END IF;
END $preflight$;

LOCK TABLE public.shooting_event_categories, public.shooting_event_combination_stitches, public.shooting_event_combinations, public.shooting_event_group_members, public.shooting_event_groups, public.shooting_event_payouts, public.shooting_event_registration_stitches, public.shooting_event_registrations, public.shooting_event_stitch_blocks, public.shooting_event_stitch_instant_payout_rules, public.shooting_event_stitch_instant_payouts, public.shooting_event_stitch_passes, public.shooting_event_stitch_payout_settlements, public.shooting_event_stitch_shots, public.shooting_event_stitches, public.shooting_events, public.shooters IN ACCESS EXCLUSIVE MODE;

CREATE TEMP TABLE event_migration_counts(table_name text PRIMARY KEY, row_count bigint) ON COMMIT DROP;
INSERT INTO event_migration_counts SELECT 'shooting_event_categories',count(*) FROM public.shooting_event_categories;
INSERT INTO event_migration_counts SELECT 'shooting_event_combination_stitches',count(*) FROM public.shooting_event_combination_stitches;
INSERT INTO event_migration_counts SELECT 'shooting_event_combinations',count(*) FROM public.shooting_event_combinations;
INSERT INTO event_migration_counts SELECT 'shooting_event_group_members',count(*) FROM public.shooting_event_group_members;
INSERT INTO event_migration_counts SELECT 'shooting_event_groups',count(*) FROM public.shooting_event_groups;
INSERT INTO event_migration_counts SELECT 'shooting_event_payouts',count(*) FROM public.shooting_event_payouts;
INSERT INTO event_migration_counts SELECT 'shooting_event_registration_stitches',count(*) FROM public.shooting_event_registration_stitches;
INSERT INTO event_migration_counts SELECT 'shooting_event_registrations',count(*) FROM public.shooting_event_registrations;
INSERT INTO event_migration_counts SELECT 'shooting_event_stitch_blocks',count(*) FROM public.shooting_event_stitch_blocks;
INSERT INTO event_migration_counts SELECT 'shooting_event_stitch_instant_payout_rules',count(*) FROM public.shooting_event_stitch_instant_payout_rules;
INSERT INTO event_migration_counts SELECT 'shooting_event_stitch_instant_payouts',count(*) FROM public.shooting_event_stitch_instant_payouts;
INSERT INTO event_migration_counts SELECT 'shooting_event_stitch_passes',count(*) FROM public.shooting_event_stitch_passes;
INSERT INTO event_migration_counts SELECT 'shooting_event_stitch_payout_settlements',count(*) FROM public.shooting_event_stitch_payout_settlements;
INSERT INTO event_migration_counts SELECT 'shooting_event_stitch_shots',count(*) FROM public.shooting_event_stitch_shots;
INSERT INTO event_migration_counts SELECT 'shooting_event_stitches',count(*) FROM public.shooting_event_stitches;
INSERT INTO event_migration_counts SELECT 'shooting_events',count(*) FROM public.shooting_events;
INSERT INTO event_migration_counts SELECT 'shooters',count(*) FROM public.shooters;

-- No DEFAULT on ADD COLUMN: existing records must NOT inherit the deploying user.
ALTER TABLE public.shooting_events ADD COLUMN owner_id uuid REFERENCES auth.users(id) ON DELETE RESTRICT;
ALTER TABLE public.shooting_events ALTER COLUMN owner_id SET DEFAULT auth.uid();
CREATE INDEX shooting_events_owner_id_idx ON public.shooting_events(owner_id);
ALTER TABLE public.shooters ADD COLUMN owner_id uuid REFERENCES auth.users(id) ON DELETE RESTRICT;
ALTER TABLE public.shooters ALTER COLUMN owner_id SET DEFAULT auth.uid();
CREATE INDEX shooters_owner_id_idx ON public.shooters(owner_id);

-- Denormalized event scope is derived only from an existing parent, never from a user.
-- Composite foreign keys below validate every second/optional parent reference.
ALTER TABLE public.shooting_event_stitch_blocks ADD COLUMN shooting_event_id uuid;
UPDATE public.shooting_event_stitch_blocks c SET shooting_event_id=p.shooting_event_id FROM public.shooting_event_stitches p WHERE p.id=c.event_stitch_id;
ALTER TABLE public.shooting_event_stitch_blocks ALTER COLUMN shooting_event_id SET NOT NULL;
CREATE FUNCTION public.scope_stitch_blocks() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $body$
DECLARE expected uuid;
BEGIN
  SELECT p.shooting_event_id INTO expected FROM public.shooting_event_stitches p WHERE p.id=NEW.event_stitch_id;
  IF expected IS NULL OR (NEW.shooting_event_id IS NOT NULL AND NEW.shooting_event_id<>expected) THEN
    RAISE EXCEPTION 'Invalid or inaccessible event reference' USING ERRCODE='23514';
  END IF;
  NEW.shooting_event_id := expected;
  RETURN NEW;
END $body$;
REVOKE ALL ON FUNCTION public.scope_stitch_blocks() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER a_event_scope BEFORE INSERT OR UPDATE OF event_stitch_id, shooting_event_id ON public.shooting_event_stitch_blocks
FOR EACH ROW EXECUTE FUNCTION public.scope_stitch_blocks();

ALTER TABLE public.shooting_event_stitch_instant_payout_rules ADD COLUMN shooting_event_id uuid;
UPDATE public.shooting_event_stitch_instant_payout_rules c SET shooting_event_id=p.shooting_event_id FROM public.shooting_event_stitches p WHERE p.id=c.event_stitch_id;
ALTER TABLE public.shooting_event_stitch_instant_payout_rules ALTER COLUMN shooting_event_id SET NOT NULL;
CREATE FUNCTION public.scope_stitch_instant_payout_rules() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $body$
DECLARE expected uuid;
BEGIN
  SELECT p.shooting_event_id INTO expected FROM public.shooting_event_stitches p WHERE p.id=NEW.event_stitch_id;
  IF expected IS NULL OR (NEW.shooting_event_id IS NOT NULL AND NEW.shooting_event_id<>expected) THEN
    RAISE EXCEPTION 'Invalid or inaccessible event reference' USING ERRCODE='23514';
  END IF;
  NEW.shooting_event_id := expected;
  RETURN NEW;
END $body$;
REVOKE ALL ON FUNCTION public.scope_stitch_instant_payout_rules() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER a_event_scope BEFORE INSERT OR UPDATE OF event_stitch_id, shooting_event_id ON public.shooting_event_stitch_instant_payout_rules
FOR EACH ROW EXECUTE FUNCTION public.scope_stitch_instant_payout_rules();

ALTER TABLE public.shooting_event_registration_stitches ADD COLUMN shooting_event_id uuid;
UPDATE public.shooting_event_registration_stitches c SET shooting_event_id=p.shooting_event_id FROM public.shooting_event_registrations p WHERE p.id=c.registration_id;
ALTER TABLE public.shooting_event_registration_stitches ALTER COLUMN shooting_event_id SET NOT NULL;
CREATE FUNCTION public.scope_registration_stitches() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $body$
DECLARE expected uuid;
BEGIN
  SELECT p.shooting_event_id INTO expected FROM public.shooting_event_registrations p WHERE p.id=NEW.registration_id;
  IF expected IS NULL OR (NEW.shooting_event_id IS NOT NULL AND NEW.shooting_event_id<>expected) THEN
    RAISE EXCEPTION 'Invalid or inaccessible event reference' USING ERRCODE='23514';
  END IF;
  NEW.shooting_event_id := expected;
  RETURN NEW;
END $body$;
REVOKE ALL ON FUNCTION public.scope_registration_stitches() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER a_event_scope BEFORE INSERT OR UPDATE OF registration_id, shooting_event_id ON public.shooting_event_registration_stitches
FOR EACH ROW EXECUTE FUNCTION public.scope_registration_stitches();

ALTER TABLE public.shooting_event_combination_stitches ADD COLUMN shooting_event_id uuid;
UPDATE public.shooting_event_combination_stitches c SET shooting_event_id=p.shooting_event_id FROM public.shooting_event_combinations p WHERE p.id=c.combination_id;
ALTER TABLE public.shooting_event_combination_stitches ALTER COLUMN shooting_event_id SET NOT NULL;
CREATE FUNCTION public.scope_combination_stitches() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $body$
DECLARE expected uuid;
BEGIN
  SELECT p.shooting_event_id INTO expected FROM public.shooting_event_combinations p WHERE p.id=NEW.combination_id;
  IF expected IS NULL OR (NEW.shooting_event_id IS NOT NULL AND NEW.shooting_event_id<>expected) THEN
    RAISE EXCEPTION 'Invalid or inaccessible event reference' USING ERRCODE='23514';
  END IF;
  NEW.shooting_event_id := expected;
  RETURN NEW;
END $body$;
REVOKE ALL ON FUNCTION public.scope_combination_stitches() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER a_event_scope BEFORE INSERT OR UPDATE OF combination_id, shooting_event_id ON public.shooting_event_combination_stitches
FOR EACH ROW EXECUTE FUNCTION public.scope_combination_stitches();

ALTER TABLE public.shooting_event_group_members ADD COLUMN shooting_event_id uuid;
UPDATE public.shooting_event_group_members c SET shooting_event_id=p.shooting_event_id FROM public.shooting_event_groups p WHERE p.id=c.group_id;
ALTER TABLE public.shooting_event_group_members ALTER COLUMN shooting_event_id SET NOT NULL;
CREATE FUNCTION public.scope_group_members() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $body$
DECLARE expected uuid;
BEGIN
  SELECT p.shooting_event_id INTO expected FROM public.shooting_event_groups p WHERE p.id=NEW.group_id;
  IF expected IS NULL OR (NEW.shooting_event_id IS NOT NULL AND NEW.shooting_event_id<>expected) THEN
    RAISE EXCEPTION 'Invalid or inaccessible event reference' USING ERRCODE='23514';
  END IF;
  NEW.shooting_event_id := expected;
  RETURN NEW;
END $body$;
REVOKE ALL ON FUNCTION public.scope_group_members() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER a_event_scope BEFORE INSERT OR UPDATE OF group_id, shooting_event_id ON public.shooting_event_group_members
FOR EACH ROW EXECUTE FUNCTION public.scope_group_members();

ALTER TABLE public.shooting_event_stitch_passes ADD COLUMN shooting_event_id uuid;
UPDATE public.shooting_event_stitch_passes c SET shooting_event_id=p.shooting_event_id FROM public.shooting_event_registration_stitches p WHERE p.id=c.registration_stitch_id;
ALTER TABLE public.shooting_event_stitch_passes ALTER COLUMN shooting_event_id SET NOT NULL;
CREATE FUNCTION public.scope_stitch_passes() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $body$
DECLARE expected uuid;
BEGIN
  SELECT p.shooting_event_id INTO expected FROM public.shooting_event_registration_stitches p WHERE p.id=NEW.registration_stitch_id;
  IF expected IS NULL OR (NEW.shooting_event_id IS NOT NULL AND NEW.shooting_event_id<>expected) THEN
    RAISE EXCEPTION 'Invalid or inaccessible event reference' USING ERRCODE='23514';
  END IF;
  NEW.shooting_event_id := expected;
  RETURN NEW;
END $body$;
REVOKE ALL ON FUNCTION public.scope_stitch_passes() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER a_event_scope BEFORE INSERT OR UPDATE OF registration_stitch_id, shooting_event_id ON public.shooting_event_stitch_passes
FOR EACH ROW EXECUTE FUNCTION public.scope_stitch_passes();

ALTER TABLE public.shooting_event_stitch_shots ADD COLUMN shooting_event_id uuid;
UPDATE public.shooting_event_stitch_shots c SET shooting_event_id=p.shooting_event_id FROM public.shooting_event_stitch_passes p WHERE p.id=c.pass_id;
ALTER TABLE public.shooting_event_stitch_shots ALTER COLUMN shooting_event_id SET NOT NULL;
CREATE FUNCTION public.scope_stitch_shots() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $body$
DECLARE expected uuid;
BEGIN
  SELECT p.shooting_event_id INTO expected FROM public.shooting_event_stitch_passes p WHERE p.id=NEW.pass_id;
  IF expected IS NULL OR (NEW.shooting_event_id IS NOT NULL AND NEW.shooting_event_id<>expected) THEN
    RAISE EXCEPTION 'Invalid or inaccessible event reference' USING ERRCODE='23514';
  END IF;
  NEW.shooting_event_id := expected;
  RETURN NEW;
END $body$;
REVOKE ALL ON FUNCTION public.scope_stitch_shots() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER a_event_scope BEFORE INSERT OR UPDATE OF pass_id, shooting_event_id ON public.shooting_event_stitch_shots
FOR EACH ROW EXECUTE FUNCTION public.scope_stitch_shots();

ALTER TABLE public.shooting_event_stitch_instant_payouts ADD COLUMN shooting_event_id uuid;
UPDATE public.shooting_event_stitch_instant_payouts c SET shooting_event_id=p.shooting_event_id FROM public.shooting_event_stitches p WHERE p.id=c.event_stitch_id;
ALTER TABLE public.shooting_event_stitch_instant_payouts ALTER COLUMN shooting_event_id SET NOT NULL;
CREATE FUNCTION public.scope_stitch_instant_payouts() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $body$
DECLARE expected uuid;
BEGIN
  SELECT p.shooting_event_id INTO expected FROM public.shooting_event_stitches p WHERE p.id=NEW.event_stitch_id;
  IF expected IS NULL OR (NEW.shooting_event_id IS NOT NULL AND NEW.shooting_event_id<>expected) THEN
    RAISE EXCEPTION 'Invalid or inaccessible event reference' USING ERRCODE='23514';
  END IF;
  NEW.shooting_event_id := expected;
  RETURN NEW;
END $body$;
REVOKE ALL ON FUNCTION public.scope_stitch_instant_payouts() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER a_event_scope BEFORE INSERT OR UPDATE OF event_stitch_id, shooting_event_id ON public.shooting_event_stitch_instant_payouts
FOR EACH ROW EXECUTE FUNCTION public.scope_stitch_instant_payouts();

ALTER TABLE public.shooting_event_stitch_payout_settlements ADD COLUMN shooting_event_id uuid;
UPDATE public.shooting_event_stitch_payout_settlements c SET shooting_event_id=p.shooting_event_id FROM public.shooting_event_stitches p WHERE p.id=c.event_stitch_id;
ALTER TABLE public.shooting_event_stitch_payout_settlements ALTER COLUMN shooting_event_id SET NOT NULL;
CREATE FUNCTION public.scope_stitch_payout_settlements() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $body$
DECLARE expected uuid;
BEGIN
  SELECT p.shooting_event_id INTO expected FROM public.shooting_event_stitches p WHERE p.id=NEW.event_stitch_id;
  IF expected IS NULL OR (NEW.shooting_event_id IS NOT NULL AND NEW.shooting_event_id<>expected) THEN
    RAISE EXCEPTION 'Invalid or inaccessible event reference' USING ERRCODE='23514';
  END IF;
  NEW.shooting_event_id := expected;
  RETURN NEW;
END $body$;
REVOKE ALL ON FUNCTION public.scope_stitch_payout_settlements() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER a_event_scope BEFORE INSERT OR UPDATE OF event_stitch_id, shooting_event_id ON public.shooting_event_stitch_payout_settlements
FOR EACH ROW EXECUTE FUNCTION public.scope_stitch_payout_settlements();

CREATE FUNCTION public.prevent_event_reassignment() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $body$
BEGIN
  IF NEW.shooting_event_id IS DISTINCT FROM OLD.shooting_event_id THEN
    RAISE EXCEPTION 'Existing rows cannot be moved to another event' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $body$;
REVOKE ALL ON FUNCTION public.prevent_event_reassignment() FROM PUBLIC,anon,authenticated;
ALTER TABLE public.shooting_event_categories ADD CONSTRAINT scope_categories_unique UNIQUE (id, shooting_event_id);
CREATE INDEX scope_categories_event_idx ON public.shooting_event_categories(shooting_event_id);
CREATE TRIGGER z_event_scope_immutable BEFORE UPDATE ON public.shooting_event_categories
FOR EACH ROW EXECUTE FUNCTION public.prevent_event_reassignment();
ALTER TABLE public.shooting_event_combination_stitches ADD CONSTRAINT scope_combination_stitches_unique UNIQUE (id, shooting_event_id);
CREATE INDEX scope_combination_stitches_event_idx ON public.shooting_event_combination_stitches(shooting_event_id);
CREATE TRIGGER z_event_scope_immutable BEFORE UPDATE ON public.shooting_event_combination_stitches
FOR EACH ROW EXECUTE FUNCTION public.prevent_event_reassignment();
ALTER TABLE public.shooting_event_combinations ADD CONSTRAINT scope_combinations_unique UNIQUE (id, shooting_event_id);
CREATE INDEX scope_combinations_event_idx ON public.shooting_event_combinations(shooting_event_id);
CREATE TRIGGER z_event_scope_immutable BEFORE UPDATE ON public.shooting_event_combinations
FOR EACH ROW EXECUTE FUNCTION public.prevent_event_reassignment();
ALTER TABLE public.shooting_event_group_members ADD CONSTRAINT scope_group_members_unique UNIQUE (id, shooting_event_id);
CREATE INDEX scope_group_members_event_idx ON public.shooting_event_group_members(shooting_event_id);
CREATE TRIGGER z_event_scope_immutable BEFORE UPDATE ON public.shooting_event_group_members
FOR EACH ROW EXECUTE FUNCTION public.prevent_event_reassignment();
ALTER TABLE public.shooting_event_groups ADD CONSTRAINT scope_groups_unique UNIQUE (id, shooting_event_id);
CREATE INDEX scope_groups_event_idx ON public.shooting_event_groups(shooting_event_id);
CREATE TRIGGER z_event_scope_immutable BEFORE UPDATE ON public.shooting_event_groups
FOR EACH ROW EXECUTE FUNCTION public.prevent_event_reassignment();
ALTER TABLE public.shooting_event_payouts ADD CONSTRAINT scope_payouts_unique UNIQUE (id, shooting_event_id);
CREATE INDEX scope_payouts_event_idx ON public.shooting_event_payouts(shooting_event_id);
CREATE TRIGGER z_event_scope_immutable BEFORE UPDATE ON public.shooting_event_payouts
FOR EACH ROW EXECUTE FUNCTION public.prevent_event_reassignment();
ALTER TABLE public.shooting_event_registration_stitches ADD CONSTRAINT scope_registration_stitches_unique UNIQUE (id, shooting_event_id);
CREATE INDEX scope_registration_stitches_event_idx ON public.shooting_event_registration_stitches(shooting_event_id);
CREATE TRIGGER z_event_scope_immutable BEFORE UPDATE ON public.shooting_event_registration_stitches
FOR EACH ROW EXECUTE FUNCTION public.prevent_event_reassignment();
ALTER TABLE public.shooting_event_registrations ADD CONSTRAINT scope_registrations_unique UNIQUE (id, shooting_event_id);
CREATE INDEX scope_registrations_event_idx ON public.shooting_event_registrations(shooting_event_id);
CREATE TRIGGER z_event_scope_immutable BEFORE UPDATE ON public.shooting_event_registrations
FOR EACH ROW EXECUTE FUNCTION public.prevent_event_reassignment();
ALTER TABLE public.shooting_event_stitch_blocks ADD CONSTRAINT scope_stitch_blocks_unique UNIQUE (id, shooting_event_id);
CREATE INDEX scope_stitch_blocks_event_idx ON public.shooting_event_stitch_blocks(shooting_event_id);
CREATE TRIGGER z_event_scope_immutable BEFORE UPDATE ON public.shooting_event_stitch_blocks
FOR EACH ROW EXECUTE FUNCTION public.prevent_event_reassignment();
ALTER TABLE public.shooting_event_stitch_instant_payout_rules ADD CONSTRAINT scope_stitch_instant_payout_rules_unique UNIQUE (id, shooting_event_id);
CREATE INDEX scope_stitch_instant_payout_rules_event_idx ON public.shooting_event_stitch_instant_payout_rules(shooting_event_id);
CREATE TRIGGER z_event_scope_immutable BEFORE UPDATE ON public.shooting_event_stitch_instant_payout_rules
FOR EACH ROW EXECUTE FUNCTION public.prevent_event_reassignment();
ALTER TABLE public.shooting_event_stitch_instant_payouts ADD CONSTRAINT scope_stitch_instant_payouts_unique UNIQUE (id, shooting_event_id);
CREATE INDEX scope_stitch_instant_payouts_event_idx ON public.shooting_event_stitch_instant_payouts(shooting_event_id);
CREATE TRIGGER z_event_scope_immutable BEFORE UPDATE ON public.shooting_event_stitch_instant_payouts
FOR EACH ROW EXECUTE FUNCTION public.prevent_event_reassignment();
ALTER TABLE public.shooting_event_stitch_passes ADD CONSTRAINT scope_stitch_passes_unique UNIQUE (id, shooting_event_id);
CREATE INDEX scope_stitch_passes_event_idx ON public.shooting_event_stitch_passes(shooting_event_id);
CREATE TRIGGER z_event_scope_immutable BEFORE UPDATE ON public.shooting_event_stitch_passes
FOR EACH ROW EXECUTE FUNCTION public.prevent_event_reassignment();
ALTER TABLE public.shooting_event_stitch_payout_settlements ADD CONSTRAINT scope_stitch_payout_settlements_unique UNIQUE (id, shooting_event_id);
CREATE INDEX scope_stitch_payout_settlements_event_idx ON public.shooting_event_stitch_payout_settlements(shooting_event_id);
CREATE TRIGGER z_event_scope_immutable BEFORE UPDATE ON public.shooting_event_stitch_payout_settlements
FOR EACH ROW EXECUTE FUNCTION public.prevent_event_reassignment();
ALTER TABLE public.shooting_event_stitch_shots ADD CONSTRAINT scope_stitch_shots_unique UNIQUE (id, shooting_event_id);
CREATE INDEX scope_stitch_shots_event_idx ON public.shooting_event_stitch_shots(shooting_event_id);
CREATE TRIGGER z_event_scope_immutable BEFORE UPDATE ON public.shooting_event_stitch_shots
FOR EACH ROW EXECUTE FUNCTION public.prevent_event_reassignment();
ALTER TABLE public.shooting_event_stitches ADD CONSTRAINT scope_stitches_unique UNIQUE (id, shooting_event_id);
CREATE INDEX scope_stitches_event_idx ON public.shooting_event_stitches(shooting_event_id);
CREATE TRIGGER z_event_scope_immutable BEFORE UPDATE ON public.shooting_event_stitches
FOR EACH ROW EXECUTE FUNCTION public.prevent_event_reassignment();
ALTER TABLE public.shooting_event_combination_stitches ADD CONSTRAINT scope_combination_stitches_combination_id
  FOREIGN KEY (combination_id, shooting_event_id) REFERENCES public.shooting_event_combinations(id, shooting_event_id);
ALTER TABLE public.shooting_event_combination_stitches ADD CONSTRAINT scope_combination_stitches_event_stitch_id
  FOREIGN KEY (event_stitch_id, shooting_event_id) REFERENCES public.shooting_event_stitches(id, shooting_event_id);
ALTER TABLE public.shooting_event_combinations ADD CONSTRAINT scope_combinations_tie_break_stitch_id
  FOREIGN KEY (tie_break_stitch_id, shooting_event_id) REFERENCES public.shooting_event_stitches(id, shooting_event_id);
ALTER TABLE public.shooting_event_group_members ADD CONSTRAINT scope_group_members_group_id
  FOREIGN KEY (group_id, shooting_event_id) REFERENCES public.shooting_event_groups(id, shooting_event_id);
ALTER TABLE public.shooting_event_group_members ADD CONSTRAINT scope_group_members_registration_id
  FOREIGN KEY (registration_id, shooting_event_id) REFERENCES public.shooting_event_registrations(id, shooting_event_id);
ALTER TABLE public.shooting_event_payouts ADD CONSTRAINT scope_payouts_combination_id
  FOREIGN KEY (combination_id, shooting_event_id) REFERENCES public.shooting_event_combinations(id, shooting_event_id);
ALTER TABLE public.shooting_event_payouts ADD CONSTRAINT scope_payouts_event_stitch_id
  FOREIGN KEY (event_stitch_id, shooting_event_id) REFERENCES public.shooting_event_stitches(id, shooting_event_id);
ALTER TABLE public.shooting_event_registration_stitches ADD CONSTRAINT scope_registration_stitches_event_stitch_id
  FOREIGN KEY (event_stitch_id, shooting_event_id) REFERENCES public.shooting_event_stitches(id, shooting_event_id);
ALTER TABLE public.shooting_event_registration_stitches ADD CONSTRAINT scope_registration_stitches_registration_id
  FOREIGN KEY (registration_id, shooting_event_id) REFERENCES public.shooting_event_registrations(id, shooting_event_id);
ALTER TABLE public.shooting_event_registrations ADD CONSTRAINT scope_registrations_category_id
  FOREIGN KEY (category_id, shooting_event_id) REFERENCES public.shooting_event_categories(id, shooting_event_id);
ALTER TABLE public.shooting_event_stitch_blocks ADD CONSTRAINT scope_stitch_blocks_event_stitch_id
  FOREIGN KEY (event_stitch_id, shooting_event_id) REFERENCES public.shooting_event_stitches(id, shooting_event_id);
ALTER TABLE public.shooting_event_stitch_instant_payout_rules ADD CONSTRAINT scope_stitch_instant_payout_rules_event_stitch_id
  FOREIGN KEY (event_stitch_id, shooting_event_id) REFERENCES public.shooting_event_stitches(id, shooting_event_id);
ALTER TABLE public.shooting_event_stitch_instant_payouts ADD CONSTRAINT scope_stitch_instant_payouts_event_stitch_id
  FOREIGN KEY (event_stitch_id, shooting_event_id) REFERENCES public.shooting_event_stitches(id, shooting_event_id);
ALTER TABLE public.shooting_event_stitch_instant_payouts ADD CONSTRAINT scope_stitch_instant_payouts_pass_id
  FOREIGN KEY (pass_id, shooting_event_id) REFERENCES public.shooting_event_stitch_passes(id, shooting_event_id);
ALTER TABLE public.shooting_event_stitch_instant_payouts ADD CONSTRAINT scope_stitch_instant_payouts_registration_id
  FOREIGN KEY (registration_id, shooting_event_id) REFERENCES public.shooting_event_registrations(id, shooting_event_id);
ALTER TABLE public.shooting_event_stitch_instant_payouts ADD CONSTRAINT scope_stitch_instant_payouts_rule_id
  FOREIGN KEY (rule_id, shooting_event_id) REFERENCES public.shooting_event_stitch_instant_payout_rules(id, shooting_event_id);
ALTER TABLE public.shooting_event_stitch_instant_payouts ADD CONSTRAINT scope_stitch_instant_payouts_shot_id
  FOREIGN KEY (shot_id, shooting_event_id) REFERENCES public.shooting_event_stitch_shots(id, shooting_event_id);
ALTER TABLE public.shooting_event_stitch_passes ADD CONSTRAINT scope_stitch_passes_registration_stitch_id
  FOREIGN KEY (registration_stitch_id, shooting_event_id) REFERENCES public.shooting_event_registration_stitches(id, shooting_event_id);
ALTER TABLE public.shooting_event_stitch_payout_settlements ADD CONSTRAINT scope_stitch_payout_settlements_event_stitch_id
  FOREIGN KEY (event_stitch_id, shooting_event_id) REFERENCES public.shooting_event_stitches(id, shooting_event_id);
ALTER TABLE public.shooting_event_stitch_payout_settlements ADD CONSTRAINT scope_stitch_payout_settlements_registration_id
  FOREIGN KEY (registration_id, shooting_event_id) REFERENCES public.shooting_event_registrations(id, shooting_event_id);
ALTER TABLE public.shooting_event_stitch_shots ADD CONSTRAINT scope_stitch_shots_block_id
  FOREIGN KEY (block_id, shooting_event_id) REFERENCES public.shooting_event_stitch_blocks(id, shooting_event_id);
ALTER TABLE public.shooting_event_stitch_shots ADD CONSTRAINT scope_stitch_shots_pass_id
  FOREIGN KEY (pass_id, shooting_event_id) REFERENCES public.shooting_event_stitch_passes(id, shooting_event_id);
ALTER TABLE public.shooting_events ADD CONSTRAINT scope_events_group_ranking_stitch_id
  FOREIGN KEY (group_ranking_stitch_id, id) REFERENCES public.shooting_event_stitches(id, shooting_event_id);

-- Replace all previous broad/UUID-specific event policies, not just add another OR branch.
DO $policies$
DECLARE t text; p record; c record;
BEGIN
  FOREACH t IN ARRAY ARRAY['shooting_event_categories','shooting_event_combination_stitches','shooting_event_combinations','shooting_event_group_members','shooting_event_groups','shooting_event_payouts','shooting_event_registration_stitches','shooting_event_registrations','shooting_event_stitch_blocks','shooting_event_stitch_instant_payout_rules','shooting_event_stitch_instant_payouts','shooting_event_stitch_passes','shooting_event_stitch_payout_settlements','shooting_event_stitch_shots','shooting_event_stitches','shooting_events','shooters'] LOOP
    FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename=t LOOP
      EXECUTE format('DROP POLICY %I ON public.%I',p.policyname,t);
    END LOOP;
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY',t);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC, anon, authenticated',t);
    -- Column privileges are independent of table privileges.
    FOR c IN SELECT attname FROM pg_attribute WHERE attrelid=to_regclass('public.'||t)
      AND attnum>0 AND NOT attisdropped LOOP
      EXECUTE format('REVOKE ALL (%I) ON public.%I FROM PUBLIC, anon, authenticated',c.attname,t);
    END LOOP;
    EXECUTE format('GRANT SELECT,INSERT,UPDATE,DELETE ON public.%I TO authenticated',t);
  END LOOP;
END $policies$;

CREATE POLICY event_owner ON public.shooting_events FOR ALL TO authenticated
  USING (owner_id = (SELECT auth.uid())) WITH CHECK (owner_id = (SELECT auth.uid()));
CREATE POLICY event_owner ON public.shooting_event_categories FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.shooting_events e WHERE e.id=shooting_event_categories.shooting_event_id AND e.owner_id=(SELECT auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.shooting_events e WHERE e.id=shooting_event_categories.shooting_event_id AND e.owner_id=(SELECT auth.uid())));
CREATE POLICY event_owner ON public.shooting_event_combination_stitches FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.shooting_events e WHERE e.id=shooting_event_combination_stitches.shooting_event_id AND e.owner_id=(SELECT auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.shooting_events e WHERE e.id=shooting_event_combination_stitches.shooting_event_id AND e.owner_id=(SELECT auth.uid())));
CREATE POLICY event_owner ON public.shooting_event_combinations FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.shooting_events e WHERE e.id=shooting_event_combinations.shooting_event_id AND e.owner_id=(SELECT auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.shooting_events e WHERE e.id=shooting_event_combinations.shooting_event_id AND e.owner_id=(SELECT auth.uid())));
CREATE POLICY event_owner ON public.shooting_event_group_members FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.shooting_events e WHERE e.id=shooting_event_group_members.shooting_event_id AND e.owner_id=(SELECT auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.shooting_events e WHERE e.id=shooting_event_group_members.shooting_event_id AND e.owner_id=(SELECT auth.uid())));
CREATE POLICY event_owner ON public.shooting_event_groups FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.shooting_events e WHERE e.id=shooting_event_groups.shooting_event_id AND e.owner_id=(SELECT auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.shooting_events e WHERE e.id=shooting_event_groups.shooting_event_id AND e.owner_id=(SELECT auth.uid())));
CREATE POLICY event_owner ON public.shooting_event_payouts FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.shooting_events e WHERE e.id=shooting_event_payouts.shooting_event_id AND e.owner_id=(SELECT auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.shooting_events e WHERE e.id=shooting_event_payouts.shooting_event_id AND e.owner_id=(SELECT auth.uid())));
CREATE POLICY event_owner ON public.shooting_event_registration_stitches FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.shooting_events e WHERE e.id=shooting_event_registration_stitches.shooting_event_id AND e.owner_id=(SELECT auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.shooting_events e WHERE e.id=shooting_event_registration_stitches.shooting_event_id AND e.owner_id=(SELECT auth.uid())));
CREATE POLICY event_owner ON public.shooting_event_registrations FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.shooting_events e WHERE e.id=shooting_event_registrations.shooting_event_id AND e.owner_id=(SELECT auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.shooting_events e WHERE e.id=shooting_event_registrations.shooting_event_id AND e.owner_id=(SELECT auth.uid())));
CREATE POLICY event_owner ON public.shooting_event_stitch_blocks FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.shooting_events e WHERE e.id=shooting_event_stitch_blocks.shooting_event_id AND e.owner_id=(SELECT auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.shooting_events e WHERE e.id=shooting_event_stitch_blocks.shooting_event_id AND e.owner_id=(SELECT auth.uid())));
CREATE POLICY event_owner ON public.shooting_event_stitch_instant_payout_rules FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.shooting_events e WHERE e.id=shooting_event_stitch_instant_payout_rules.shooting_event_id AND e.owner_id=(SELECT auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.shooting_events e WHERE e.id=shooting_event_stitch_instant_payout_rules.shooting_event_id AND e.owner_id=(SELECT auth.uid())));
CREATE POLICY event_owner ON public.shooting_event_stitch_instant_payouts FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.shooting_events e WHERE e.id=shooting_event_stitch_instant_payouts.shooting_event_id AND e.owner_id=(SELECT auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.shooting_events e WHERE e.id=shooting_event_stitch_instant_payouts.shooting_event_id AND e.owner_id=(SELECT auth.uid())));
CREATE POLICY event_owner ON public.shooting_event_stitch_passes FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.shooting_events e WHERE e.id=shooting_event_stitch_passes.shooting_event_id AND e.owner_id=(SELECT auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.shooting_events e WHERE e.id=shooting_event_stitch_passes.shooting_event_id AND e.owner_id=(SELECT auth.uid())));
CREATE POLICY event_owner ON public.shooting_event_stitch_payout_settlements FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.shooting_events e WHERE e.id=shooting_event_stitch_payout_settlements.shooting_event_id AND e.owner_id=(SELECT auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.shooting_events e WHERE e.id=shooting_event_stitch_payout_settlements.shooting_event_id AND e.owner_id=(SELECT auth.uid())));
CREATE POLICY event_owner ON public.shooting_event_stitch_shots FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.shooting_events e WHERE e.id=shooting_event_stitch_shots.shooting_event_id AND e.owner_id=(SELECT auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.shooting_events e WHERE e.id=shooting_event_stitch_shots.shooting_event_id AND e.owner_id=(SELECT auth.uid())));
CREATE POLICY event_owner ON public.shooting_event_stitches FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.shooting_events e WHERE e.id=shooting_event_stitches.shooting_event_id AND e.owner_id=(SELECT auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.shooting_events e WHERE e.id=shooting_event_stitches.shooting_event_id AND e.owner_id=(SELECT auth.uid())));

-- Personal shooter records cannot remain globally readable/writable. Historical
-- records stay ownerless; a user may read them only through their own registrations.
CREATE POLICY shooter_read ON public.shooters FOR SELECT TO authenticated USING (
  owner_id=(SELECT auth.uid()) OR EXISTS (
    SELECT 1 FROM public.shooting_event_registrations r WHERE r.shooter_id=shooters.id
  )
);
CREATE POLICY shooter_insert ON public.shooters FOR INSERT TO authenticated WITH CHECK (owner_id=(SELECT auth.uid()));
CREATE POLICY shooter_update ON public.shooters FOR UPDATE TO authenticated
  USING (owner_id=(SELECT auth.uid())) WITH CHECK (owner_id=(SELECT auth.uid()));
CREATE POLICY shooter_delete ON public.shooters FOR DELETE TO authenticated USING (owner_id=(SELECT auth.uid()));

-- BEFORE INSERT ensures a guessed foreign shooter UUID cannot grant itself visibility
-- by creating a new registration. Never SECURITY DEFINER.
CREATE FUNCTION public.check_registration_shooter_access() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $body$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.shooters s WHERE s.id=NEW.shooter_id) THEN
    RAISE EXCEPTION 'Invalid or inaccessible shooter' USING ERRCODE='42501';
  END IF;
  RETURN NEW;
END $body$;
REVOKE ALL ON FUNCTION public.check_registration_shooter_access() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER a_shooter_access BEFORE INSERT OR UPDATE OF shooter_id ON public.shooting_event_registrations
  FOR EACH ROW EXECUTE FUNCTION public.check_registration_shooter_access();

ALTER VIEW public.shooting_event_nachdoppel_evaluation SET (security_invoker=true, security_barrier=true);
REVOKE ALL ON public.shooting_event_nachdoppel_evaluation FROM PUBLIC, anon, authenticated;
REVOKE ALL (shooting_event_id) ON public.shooting_event_nachdoppel_evaluation FROM PUBLIC,anon,authenticated;
REVOKE ALL (registration_stitch_id) ON public.shooting_event_nachdoppel_evaluation FROM PUBLIC,anon,authenticated;
REVOKE ALL (shooter_id) ON public.shooting_event_nachdoppel_evaluation FROM PUBLIC,anon,authenticated;
REVOKE ALL (master_number) ON public.shooting_event_nachdoppel_evaluation FROM PUBLIC,anon,authenticated;
REVOKE ALL (first_name) ON public.shooting_event_nachdoppel_evaluation FROM PUBLIC,anon,authenticated;
REVOKE ALL (last_name) ON public.shooting_event_nachdoppel_evaluation FROM PUBLIC,anon,authenticated;
REVOKE ALL (birth_year) ON public.shooting_event_nachdoppel_evaluation FROM PUBLIC,anon,authenticated;
REVOKE ALL (shot_count) ON public.shooting_event_nachdoppel_evaluation FROM PUBLIC,anon,authenticated;
REVOKE ALL (best_five_total) ON public.shooting_event_nachdoppel_evaluation FROM PUBLIC,anon,authenticated;
REVOKE ALL (ranked_shots) ON public.shooting_event_nachdoppel_evaluation FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.shooting_event_nachdoppel_evaluation TO authenticated;
ALTER VIEW public.shooting_event_ranked_shots SET (security_invoker=true, security_barrier=true);
REVOKE ALL ON public.shooting_event_ranked_shots FROM PUBLIC, anon, authenticated;
REVOKE ALL (registration_stitch_id) ON public.shooting_event_ranked_shots FROM PUBLIC,anon,authenticated;
REVOKE ALL (shooting_event_id) ON public.shooting_event_ranked_shots FROM PUBLIC,anon,authenticated;
REVOKE ALL (shooter_id) ON public.shooting_event_ranked_shots FROM PUBLIC,anon,authenticated;
REVOKE ALL (master_number) ON public.shooting_event_ranked_shots FROM PUBLIC,anon,authenticated;
REVOKE ALL (first_name) ON public.shooting_event_ranked_shots FROM PUBLIC,anon,authenticated;
REVOKE ALL (last_name) ON public.shooting_event_ranked_shots FROM PUBLIC,anon,authenticated;
REVOKE ALL (birth_year) ON public.shooting_event_ranked_shots FROM PUBLIC,anon,authenticated;
REVOKE ALL (stitch_id) ON public.shooting_event_ranked_shots FROM PUBLIC,anon,authenticated;
REVOKE ALL (stitch_code) ON public.shooting_event_ranked_shots FROM PUBLIC,anon,authenticated;
REVOKE ALL (stitch_name) ON public.shooting_event_ranked_shots FROM PUBLIC,anon,authenticated;
REVOKE ALL (pass_number) ON public.shooting_event_ranked_shots FROM PUBLIC,anon,authenticated;
REVOKE ALL (shot_number) ON public.shooting_event_ranked_shots FROM PUBLIC,anon,authenticated;
REVOKE ALL (score) ON public.shooting_event_ranked_shots FROM PUBLIC,anon,authenticated;
REVOKE ALL (tie_break_score) ON public.shooting_event_ranked_shots FROM PUBLIC,anon,authenticated;
REVOKE ALL (score_rank) ON public.shooting_event_ranked_shots FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.shooting_event_ranked_shots TO authenticated;
ALTER VIEW public.shooting_event_ranking_base SET (security_invoker=true, security_barrier=true);
REVOKE ALL ON public.shooting_event_ranking_base FROM PUBLIC, anon, authenticated;
REVOKE ALL (shooting_event_id) ON public.shooting_event_ranking_base FROM PUBLIC,anon,authenticated;
REVOKE ALL (registration_stitch_id) ON public.shooting_event_ranking_base FROM PUBLIC,anon,authenticated;
REVOKE ALL (event_stitch_id) ON public.shooting_event_ranking_base FROM PUBLIC,anon,authenticated;
REVOKE ALL (stitch_name) ON public.shooting_event_ranking_base FROM PUBLIC,anon,authenticated;
REVOKE ALL (sort_order) ON public.shooting_event_ranking_base FROM PUBLIC,anon,authenticated;
REVOKE ALL (program_id) ON public.shooting_event_ranking_base FROM PUBLIC,anon,authenticated;
REVOKE ALL (program_code) ON public.shooting_event_ranking_base FROM PUBLIC,anon,authenticated;
REVOKE ALL (program_name) ON public.shooting_event_ranking_base FROM PUBLIC,anon,authenticated;
REVOKE ALL (scoring_type) ON public.shooting_event_ranking_base FROM PUBLIC,anon,authenticated;
REVOKE ALL (ranking_type) ON public.shooting_event_ranking_base FROM PUBLIC,anon,authenticated;
REVOKE ALL (best_n) ON public.shooting_event_ranking_base FROM PUBLIC,anon,authenticated;
REVOKE ALL (special_code) ON public.shooting_event_ranking_base FROM PUBLIC,anon,authenticated;
REVOKE ALL (registration_id) ON public.shooting_event_ranking_base FROM PUBLIC,anon,authenticated;
REVOKE ALL (shooter_id) ON public.shooting_event_ranking_base FROM PUBLIC,anon,authenticated;
REVOKE ALL (master_number) ON public.shooting_event_ranking_base FROM PUBLIC,anon,authenticated;
REVOKE ALL (first_name) ON public.shooting_event_ranking_base FROM PUBLIC,anon,authenticated;
REVOKE ALL (last_name) ON public.shooting_event_ranking_base FROM PUBLIC,anon,authenticated;
REVOKE ALL (birth_year) ON public.shooting_event_ranking_base FROM PUBLIC,anon,authenticated;
REVOKE ALL (weapon_id) ON public.shooting_event_ranking_base FROM PUBLIC,anon,authenticated;
REVOKE ALL (weapon_name) ON public.shooting_event_ranking_base FROM PUBLIC,anon,authenticated;
REVOKE ALL (status) ON public.shooting_event_ranking_base FROM PUBLIC,anon,authenticated;
REVOKE ALL (registered_passes) ON public.shooting_event_ranking_base FROM PUBLIC,anon,authenticated;
REVOKE ALL (pass_count) ON public.shooting_event_ranking_base FROM PUBLIC,anon,authenticated;
REVOKE ALL (shot_count) ON public.shooting_event_ranking_base FROM PUBLIC,anon,authenticated;
REVOKE ALL (total_score) ON public.shooting_event_ranking_base FROM PUBLIC,anon,authenticated;
REVOKE ALL (series_total) ON public.shooting_event_ranking_base FROM PUBLIC,anon,authenticated;
REVOKE ALL (tie_break_score) ON public.shooting_event_ranking_base FROM PUBLIC,anon,authenticated;
REVOKE ALL (hit_count) ON public.shooting_event_ranking_base FROM PUBLIC,anon,authenticated;
REVOKE ALL (ranked_shots) ON public.shooting_event_ranking_base FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.shooting_event_ranking_base TO authenticated;
ALTER VIEW public.shooting_event_ranking_glueck SET (security_invoker=true, security_barrier=true);
REVOKE ALL ON public.shooting_event_ranking_glueck FROM PUBLIC, anon, authenticated;
REVOKE ALL (shooting_event_id) ON public.shooting_event_ranking_glueck FROM PUBLIC,anon,authenticated;
REVOKE ALL (registration_stitch_id) ON public.shooting_event_ranking_glueck FROM PUBLIC,anon,authenticated;
REVOKE ALL (shooter_id) ON public.shooting_event_ranking_glueck FROM PUBLIC,anon,authenticated;
REVOKE ALL (master_number) ON public.shooting_event_ranking_glueck FROM PUBLIC,anon,authenticated;
REVOKE ALL (first_name) ON public.shooting_event_ranking_glueck FROM PUBLIC,anon,authenticated;
REVOKE ALL (last_name) ON public.shooting_event_ranking_glueck FROM PUBLIC,anon,authenticated;
REVOKE ALL (birth_year) ON public.shooting_event_ranking_glueck FROM PUBLIC,anon,authenticated;
REVOKE ALL (best_shot) ON public.shooting_event_ranking_glueck FROM PUBLIC,anon,authenticated;
REVOKE ALL (second_shot) ON public.shooting_event_ranking_glueck FROM PUBLIC,anon,authenticated;
REVOKE ALL (rank) ON public.shooting_event_ranking_glueck FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.shooting_event_ranking_glueck TO authenticated;
ALTER VIEW public.shooting_event_ranking_jm SET (security_invoker=true, security_barrier=true);
REVOKE ALL ON public.shooting_event_ranking_jm FROM PUBLIC, anon, authenticated;
REVOKE ALL (shooting_event_id) ON public.shooting_event_ranking_jm FROM PUBLIC,anon,authenticated;
REVOKE ALL (registration_stitch_id) ON public.shooting_event_ranking_jm FROM PUBLIC,anon,authenticated;
REVOKE ALL (shooter_id) ON public.shooting_event_ranking_jm FROM PUBLIC,anon,authenticated;
REVOKE ALL (master_number) ON public.shooting_event_ranking_jm FROM PUBLIC,anon,authenticated;
REVOKE ALL (first_name) ON public.shooting_event_ranking_jm FROM PUBLIC,anon,authenticated;
REVOKE ALL (last_name) ON public.shooting_event_ranking_jm FROM PUBLIC,anon,authenticated;
REVOKE ALL (birth_year) ON public.shooting_event_ranking_jm FROM PUBLIC,anon,authenticated;
REVOKE ALL (stitch_id) ON public.shooting_event_ranking_jm FROM PUBLIC,anon,authenticated;
REVOKE ALL (stitch_code) ON public.shooting_event_ranking_jm FROM PUBLIC,anon,authenticated;
REVOKE ALL (stitch_name) ON public.shooting_event_ranking_jm FROM PUBLIC,anon,authenticated;
REVOKE ALL (scoring_type) ON public.shooting_event_ranking_jm FROM PUBLIC,anon,authenticated;
REVOKE ALL (shot_count) ON public.shooting_event_ranking_jm FROM PUBLIC,anon,authenticated;
REVOKE ALL (total_score) ON public.shooting_event_ranking_jm FROM PUBLIC,anon,authenticated;
REVOKE ALL (shot_1) ON public.shooting_event_ranking_jm FROM PUBLIC,anon,authenticated;
REVOKE ALL (shot_2) ON public.shooting_event_ranking_jm FROM PUBLIC,anon,authenticated;
REVOKE ALL (shot_3) ON public.shooting_event_ranking_jm FROM PUBLIC,anon,authenticated;
REVOKE ALL (shot_4) ON public.shooting_event_ranking_jm FROM PUBLIC,anon,authenticated;
REVOKE ALL (shot_5) ON public.shooting_event_ranking_jm FROM PUBLIC,anon,authenticated;
REVOKE ALL (shot_6) ON public.shooting_event_ranking_jm FROM PUBLIC,anon,authenticated;
REVOKE ALL (shot_7) ON public.shooting_event_ranking_jm FROM PUBLIC,anon,authenticated;
REVOKE ALL (shot_8) ON public.shooting_event_ranking_jm FROM PUBLIC,anon,authenticated;
REVOKE ALL (shot_9) ON public.shooting_event_ranking_jm FROM PUBLIC,anon,authenticated;
REVOKE ALL (shot_10) ON public.shooting_event_ranking_jm FROM PUBLIC,anon,authenticated;
REVOKE ALL (rank) ON public.shooting_event_ranking_jm FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.shooting_event_ranking_jm TO authenticated;
ALTER VIEW public.shooting_event_ranking_kunst SET (security_invoker=true, security_barrier=true);
REVOKE ALL ON public.shooting_event_ranking_kunst FROM PUBLIC, anon, authenticated;
REVOKE ALL (shooting_event_id) ON public.shooting_event_ranking_kunst FROM PUBLIC,anon,authenticated;
REVOKE ALL (registration_stitch_id) ON public.shooting_event_ranking_kunst FROM PUBLIC,anon,authenticated;
REVOKE ALL (shooter_id) ON public.shooting_event_ranking_kunst FROM PUBLIC,anon,authenticated;
REVOKE ALL (master_number) ON public.shooting_event_ranking_kunst FROM PUBLIC,anon,authenticated;
REVOKE ALL (first_name) ON public.shooting_event_ranking_kunst FROM PUBLIC,anon,authenticated;
REVOKE ALL (last_name) ON public.shooting_event_ranking_kunst FROM PUBLIC,anon,authenticated;
REVOKE ALL (birth_year) ON public.shooting_event_ranking_kunst FROM PUBLIC,anon,authenticated;
REVOKE ALL (stitch_id) ON public.shooting_event_ranking_kunst FROM PUBLIC,anon,authenticated;
REVOKE ALL (stitch_code) ON public.shooting_event_ranking_kunst FROM PUBLIC,anon,authenticated;
REVOKE ALL (stitch_name) ON public.shooting_event_ranking_kunst FROM PUBLIC,anon,authenticated;
REVOKE ALL (scoring_type) ON public.shooting_event_ranking_kunst FROM PUBLIC,anon,authenticated;
REVOKE ALL (shot_count) ON public.shooting_event_ranking_kunst FROM PUBLIC,anon,authenticated;
REVOKE ALL (total_score) ON public.shooting_event_ranking_kunst FROM PUBLIC,anon,authenticated;
REVOKE ALL (shot_1) ON public.shooting_event_ranking_kunst FROM PUBLIC,anon,authenticated;
REVOKE ALL (shot_2) ON public.shooting_event_ranking_kunst FROM PUBLIC,anon,authenticated;
REVOKE ALL (shot_3) ON public.shooting_event_ranking_kunst FROM PUBLIC,anon,authenticated;
REVOKE ALL (shot_4) ON public.shooting_event_ranking_kunst FROM PUBLIC,anon,authenticated;
REVOKE ALL (shot_5) ON public.shooting_event_ranking_kunst FROM PUBLIC,anon,authenticated;
REVOKE ALL (shot_6) ON public.shooting_event_ranking_kunst FROM PUBLIC,anon,authenticated;
REVOKE ALL (shot_7) ON public.shooting_event_ranking_kunst FROM PUBLIC,anon,authenticated;
REVOKE ALL (shot_8) ON public.shooting_event_ranking_kunst FROM PUBLIC,anon,authenticated;
REVOKE ALL (shot_9) ON public.shooting_event_ranking_kunst FROM PUBLIC,anon,authenticated;
REVOKE ALL (shot_10) ON public.shooting_event_ranking_kunst FROM PUBLIC,anon,authenticated;
REVOKE ALL (rank) ON public.shooting_event_ranking_kunst FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.shooting_event_ranking_kunst TO authenticated;
ALTER VIEW public.shooting_event_ranking_militaer SET (security_invoker=true, security_barrier=true);
REVOKE ALL ON public.shooting_event_ranking_militaer FROM PUBLIC, anon, authenticated;
REVOKE ALL (shooting_event_id) ON public.shooting_event_ranking_militaer FROM PUBLIC,anon,authenticated;
REVOKE ALL (registration_stitch_id) ON public.shooting_event_ranking_militaer FROM PUBLIC,anon,authenticated;
REVOKE ALL (shooter_id) ON public.shooting_event_ranking_militaer FROM PUBLIC,anon,authenticated;
REVOKE ALL (master_number) ON public.shooting_event_ranking_militaer FROM PUBLIC,anon,authenticated;
REVOKE ALL (first_name) ON public.shooting_event_ranking_militaer FROM PUBLIC,anon,authenticated;
REVOKE ALL (last_name) ON public.shooting_event_ranking_militaer FROM PUBLIC,anon,authenticated;
REVOKE ALL (birth_year) ON public.shooting_event_ranking_militaer FROM PUBLIC,anon,authenticated;
REVOKE ALL (stitch_id) ON public.shooting_event_ranking_militaer FROM PUBLIC,anon,authenticated;
REVOKE ALL (stitch_code) ON public.shooting_event_ranking_militaer FROM PUBLIC,anon,authenticated;
REVOKE ALL (stitch_name) ON public.shooting_event_ranking_militaer FROM PUBLIC,anon,authenticated;
REVOKE ALL (scoring_type) ON public.shooting_event_ranking_militaer FROM PUBLIC,anon,authenticated;
REVOKE ALL (shot_count) ON public.shooting_event_ranking_militaer FROM PUBLIC,anon,authenticated;
REVOKE ALL (total_score) ON public.shooting_event_ranking_militaer FROM PUBLIC,anon,authenticated;
REVOKE ALL (shot_1) ON public.shooting_event_ranking_militaer FROM PUBLIC,anon,authenticated;
REVOKE ALL (shot_2) ON public.shooting_event_ranking_militaer FROM PUBLIC,anon,authenticated;
REVOKE ALL (shot_3) ON public.shooting_event_ranking_militaer FROM PUBLIC,anon,authenticated;
REVOKE ALL (shot_4) ON public.shooting_event_ranking_militaer FROM PUBLIC,anon,authenticated;
REVOKE ALL (shot_5) ON public.shooting_event_ranking_militaer FROM PUBLIC,anon,authenticated;
REVOKE ALL (shot_6) ON public.shooting_event_ranking_militaer FROM PUBLIC,anon,authenticated;
REVOKE ALL (shot_7) ON public.shooting_event_ranking_militaer FROM PUBLIC,anon,authenticated;
REVOKE ALL (shot_8) ON public.shooting_event_ranking_militaer FROM PUBLIC,anon,authenticated;
REVOKE ALL (shot_9) ON public.shooting_event_ranking_militaer FROM PUBLIC,anon,authenticated;
REVOKE ALL (shot_10) ON public.shooting_event_ranking_militaer FROM PUBLIC,anon,authenticated;
REVOKE ALL (rank) ON public.shooting_event_ranking_militaer FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.shooting_event_ranking_militaer TO authenticated;
ALTER VIEW public.shooting_event_ranking_nachdoppel SET (security_invoker=true, security_barrier=true);
REVOKE ALL ON public.shooting_event_ranking_nachdoppel FROM PUBLIC, anon, authenticated;
REVOKE ALL (shooting_event_id) ON public.shooting_event_ranking_nachdoppel FROM PUBLIC,anon,authenticated;
REVOKE ALL (registration_stitch_id) ON public.shooting_event_ranking_nachdoppel FROM PUBLIC,anon,authenticated;
REVOKE ALL (shooter_id) ON public.shooting_event_ranking_nachdoppel FROM PUBLIC,anon,authenticated;
REVOKE ALL (master_number) ON public.shooting_event_ranking_nachdoppel FROM PUBLIC,anon,authenticated;
REVOKE ALL (first_name) ON public.shooting_event_ranking_nachdoppel FROM PUBLIC,anon,authenticated;
REVOKE ALL (last_name) ON public.shooting_event_ranking_nachdoppel FROM PUBLIC,anon,authenticated;
REVOKE ALL (birth_year) ON public.shooting_event_ranking_nachdoppel FROM PUBLIC,anon,authenticated;
REVOKE ALL (shot_count) ON public.shooting_event_ranking_nachdoppel FROM PUBLIC,anon,authenticated;
REVOKE ALL (best_five_total) ON public.shooting_event_ranking_nachdoppel FROM PUBLIC,anon,authenticated;
REVOKE ALL (ranked_shots) ON public.shooting_event_ranking_nachdoppel FROM PUBLIC,anon,authenticated;
REVOKE ALL (rank) ON public.shooting_event_ranking_nachdoppel FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.shooting_event_ranking_nachdoppel TO authenticated;
ALTER VIEW public.shooting_event_ranking_ruetli SET (security_invoker=true, security_barrier=true);
REVOKE ALL ON public.shooting_event_ranking_ruetli FROM PUBLIC, anon, authenticated;
REVOKE ALL (shooting_event_id) ON public.shooting_event_ranking_ruetli FROM PUBLIC,anon,authenticated;
REVOKE ALL (registration_stitch_id) ON public.shooting_event_ranking_ruetli FROM PUBLIC,anon,authenticated;
REVOKE ALL (shooter_id) ON public.shooting_event_ranking_ruetli FROM PUBLIC,anon,authenticated;
REVOKE ALL (master_number) ON public.shooting_event_ranking_ruetli FROM PUBLIC,anon,authenticated;
REVOKE ALL (first_name) ON public.shooting_event_ranking_ruetli FROM PUBLIC,anon,authenticated;
REVOKE ALL (last_name) ON public.shooting_event_ranking_ruetli FROM PUBLIC,anon,authenticated;
REVOKE ALL (birth_year) ON public.shooting_event_ranking_ruetli FROM PUBLIC,anon,authenticated;
REVOKE ALL (shot_count) ON public.shooting_event_ranking_ruetli FROM PUBLIC,anon,authenticated;
REVOKE ALL (total_score) ON public.shooting_event_ranking_ruetli FROM PUBLIC,anon,authenticated;
REVOKE ALL (hit_count) ON public.shooting_event_ranking_ruetli FROM PUBLIC,anon,authenticated;
REVOKE ALL (ranking_total) ON public.shooting_event_ranking_ruetli FROM PUBLIC,anon,authenticated;
REVOKE ALL (ranked_shots) ON public.shooting_event_ranking_ruetli FROM PUBLIC,anon,authenticated;
REVOKE ALL (rank) ON public.shooting_event_ranking_ruetli FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.shooting_event_ranking_ruetli TO authenticated;
ALTER VIEW public.shooting_event_ranking_section SET (security_invoker=true, security_barrier=true);
REVOKE ALL ON public.shooting_event_ranking_section FROM PUBLIC, anon, authenticated;
REVOKE ALL (shooting_event_id) ON public.shooting_event_ranking_section FROM PUBLIC,anon,authenticated;
REVOKE ALL (registration_stitch_id) ON public.shooting_event_ranking_section FROM PUBLIC,anon,authenticated;
REVOKE ALL (shooter_id) ON public.shooting_event_ranking_section FROM PUBLIC,anon,authenticated;
REVOKE ALL (master_number) ON public.shooting_event_ranking_section FROM PUBLIC,anon,authenticated;
REVOKE ALL (first_name) ON public.shooting_event_ranking_section FROM PUBLIC,anon,authenticated;
REVOKE ALL (last_name) ON public.shooting_event_ranking_section FROM PUBLIC,anon,authenticated;
REVOKE ALL (birth_year) ON public.shooting_event_ranking_section FROM PUBLIC,anon,authenticated;
REVOKE ALL (total_score) ON public.shooting_event_ranking_section FROM PUBLIC,anon,authenticated;
REVOKE ALL (series_tie_break) ON public.shooting_event_ranking_section FROM PUBLIC,anon,authenticated;
REVOKE ALL (series_total) ON public.shooting_event_ranking_section FROM PUBLIC,anon,authenticated;
REVOKE ALL (rank) ON public.shooting_event_ranking_section FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.shooting_event_ranking_section TO authenticated;
ALTER VIEW public.shooting_event_ruetli_evaluation SET (security_invoker=true, security_barrier=true);
REVOKE ALL ON public.shooting_event_ruetli_evaluation FROM PUBLIC, anon, authenticated;
REVOKE ALL (shooting_event_id) ON public.shooting_event_ruetli_evaluation FROM PUBLIC,anon,authenticated;
REVOKE ALL (registration_stitch_id) ON public.shooting_event_ruetli_evaluation FROM PUBLIC,anon,authenticated;
REVOKE ALL (shooter_id) ON public.shooting_event_ruetli_evaluation FROM PUBLIC,anon,authenticated;
REVOKE ALL (master_number) ON public.shooting_event_ruetli_evaluation FROM PUBLIC,anon,authenticated;
REVOKE ALL (first_name) ON public.shooting_event_ruetli_evaluation FROM PUBLIC,anon,authenticated;
REVOKE ALL (last_name) ON public.shooting_event_ruetli_evaluation FROM PUBLIC,anon,authenticated;
REVOKE ALL (birth_year) ON public.shooting_event_ruetli_evaluation FROM PUBLIC,anon,authenticated;
REVOKE ALL (shot_count) ON public.shooting_event_ruetli_evaluation FROM PUBLIC,anon,authenticated;
REVOKE ALL (total_score) ON public.shooting_event_ruetli_evaluation FROM PUBLIC,anon,authenticated;
REVOKE ALL (hit_count) ON public.shooting_event_ruetli_evaluation FROM PUBLIC,anon,authenticated;
REVOKE ALL (ranking_total) ON public.shooting_event_ruetli_evaluation FROM PUBLIC,anon,authenticated;
REVOKE ALL (ranked_shots) ON public.shooting_event_ruetli_evaluation FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.shooting_event_ruetli_evaluation TO authenticated;
ALTER VIEW public.shooting_event_stitch_evaluation SET (security_invoker=true, security_barrier=true);
REVOKE ALL ON public.shooting_event_stitch_evaluation FROM PUBLIC, anon, authenticated;
REVOKE ALL (registration_stitch_id) ON public.shooting_event_stitch_evaluation FROM PUBLIC,anon,authenticated;
REVOKE ALL (registration_id) ON public.shooting_event_stitch_evaluation FROM PUBLIC,anon,authenticated;
REVOKE ALL (shooting_event_id) ON public.shooting_event_stitch_evaluation FROM PUBLIC,anon,authenticated;
REVOKE ALL (shooter_id) ON public.shooting_event_stitch_evaluation FROM PUBLIC,anon,authenticated;
REVOKE ALL (master_number) ON public.shooting_event_stitch_evaluation FROM PUBLIC,anon,authenticated;
REVOKE ALL (first_name) ON public.shooting_event_stitch_evaluation FROM PUBLIC,anon,authenticated;
REVOKE ALL (last_name) ON public.shooting_event_stitch_evaluation FROM PUBLIC,anon,authenticated;
REVOKE ALL (birth_year) ON public.shooting_event_stitch_evaluation FROM PUBLIC,anon,authenticated;
REVOKE ALL (stitch_id) ON public.shooting_event_stitch_evaluation FROM PUBLIC,anon,authenticated;
REVOKE ALL (stitch_code) ON public.shooting_event_stitch_evaluation FROM PUBLIC,anon,authenticated;
REVOKE ALL (stitch_name) ON public.shooting_event_stitch_evaluation FROM PUBLIC,anon,authenticated;
REVOKE ALL (scoring_type) ON public.shooting_event_stitch_evaluation FROM PUBLIC,anon,authenticated;
REVOKE ALL (ranking_mode) ON public.shooting_event_stitch_evaluation FROM PUBLIC,anon,authenticated;
REVOKE ALL (shot_count) ON public.shooting_event_stitch_evaluation FROM PUBLIC,anon,authenticated;
REVOKE ALL (total_score) ON public.shooting_event_stitch_evaluation FROM PUBLIC,anon,authenticated;
REVOKE ALL (series_total) ON public.shooting_event_stitch_evaluation FROM PUBLIC,anon,authenticated;
REVOKE ALL (series_tie_break) ON public.shooting_event_stitch_evaluation FROM PUBLIC,anon,authenticated;
REVOKE ALL (hit_count) ON public.shooting_event_stitch_evaluation FROM PUBLIC,anon,authenticated;
REVOKE ALL (best_shot) ON public.shooting_event_stitch_evaluation FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.shooting_event_stitch_evaluation TO authenticated;
ALTER VIEW public.shooting_event_total_stitch_evaluation SET (security_invoker=true, security_barrier=true);
REVOKE ALL ON public.shooting_event_total_stitch_evaluation FROM PUBLIC, anon, authenticated;
REVOKE ALL (shooting_event_id) ON public.shooting_event_total_stitch_evaluation FROM PUBLIC,anon,authenticated;
REVOKE ALL (registration_stitch_id) ON public.shooting_event_total_stitch_evaluation FROM PUBLIC,anon,authenticated;
REVOKE ALL (shooter_id) ON public.shooting_event_total_stitch_evaluation FROM PUBLIC,anon,authenticated;
REVOKE ALL (master_number) ON public.shooting_event_total_stitch_evaluation FROM PUBLIC,anon,authenticated;
REVOKE ALL (first_name) ON public.shooting_event_total_stitch_evaluation FROM PUBLIC,anon,authenticated;
REVOKE ALL (last_name) ON public.shooting_event_total_stitch_evaluation FROM PUBLIC,anon,authenticated;
REVOKE ALL (birth_year) ON public.shooting_event_total_stitch_evaluation FROM PUBLIC,anon,authenticated;
REVOKE ALL (stitch_id) ON public.shooting_event_total_stitch_evaluation FROM PUBLIC,anon,authenticated;
REVOKE ALL (stitch_code) ON public.shooting_event_total_stitch_evaluation FROM PUBLIC,anon,authenticated;
REVOKE ALL (stitch_name) ON public.shooting_event_total_stitch_evaluation FROM PUBLIC,anon,authenticated;
REVOKE ALL (scoring_type) ON public.shooting_event_total_stitch_evaluation FROM PUBLIC,anon,authenticated;
REVOKE ALL (shot_count) ON public.shooting_event_total_stitch_evaluation FROM PUBLIC,anon,authenticated;
REVOKE ALL (total_score) ON public.shooting_event_total_stitch_evaluation FROM PUBLIC,anon,authenticated;
REVOKE ALL (shot_1) ON public.shooting_event_total_stitch_evaluation FROM PUBLIC,anon,authenticated;
REVOKE ALL (shot_2) ON public.shooting_event_total_stitch_evaluation FROM PUBLIC,anon,authenticated;
REVOKE ALL (shot_3) ON public.shooting_event_total_stitch_evaluation FROM PUBLIC,anon,authenticated;
REVOKE ALL (shot_4) ON public.shooting_event_total_stitch_evaluation FROM PUBLIC,anon,authenticated;
REVOKE ALL (shot_5) ON public.shooting_event_total_stitch_evaluation FROM PUBLIC,anon,authenticated;
REVOKE ALL (shot_6) ON public.shooting_event_total_stitch_evaluation FROM PUBLIC,anon,authenticated;
REVOKE ALL (shot_7) ON public.shooting_event_total_stitch_evaluation FROM PUBLIC,anon,authenticated;
REVOKE ALL (shot_8) ON public.shooting_event_total_stitch_evaluation FROM PUBLIC,anon,authenticated;
REVOKE ALL (shot_9) ON public.shooting_event_total_stitch_evaluation FROM PUBLIC,anon,authenticated;
REVOKE ALL (shot_10) ON public.shooting_event_total_stitch_evaluation FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.shooting_event_total_stitch_evaluation TO authenticated;

CREATE OR REPLACE FUNCTION public.delete_shooting_event(p_event_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY INVOKER
 SET search_path = ''
AS $function$
begin
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501';
  END IF;
  PERFORM 1 FROM public.shooting_events WHERE id=p_event_id AND owner_id=auth.uid() FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Event not found or not accessible' USING ERRCODE='42501';
  END IF;
  -- Gruppenmitglieder
  delete from public.shooting_event_group_members
  where group_id in (
    select id
    from public.shooting_event_groups
    where shooting_event_id = p_event_id
  );

  -- Gruppen
  delete from public.shooting_event_groups
  where shooting_event_id = p_event_id;

  -- Kombinationen / Tagessieger
  delete from public.shooting_event_combination_stitches
  where combination_id in (
    select id
    from public.shooting_event_combinations
    where shooting_event_id = p_event_id
  );

  delete from public.shooting_event_combinations
  where shooting_event_id = p_event_id;

  -- Schüsse
  delete from public.shooting_event_stitch_shots
  where pass_id in (
    select p.id
    from public.shooting_event_stitch_passes p
    join public.shooting_event_registration_stitches rs
      on rs.id = p.registration_stitch_id
    join public.shooting_event_registrations r
      on r.id = rs.registration_id
    where r.shooting_event_id = p_event_id
  );

  -- Passen
  delete from public.shooting_event_stitch_passes
  where registration_stitch_id in (
    select rs.id
    from public.shooting_event_registration_stitches rs
    join public.shooting_event_registrations r
      on r.id = rs.registration_id
    where r.shooting_event_id = p_event_id
  );

  -- Gelöste Stiche
  delete from public.shooting_event_registration_stitches
  where registration_id in (
    select id
    from public.shooting_event_registrations
    where shooting_event_id = p_event_id
  );

  -- Teilnehmer des Anlasses
  delete from public.shooting_event_registrations
  where shooting_event_id = p_event_id;

  -- Referenz der Gruppenrangliste zuerst lösen
  update public.shooting_events
  set group_ranking_stitch_id = null
  where id = p_event_id;

  -- Schussblöcke
  delete from public.shooting_event_stitch_blocks
  where event_stitch_id in (
    select id
    from public.shooting_event_stitches
    where shooting_event_id = p_event_id
  );

  -- Stiche des Anlasses
  delete from public.shooting_event_stitches
  where shooting_event_id = p_event_id;

  DELETE FROM public.shooting_event_payouts WHERE shooting_event_id=p_event_id;
  DELETE FROM public.shooting_event_categories WHERE shooting_event_id=p_event_id;

  -- Anlass selbst
  delete from public.shooting_events
  where id = p_event_id;
end;
$function$
;
REVOKE ALL ON FUNCTION public.delete_shooting_event(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.delete_shooting_event(uuid) TO authenticated;
ALTER FUNCTION public.check_event_stitch_pass_limit() SET search_path = '';
REVOKE ALL ON FUNCTION public.check_event_stitch_pass_limit() FROM PUBLIC,anon,authenticated;
ALTER FUNCTION public.check_event_stitch_score() SET search_path = '';
REVOKE ALL ON FUNCTION public.check_event_stitch_score() FROM PUBLIC,anon,authenticated;
ALTER FUNCTION public.check_event_stitch_shot_limit() SET search_path = '';
REVOKE ALL ON FUNCTION public.check_event_stitch_shot_limit() FROM PUBLIC,anon,authenticated;

-- No owner backfill here. Ownership must be independently confirmed per event.
DO $verify$
DECLARE r record; actual bigint;
BEGIN
  FOR r IN SELECT * FROM event_migration_counts LOOP
    EXECUTE format('SELECT count(*) FROM public.%I',r.table_name) INTO actual;
    IF actual<>r.row_count THEN RAISE EXCEPTION 'Unexpected row count change: %',r.table_name; END IF;
  END LOOP;
  IF EXISTS(SELECT 1 FROM public.shooting_events WHERE owner_id IS NOT NULL)
     OR EXISTS(SELECT 1 FROM public.shooters WHERE owner_id IS NOT NULL) THEN
    RAISE EXCEPTION 'Migration must not assign an owner to any existing record';
  END IF;
END $verify$;
NOTIFY pgrst, 'reload schema';
COMMIT;
