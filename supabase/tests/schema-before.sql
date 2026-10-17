-- Test-only reconstruction of the supplied schema. Never run against production.
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;
CREATE SCHEMA auth;
CREATE TABLE auth.users(id uuid PRIMARY KEY);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
$$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
GRANT USAGE ON SCHEMA auth,public TO anon,authenticated;
GRANT EXECUTE ON FUNCTION auth.uid() TO anon,authenticated;
CREATE SEQUENCE public.shooter_master_number_seq;
GRANT USAGE ON SEQUENCE public.shooter_master_number_seq TO authenticated;
CREATE TABLE public.clubs (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  name text NOT NULL,
  city text,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.competition_weapons (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  name text NOT NULL,
  active boolean DEFAULT true NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.shooters (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  master_number integer DEFAULT nextval('shooter_master_number_seq'::regclass) NOT NULL,
  first_name text NOT NULL,
  last_name text NOT NULL,
  birth_year integer,
  birth_date date,
  club_id uuid,
  active boolean DEFAULT true NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.shooting_event_categories (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  shooting_event_id uuid NOT NULL,
  code text NOT NULL,
  name text NOT NULL,
  min_age integer NOT NULL,
  max_age integer,
  sort_order integer DEFAULT 0 NOT NULL
);
CREATE TABLE public.shooting_event_combination_stitches (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  combination_id uuid NOT NULL,
  event_stitch_id uuid NOT NULL,
  weight_percent numeric(6,3) DEFAULT 100 NOT NULL,
  sort_order integer DEFAULT 0 NOT NULL
);
CREATE TABLE public.shooting_event_combinations (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  shooting_event_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  active boolean DEFAULT true NOT NULL,
  sort_order integer DEFAULT 0 NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  tie_break_mode text DEFAULT 'age_older'::text NOT NULL,
  tie_break_stitch_id uuid
);
CREATE TABLE public.shooting_event_group_members (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  group_id uuid NOT NULL,
  registration_id uuid NOT NULL,
  sort_order integer DEFAULT 0 NOT NULL
);
CREATE TABLE public.shooting_event_groups (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  shooting_event_id uuid NOT NULL,
  name text NOT NULL,
  max_members integer,
  active boolean DEFAULT true NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.shooting_event_payouts (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  shooting_event_id uuid NOT NULL,
  event_stitch_id uuid,
  combination_id uuid,
  group_ranking boolean DEFAULT false NOT NULL,
  rank_from integer NOT NULL,
  rank_to integer NOT NULL,
  amount_chf numeric(10,2) NOT NULL,
  description text,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.shooting_event_registration_stitches (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  registration_id uuid NOT NULL,
  event_stitch_id uuid NOT NULL,
  weapon_id_override uuid,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  status text DEFAULT 'registered'::text NOT NULL,
  registered_passes integer DEFAULT 1 NOT NULL,
  price_override_chf numeric,
  additional_pass_price_override_chf numeric
);
CREATE TABLE public.shooting_event_registrations (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  shooting_event_id uuid NOT NULL,
  shooter_id uuid NOT NULL,
  category text,
  weapon_id uuid,
  notes text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  category_id uuid,
  club_id uuid,
  start_number integer
);
CREATE TABLE public.shooting_event_stitch_blocks (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  event_stitch_id uuid NOT NULL,
  block_number integer NOT NULL,
  block_type text NOT NULL,
  shot_count integer NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.shooting_event_stitch_instant_payout_rules (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  event_stitch_id uuid NOT NULL,
  score numeric(8,2) NOT NULL,
  sort_order integer DEFAULT 0 NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  first_amount_chf numeric(10,2) NOT NULL,
  repeat_amount_chf numeric(10,2) NOT NULL
);
CREATE TABLE public.shooting_event_stitch_instant_payouts (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  event_stitch_id uuid NOT NULL,
  registration_id uuid NOT NULL,
  pass_id uuid,
  shot_id uuid,
  rule_id uuid,
  score numeric(8,2) NOT NULL,
  occurrence integer NOT NULL,
  amount_chf numeric(10,2) NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.shooting_event_stitch_passes (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  registration_stitch_id uuid NOT NULL,
  pass_number integer NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  status text DEFAULT 'open'::text NOT NULL,
  completed_at timestamp with time zone
);
CREATE TABLE public.shooting_event_stitch_payout_settlements (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  event_stitch_id uuid NOT NULL,
  registration_id uuid NOT NULL,
  rank integer,
  ranking_payout_chf numeric(10,2) DEFAULT 0 NOT NULL,
  instant_payout_chf numeric(10,2) DEFAULT 0 NOT NULL,
  total_payout_chf numeric(10,2) DEFAULT 0 NOT NULL,
  finalized_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.shooting_event_stitch_shots (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  pass_id uuid NOT NULL,
  shot_number integer NOT NULL,
  score integer NOT NULL,
  x_position numeric,
  y_position numeric,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  tie_break_score integer,
  block_id uuid
);
CREATE TABLE public.shooting_event_stitches (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  shooting_event_id uuid NOT NULL,
  name text NOT NULL,
  code text NOT NULL,
  sort_order integer DEFAULT 0 NOT NULL,
  scoring_type text NOT NULL,
  shots_per_pass integer,
  max_passes integer,
  ranking_mode text NOT NULL,
  active boolean DEFAULT true NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  program_id uuid,
  price_chf numeric(10,2) DEFAULT 0 NOT NULL,
  additional_pass_price_chf numeric(10,2) DEFAULT 0 NOT NULL,
  jj_price_chf numeric,
  jj_additional_pass_price_chf numeric,
  payout_enabled boolean DEFAULT false NOT NULL,
  payout_percentage numeric(5,2) DEFAULT 60 NOT NULL,
  payout_winner_mode text DEFAULT 'fraction'::text NOT NULL,
  payout_winner_numerator integer DEFAULT 2 NOT NULL,
  payout_winner_denominator integer DEFAULT 3 NOT NULL,
  payout_fixed_winner_count integer,
  payout_min_first_chf numeric(10,2),
  payout_min_second_chf numeric(10,2),
  payout_min_third_chf numeric(10,2),
  payout_min_last_chf numeric(10,2),
  payout_step_chf numeric(10,2) DEFAULT 1.00 NOT NULL,
  payout_curve_exponent numeric(6,3) DEFAULT 0.600 NOT NULL,
  payout_instant_max_chf numeric(10,2)
);
CREATE TABLE public.shooting_events (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  club_id uuid NOT NULL,
  name text NOT NULL,
  event_date date NOT NULL,
  shooting_range_id uuid,
  distance_m integer DEFAULT 300 NOT NULL,
  notes text,
  status text DEFAULT 'draft'::text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  group_ranking_stitch_id uuid
);
CREATE TABLE public.shooting_programs (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  code text NOT NULL,
  name text NOT NULL,
  scoring_type text NOT NULL,
  single_shots integer DEFAULT 0 NOT NULL,
  series_shots integer DEFAULT 0 NOT NULL,
  ranking_type text NOT NULL,
  best_n integer,
  special_code text,
  active boolean DEFAULT true NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.shooting_ranges (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  name text NOT NULL,
  address text,
  postal_code text,
  city text,
  latitude numeric,
  longitude numeric,
  distance_m integer,
  notes text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  active boolean DEFAULT true NOT NULL
);
ALTER TABLE public.clubs ADD CONSTRAINT clubs_pkey PRIMARY KEY (id);
ALTER TABLE public.competition_weapons ADD CONSTRAINT competition_weapons_name_key UNIQUE (name);
ALTER TABLE public.competition_weapons ADD CONSTRAINT competition_weapons_pkey PRIMARY KEY (id);
ALTER TABLE public.shooters ADD CONSTRAINT shooters_birth_year_check CHECK (((birth_year IS NULL) OR ((birth_year >= 1900) AND (birth_year <= 2100))));
ALTER TABLE public.shooters ADD CONSTRAINT shooters_master_number_unique UNIQUE (master_number);
ALTER TABLE public.shooters ADD CONSTRAINT shooters_pkey PRIMARY KEY (id);
ALTER TABLE public.shooting_event_categories ADD CONSTRAINT shooting_event_categories_pkey PRIMARY KEY (id);
ALTER TABLE public.shooting_event_categories ADD CONSTRAINT shooting_event_categories_shooting_event_id_code_key UNIQUE (shooting_event_id, code);
ALTER TABLE public.shooting_event_combination_stitches ADD CONSTRAINT shooting_event_combination_st_combination_id_event_stitch_i_key UNIQUE (combination_id, event_stitch_id);
ALTER TABLE public.shooting_event_combination_stitches ADD CONSTRAINT shooting_event_combination_stitches_pkey PRIMARY KEY (id);
ALTER TABLE public.shooting_event_combinations ADD CONSTRAINT shooting_event_combinations_pkey PRIMARY KEY (id);
ALTER TABLE public.shooting_event_combinations ADD CONSTRAINT shooting_event_combinations_tie_break_mode_check CHECK ((tie_break_mode = ANY (ARRAY['age_older'::text, 'age_younger'::text, 'stitch'::text, 'alphabetical'::text])));
ALTER TABLE public.shooting_event_group_members ADD CONSTRAINT shooting_event_group_members_group_id_registration_id_key UNIQUE (group_id, registration_id);
ALTER TABLE public.shooting_event_group_members ADD CONSTRAINT shooting_event_group_members_pkey PRIMARY KEY (id);
ALTER TABLE public.shooting_event_groups ADD CONSTRAINT shooting_event_groups_pkey PRIMARY KEY (id);
ALTER TABLE public.shooting_event_groups ADD CONSTRAINT shooting_event_groups_shooting_event_id_name_key UNIQUE (shooting_event_id, name);
ALTER TABLE public.shooting_event_payouts ADD CONSTRAINT shooting_event_payouts_amount_chf_check CHECK ((amount_chf >= (0)::numeric));
ALTER TABLE public.shooting_event_payouts ADD CONSTRAINT shooting_event_payouts_check CHECK ((rank_to >= rank_from));
ALTER TABLE public.shooting_event_payouts ADD CONSTRAINT shooting_event_payouts_pkey PRIMARY KEY (id);
ALTER TABLE public.shooting_event_payouts ADD CONSTRAINT shooting_event_payouts_rank_from_check CHECK ((rank_from >= 1));
ALTER TABLE public.shooting_event_registration_stitches ADD CONSTRAINT shooting_event_registration_stitches_pkey PRIMARY KEY (id);
ALTER TABLE public.shooting_event_registration_stitches ADD CONSTRAINT shooting_event_registration_stitches_registered_passes_check CHECK ((registered_passes >= 1));
ALTER TABLE public.shooting_event_registration_stitches ADD CONSTRAINT shooting_event_registration_stitches_status_check CHECK ((status = ANY (ARRAY['registered'::text, 'started'::text, 'completed'::text, 'dns'::text])));
ALTER TABLE public.shooting_event_registration_stitches ADD CONSTRAINT shooting_event_registration_stitches_unique UNIQUE (registration_id, event_stitch_id);
ALTER TABLE public.shooting_event_registrations ADD CONSTRAINT shooting_event_registration_unique UNIQUE (shooting_event_id, shooter_id);
ALTER TABLE public.shooting_event_registrations ADD CONSTRAINT shooting_event_registrations_pkey PRIMARY KEY (id);
ALTER TABLE public.shooting_event_stitch_blocks ADD CONSTRAINT shooting_event_stitch_blocks_block_type_check CHECK ((block_type = ANY (ARRAY['single'::text, 'series'::text])));
ALTER TABLE public.shooting_event_stitch_blocks ADD CONSTRAINT shooting_event_stitch_blocks_pkey PRIMARY KEY (id);
ALTER TABLE public.shooting_event_stitch_blocks ADD CONSTRAINT shooting_event_stitch_blocks_shot_count_check CHECK ((shot_count > 0));
ALTER TABLE public.shooting_event_stitch_blocks ADD CONSTRAINT shooting_event_stitch_blocks_unique UNIQUE (event_stitch_id, block_number);
ALTER TABLE public.shooting_event_stitch_instant_payout_rules ADD CONSTRAINT shooting_event_stitch_instant_payout_rules_first_amount_check CHECK ((first_amount_chf >= (0)::numeric));
ALTER TABLE public.shooting_event_stitch_instant_payout_rules ADD CONSTRAINT shooting_event_stitch_instant_payout_rules_pkey PRIMARY KEY (id);
ALTER TABLE public.shooting_event_stitch_instant_payout_rules ADD CONSTRAINT shooting_event_stitch_instant_payout_rules_repeat_amount_check CHECK ((repeat_amount_chf >= (0)::numeric));
ALTER TABLE public.shooting_event_stitch_instant_payouts ADD CONSTRAINT shooting_event_stitch_instant_payouts_pkey PRIMARY KEY (id);
ALTER TABLE public.shooting_event_stitch_passes ADD CONSTRAINT shooting_event_stitch_passes_number_check CHECK ((pass_number >= 1));
ALTER TABLE public.shooting_event_stitch_passes ADD CONSTRAINT shooting_event_stitch_passes_pkey PRIMARY KEY (id);
ALTER TABLE public.shooting_event_stitch_passes ADD CONSTRAINT shooting_event_stitch_passes_status_check CHECK ((status = ANY (ARRAY['open'::text, 'completed'::text])));
ALTER TABLE public.shooting_event_stitch_passes ADD CONSTRAINT shooting_event_stitch_passes_unique UNIQUE (registration_stitch_id, pass_number);
ALTER TABLE public.shooting_event_stitch_payout_settlements ADD CONSTRAINT shooting_event_stitch_payout__event_stitch_id_registration__key UNIQUE (event_stitch_id, registration_id);
ALTER TABLE public.shooting_event_stitch_payout_settlements ADD CONSTRAINT shooting_event_stitch_payout_settlements_pkey PRIMARY KEY (id);
ALTER TABLE public.shooting_event_stitch_shots ADD CONSTRAINT shooting_event_stitch_shots_number_check CHECK ((shot_number >= 1));
ALTER TABLE public.shooting_event_stitch_shots ADD CONSTRAINT shooting_event_stitch_shots_pkey PRIMARY KEY (id);
ALTER TABLE public.shooting_event_stitch_shots ADD CONSTRAINT shooting_event_stitch_shots_score_check CHECK (((score >= 0) AND (score <= 100)));
ALTER TABLE public.shooting_event_stitch_shots ADD CONSTRAINT shooting_event_stitch_shots_tie_break_score_check CHECK (((tie_break_score IS NULL) OR ((tie_break_score >= 0) AND (tie_break_score <= 100))));
ALTER TABLE public.shooting_event_stitch_shots ADD CONSTRAINT shooting_event_stitch_shots_unique UNIQUE (pass_id, shot_number);
ALTER TABLE public.shooting_event_stitches ADD CONSTRAINT shooting_event_stitches_payout_instant_max_check CHECK (((payout_instant_max_chf IS NULL) OR (payout_instant_max_chf >= (0)::numeric)));
ALTER TABLE public.shooting_event_stitches ADD CONSTRAINT shooting_event_stitches_payout_percentage_check CHECK (((payout_percentage >= (0)::numeric) AND (payout_percentage <= (100)::numeric)));
ALTER TABLE public.shooting_event_stitches ADD CONSTRAINT shooting_event_stitches_payout_step_check CHECK ((payout_step_chf > (0)::numeric));
ALTER TABLE public.shooting_event_stitches ADD CONSTRAINT shooting_event_stitches_payout_winner_mode_check CHECK ((payout_winner_mode = ANY (ARRAY['fraction'::text, 'fixed'::text, 'all'::text])));
ALTER TABLE public.shooting_event_stitches ADD CONSTRAINT shooting_event_stitches_pkey PRIMARY KEY (id);
ALTER TABLE public.shooting_event_stitches ADD CONSTRAINT shooting_event_stitches_scoring_type_check CHECK ((scoring_type = ANY (ARRAY['A5'::text, 'A10'::text, 'A100'::text])));
ALTER TABLE public.shooting_event_stitches ADD CONSTRAINT shooting_event_stitches_unique UNIQUE (shooting_event_id, code);
ALTER TABLE public.shooting_events ADD CONSTRAINT shooting_events_pkey PRIMARY KEY (id);
ALTER TABLE public.shooting_events ADD CONSTRAINT shooting_events_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'open'::text, 'completed'::text])));
ALTER TABLE public.shooting_programs ADD CONSTRAINT shooting_programs_best_n_check CHECK ((((ranking_type = 'best_n'::text) AND (best_n IS NOT NULL) AND (best_n > 0)) OR ((ranking_type <> 'best_n'::text) AND (best_n IS NULL))));
ALTER TABLE public.shooting_programs ADD CONSTRAINT shooting_programs_code_key UNIQUE (code);
ALTER TABLE public.shooting_programs ADD CONSTRAINT shooting_programs_pkey PRIMARY KEY (id);
ALTER TABLE public.shooting_programs ADD CONSTRAINT shooting_programs_ranking_type_check CHECK ((ranking_type = ANY (ARRAY['total'::text, 'best'::text, 'best_n'::text, 'section'::text, 'special'::text])));
ALTER TABLE public.shooting_programs ADD CONSTRAINT shooting_programs_scoring_type_check CHECK ((scoring_type = ANY (ARRAY['A5'::text, 'A10'::text, 'A100'::text, 'SPECIAL'::text])));
ALTER TABLE public.shooting_programs ADD CONSTRAINT shooting_programs_series_shots_check CHECK ((series_shots >= 0));
ALTER TABLE public.shooting_programs ADD CONSTRAINT shooting_programs_single_shots_check CHECK ((single_shots >= 0));
ALTER TABLE public.shooting_ranges ADD CONSTRAINT shooting_ranges_pkey PRIMARY KEY (id);
ALTER TABLE public.shooters ADD CONSTRAINT shooters_club_id_fkey FOREIGN KEY (club_id) REFERENCES clubs(id);
ALTER TABLE public.shooting_event_categories ADD CONSTRAINT shooting_event_categories_shooting_event_id_fkey FOREIGN KEY (shooting_event_id) REFERENCES shooting_events(id) ON DELETE CASCADE;
ALTER TABLE public.shooting_event_combination_stitches ADD CONSTRAINT shooting_event_combination_stitches_combination_id_fkey FOREIGN KEY (combination_id) REFERENCES shooting_event_combinations(id) ON DELETE CASCADE;
ALTER TABLE public.shooting_event_combination_stitches ADD CONSTRAINT shooting_event_combination_stitches_event_stitch_id_fkey FOREIGN KEY (event_stitch_id) REFERENCES shooting_event_stitches(id) ON DELETE CASCADE;
ALTER TABLE public.shooting_event_combinations ADD CONSTRAINT shooting_event_combinations_shooting_event_id_fkey FOREIGN KEY (shooting_event_id) REFERENCES shooting_events(id) ON DELETE CASCADE;
ALTER TABLE public.shooting_event_combinations ADD CONSTRAINT shooting_event_combinations_tie_break_stitch_id_fkey FOREIGN KEY (tie_break_stitch_id) REFERENCES shooting_event_stitches(id) ON DELETE SET NULL;
ALTER TABLE public.shooting_event_group_members ADD CONSTRAINT shooting_event_group_members_group_id_fkey FOREIGN KEY (group_id) REFERENCES shooting_event_groups(id) ON DELETE CASCADE;
ALTER TABLE public.shooting_event_group_members ADD CONSTRAINT shooting_event_group_members_registration_id_fkey FOREIGN KEY (registration_id) REFERENCES shooting_event_registrations(id) ON DELETE CASCADE;
ALTER TABLE public.shooting_event_groups ADD CONSTRAINT shooting_event_groups_shooting_event_id_fkey FOREIGN KEY (shooting_event_id) REFERENCES shooting_events(id) ON DELETE CASCADE;
ALTER TABLE public.shooting_event_payouts ADD CONSTRAINT shooting_event_payouts_combination_id_fkey FOREIGN KEY (combination_id) REFERENCES shooting_event_combinations(id) ON DELETE CASCADE;
ALTER TABLE public.shooting_event_payouts ADD CONSTRAINT shooting_event_payouts_event_stitch_id_fkey FOREIGN KEY (event_stitch_id) REFERENCES shooting_event_stitches(id) ON DELETE CASCADE;
ALTER TABLE public.shooting_event_payouts ADD CONSTRAINT shooting_event_payouts_shooting_event_id_fkey FOREIGN KEY (shooting_event_id) REFERENCES shooting_events(id) ON DELETE CASCADE;
ALTER TABLE public.shooting_event_registration_stitches ADD CONSTRAINT shooting_event_registration_stitches_event_stitch_id_fkey FOREIGN KEY (event_stitch_id) REFERENCES shooting_event_stitches(id) ON DELETE CASCADE;
ALTER TABLE public.shooting_event_registration_stitches ADD CONSTRAINT shooting_event_registration_stitches_registration_id_fkey FOREIGN KEY (registration_id) REFERENCES shooting_event_registrations(id) ON DELETE CASCADE;
ALTER TABLE public.shooting_event_registration_stitches ADD CONSTRAINT shooting_event_registration_stitches_weapon_id_override_fkey FOREIGN KEY (weapon_id_override) REFERENCES competition_weapons(id);
ALTER TABLE public.shooting_event_registrations ADD CONSTRAINT shooting_event_registrations_category_id_fkey FOREIGN KEY (category_id) REFERENCES shooting_event_categories(id);
ALTER TABLE public.shooting_event_registrations ADD CONSTRAINT shooting_event_registrations_club_id_fkey FOREIGN KEY (club_id) REFERENCES clubs(id);
ALTER TABLE public.shooting_event_registrations ADD CONSTRAINT shooting_event_registrations_shooter_id_fkey FOREIGN KEY (shooter_id) REFERENCES shooters(id);
ALTER TABLE public.shooting_event_registrations ADD CONSTRAINT shooting_event_registrations_shooting_event_id_fkey FOREIGN KEY (shooting_event_id) REFERENCES shooting_events(id) ON DELETE CASCADE;
ALTER TABLE public.shooting_event_registrations ADD CONSTRAINT shooting_event_registrations_weapon_id_fkey FOREIGN KEY (weapon_id) REFERENCES competition_weapons(id);
ALTER TABLE public.shooting_event_stitch_blocks ADD CONSTRAINT shooting_event_stitch_blocks_event_stitch_id_fkey FOREIGN KEY (event_stitch_id) REFERENCES shooting_event_stitches(id) ON DELETE CASCADE;
ALTER TABLE public.shooting_event_stitch_instant_payout_rules ADD CONSTRAINT shooting_event_stitch_instant_payout_rules_event_stitch_id_fkey FOREIGN KEY (event_stitch_id) REFERENCES shooting_event_stitches(id) ON DELETE CASCADE;
ALTER TABLE public.shooting_event_stitch_instant_payouts ADD CONSTRAINT shooting_event_stitch_instant_payouts_event_stitch_id_fkey FOREIGN KEY (event_stitch_id) REFERENCES shooting_event_stitches(id) ON DELETE CASCADE;
ALTER TABLE public.shooting_event_stitch_instant_payouts ADD CONSTRAINT shooting_event_stitch_instant_payouts_pass_id_fkey FOREIGN KEY (pass_id) REFERENCES shooting_event_stitch_passes(id) ON DELETE SET NULL;
ALTER TABLE public.shooting_event_stitch_instant_payouts ADD CONSTRAINT shooting_event_stitch_instant_payouts_registration_id_fkey FOREIGN KEY (registration_id) REFERENCES shooting_event_registrations(id) ON DELETE CASCADE;
ALTER TABLE public.shooting_event_stitch_instant_payouts ADD CONSTRAINT shooting_event_stitch_instant_payouts_rule_id_fkey FOREIGN KEY (rule_id) REFERENCES shooting_event_stitch_instant_payout_rules(id) ON DELETE SET NULL;
ALTER TABLE public.shooting_event_stitch_instant_payouts ADD CONSTRAINT shooting_event_stitch_instant_payouts_shot_id_fkey FOREIGN KEY (shot_id) REFERENCES shooting_event_stitch_shots(id) ON DELETE SET NULL;
ALTER TABLE public.shooting_event_stitch_passes ADD CONSTRAINT shooting_event_stitch_passes_registration_stitch_id_fkey FOREIGN KEY (registration_stitch_id) REFERENCES shooting_event_registration_stitches(id) ON DELETE CASCADE;
ALTER TABLE public.shooting_event_stitch_payout_settlements ADD CONSTRAINT shooting_event_stitch_payout_settlements_event_stitch_id_fkey FOREIGN KEY (event_stitch_id) REFERENCES shooting_event_stitches(id) ON DELETE CASCADE;
ALTER TABLE public.shooting_event_stitch_payout_settlements ADD CONSTRAINT shooting_event_stitch_payout_settlements_registration_id_fkey FOREIGN KEY (registration_id) REFERENCES shooting_event_registrations(id) ON DELETE CASCADE;
ALTER TABLE public.shooting_event_stitch_shots ADD CONSTRAINT shooting_event_stitch_shots_block_id_fkey FOREIGN KEY (block_id) REFERENCES shooting_event_stitch_blocks(id);
ALTER TABLE public.shooting_event_stitch_shots ADD CONSTRAINT shooting_event_stitch_shots_pass_id_fkey FOREIGN KEY (pass_id) REFERENCES shooting_event_stitch_passes(id) ON DELETE CASCADE;
ALTER TABLE public.shooting_event_stitches ADD CONSTRAINT shooting_event_stitches_program_id_fkey FOREIGN KEY (program_id) REFERENCES shooting_programs(id);
ALTER TABLE public.shooting_event_stitches ADD CONSTRAINT shooting_event_stitches_shooting_event_id_fkey FOREIGN KEY (shooting_event_id) REFERENCES shooting_events(id) ON DELETE CASCADE;
ALTER TABLE public.shooting_events ADD CONSTRAINT shooting_events_club_id_fkey FOREIGN KEY (club_id) REFERENCES clubs(id);
ALTER TABLE public.shooting_events ADD CONSTRAINT shooting_events_group_ranking_stitch_id_fkey FOREIGN KEY (group_ranking_stitch_id) REFERENCES shooting_event_stitches(id) ON DELETE SET NULL;
ALTER TABLE public.shooting_events ADD CONSTRAINT shooting_events_shooting_range_id_fkey FOREIGN KEY (shooting_range_id) REFERENCES shooting_ranges(id);
CREATE OR REPLACE FUNCTION public.check_event_stitch_pass_limit()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
declare
  allowed_passes integer;
  current_passes integer;
begin
  select s.max_passes
  into allowed_passes
  from public.shooting_event_registration_stitches rs
  join public.shooting_event_stitches s
    on s.id = rs.event_stitch_id
  where rs.id = new.registration_stitch_id;

  if allowed_passes is null then
    raise exception 'Maximale Anzahl Passen ist nicht definiert.';
  end if;

  select count(*)
  into current_passes
  from public.shooting_event_stitch_passes p
  where p.registration_stitch_id = new.registration_stitch_id
    and p.id <> coalesce(new.id, gen_random_uuid());

  if current_passes >= allowed_passes then
    raise exception
      'Maximal % Passen für diesen Stich erlaubt.',
      allowed_passes;
  end if;

  if new.pass_number > allowed_passes then
    raise exception
      'Passe % ist nicht erlaubt. Maximal % Passen.',
      new.pass_number,
      allowed_passes;
  end if;

  return new;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.check_event_stitch_score()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
declare
  scoring text;
  max_score integer;
begin
  select s.scoring_type
  into scoring
  from public.shooting_event_stitch_passes p
  join public.shooting_event_registration_stitches rs
    on rs.id = p.registration_stitch_id
  join public.shooting_event_stitches s
    on s.id = rs.event_stitch_id
  where p.id = new.pass_id;

  max_score :=
    case scoring
      when 'A5' then 5
      when 'A10' then 10
      when 'A100' then 100
      else 100
    end;

  if new.score < 0 or new.score > max_score then
    raise exception
      'Punktzahl % ist für % nicht erlaubt.',
      new.score,
      scoring;
  end if;

  return new;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.delete_shooting_event(p_event_id uuid)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
begin
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

  -- Anlass selbst
  delete from public.shooting_events
  where id = p_event_id;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.check_event_stitch_shot_limit()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
    allowed_shots integer;
    v_special_code text;
BEGIN
    SELECT
        s.shots_per_pass,
        sp.special_code
    INTO
        allowed_shots,
        v_special_code
    FROM public.shooting_event_stitch_passes p
    JOIN public.shooting_event_registration_stitches rs
        ON rs.id = p.registration_stitch_id
    JOIN public.shooting_event_stitches s
        ON s.id = rs.event_stitch_id
    LEFT JOIN public.shooting_programs sp
        ON sp.id = s.program_id
    WHERE p.id = NEW.pass_id;

    -- Rütli verwendet eine eigene Schussfolge.
    IF v_special_code = 'RUETLI' THEN
        IF NEW.shot_number < 1 OR NEW.shot_number > 15 THEN
            RAISE EXCEPTION
                'Rütli: Schussnummer % ist nicht erlaubt.',
                NEW.shot_number;
        END IF;

        RETURN NEW;
    END IF;

    -- Normale Stiche wie bisher prüfen.
    IF allowed_shots IS NULL THEN
        RAISE EXCEPTION
            'Anzahl Schüsse pro Passe ist nicht definiert.';
    END IF;

    IF NEW.shot_number < 1 OR NEW.shot_number > allowed_shots THEN
        RAISE EXCEPTION
            'Schussnummer % ist nicht erlaubt. Diese Passe hat % Schüsse.',
            NEW.shot_number,
            allowed_shots;
    END IF;

    RETURN NEW;
END;
$function$
;
CREATE TRIGGER trg_check_event_stitch_pass_limit BEFORE INSERT OR UPDATE ON public.shooting_event_stitch_passes FOR EACH ROW EXECUTE FUNCTION check_event_stitch_pass_limit();
CREATE TRIGGER trg_check_event_stitch_score BEFORE INSERT OR UPDATE ON public.shooting_event_stitch_shots FOR EACH ROW EXECUTE FUNCTION check_event_stitch_score();
CREATE TRIGGER trg_check_event_stitch_shot_limit BEFORE INSERT OR UPDATE ON public.shooting_event_stitch_shots FOR EACH ROW EXECUTE FUNCTION check_event_stitch_shot_limit();
CREATE VIEW public.shooting_event_ranked_shots AS  SELECT rs.id AS registration_stitch_id,
    r.shooting_event_id,
    sh.id AS shooter_id,
    sh.master_number,
    sh.first_name,
    sh.last_name,
    sh.birth_year,
    s.id AS stitch_id,
    s.code AS stitch_code,
    s.name AS stitch_name,
    p.pass_number,
    ss.shot_number,
    ss.score,
    ss.tie_break_score,
    row_number() OVER (PARTITION BY rs.id ORDER BY ss.score DESC, p.pass_number, ss.shot_number) AS score_rank
   FROM shooting_event_registration_stitches rs
     JOIN shooting_event_registrations r ON r.id = rs.registration_id
     JOIN shooters sh ON sh.id = r.shooter_id
     JOIN shooting_event_stitches s ON s.id = rs.event_stitch_id
     JOIN shooting_event_stitch_passes p ON p.registration_stitch_id = rs.id
     JOIN shooting_event_stitch_shots ss ON ss.pass_id = p.id;;
CREATE VIEW public.shooting_event_ranking_base AS  SELECT r.shooting_event_id,
    rs.id AS registration_stitch_id,
    rs.event_stitch_id,
    st.name AS stitch_name,
    st.sort_order,
    st.program_id,
    p.code AS program_code,
    p.name AS program_name,
    p.scoring_type,
    p.ranking_type,
    p.best_n,
    p.special_code,
    r.id AS registration_id,
    r.shooter_id,
    s.master_number,
    s.first_name,
    s.last_name,
    s.birth_year,
    COALESCE(rs.weapon_id_override, r.weapon_id) AS weapon_id,
    w.name AS weapon_name,
    rs.status,
    rs.registered_passes,
    count(DISTINCT pa.id) AS pass_count,
    count(sh.id) AS shot_count,
    COALESCE(sum(sh.score), 0::bigint)::integer AS total_score,
    COALESCE(sum(sh.score) FILTER (WHERE b.block_type = 'series'::text), 0::bigint)::integer AS series_total,
    max(sh.tie_break_score) AS tie_break_score,
    count(sh.id) FILTER (WHERE sh.score > 0)::integer AS hit_count,
    COALESCE(array_agg(sh.score ORDER BY sh.score DESC, sh.shot_number) FILTER (WHERE sh.id IS NOT NULL), '{}'::integer[]) AS ranked_shots
   FROM shooting_event_registration_stitches rs
     JOIN shooting_event_registrations r ON r.id = rs.registration_id
     JOIN shooters s ON s.id = r.shooter_id
     JOIN shooting_event_stitches st ON st.id = rs.event_stitch_id
     LEFT JOIN shooting_programs p ON p.id = st.program_id
     LEFT JOIN competition_weapons w ON w.id = COALESCE(rs.weapon_id_override, r.weapon_id)
     LEFT JOIN shooting_event_stitch_passes pa ON pa.registration_stitch_id = rs.id
     LEFT JOIN shooting_event_stitch_shots sh ON sh.pass_id = pa.id
     LEFT JOIN shooting_event_stitch_blocks b ON b.id = sh.block_id
  GROUP BY r.shooting_event_id, rs.id, rs.event_stitch_id, st.name, st.sort_order, st.program_id, p.code, p.name, p.scoring_type, p.ranking_type, p.best_n, p.special_code, r.id, r.shooter_id, s.master_number, s.first_name, s.last_name, s.birth_year, (COALESCE(rs.weapon_id_override, r.weapon_id)), w.name, rs.status, rs.registered_passes;;
CREATE VIEW public.shooting_event_stitch_evaluation AS  SELECT rs.id AS registration_stitch_id,
    r.id AS registration_id,
    r.shooting_event_id,
    sh.id AS shooter_id,
    sh.master_number,
    sh.first_name,
    sh.last_name,
    sh.birth_year,
    s.id AS stitch_id,
    s.code AS stitch_code,
    s.name AS stitch_name,
    s.scoring_type,
    s.ranking_mode,
    count(ss.id) AS shot_count,
    COALESCE(sum(ss.score), 0::bigint) AS total_score,
    COALESCE(sum(ss.score) FILTER (WHERE b.block_type = 'series'::text), 0::bigint) AS series_total,
    max(ss.tie_break_score) FILTER (WHERE b.block_type = 'series'::text) AS series_tie_break,
    count(ss.id) FILTER (WHERE ss.score > 0) AS hit_count,
    max(ss.score) AS best_shot
   FROM shooting_event_registration_stitches rs
     JOIN shooting_event_registrations r ON r.id = rs.registration_id
     JOIN shooters sh ON sh.id = r.shooter_id
     JOIN shooting_event_stitches s ON s.id = rs.event_stitch_id
     LEFT JOIN shooting_event_stitch_passes p ON p.registration_stitch_id = rs.id
     LEFT JOIN shooting_event_stitch_shots ss ON ss.pass_id = p.id
     LEFT JOIN shooting_event_stitch_blocks b ON b.id = ss.block_id
  GROUP BY rs.id, r.id, r.shooting_event_id, sh.id, sh.master_number, sh.first_name, sh.last_name, sh.birth_year, s.id, s.code, s.name, s.scoring_type, s.ranking_mode;;
CREATE VIEW public.shooting_event_nachdoppel_evaluation WITH (security_invoker=true) AS  SELECT e.shooting_event_id,
    e.registration_stitch_id,
    e.shooter_id,
    e.master_number,
    e.first_name,
    e.last_name,
    e.birth_year,
    e.shot_count,
    COALESCE(sum(rs.score) FILTER (WHERE rs.score_rank <= 5), 0::bigint) AS best_five_total,
    array_agg(rs.score ORDER BY rs.score_rank) AS ranked_shots
   FROM shooting_event_stitch_evaluation e
     JOIN shooting_event_ranked_shots rs ON rs.registration_stitch_id = e.registration_stitch_id
  WHERE e.stitch_code = 'NACHDOPPEL'::text
  GROUP BY e.shooting_event_id, e.registration_stitch_id, e.shooter_id, e.master_number, e.first_name, e.last_name, e.birth_year, e.shot_count;;
CREATE VIEW public.shooting_event_ranking_glueck AS  SELECT x.shooting_event_id,
    x.registration_stitch_id,
    x.shooter_id,
    x.master_number,
    x.first_name,
    x.last_name,
    x.birth_year,
    max(rs.score) FILTER (WHERE rs.score_rank = 1) AS best_shot,
    max(rs.score) FILTER (WHERE rs.score_rank = 2) AS second_shot,
    row_number() OVER (PARTITION BY x.shooting_event_id ORDER BY (max(rs.score) FILTER (WHERE rs.score_rank = 1)) DESC NULLS LAST, (max(rs.score) FILTER (WHERE rs.score_rank = 2)) DESC NULLS LAST, x.birth_year, x.master_number) AS rank
   FROM shooting_event_stitch_evaluation x
     JOIN shooting_event_ranked_shots rs ON rs.registration_stitch_id = x.registration_stitch_id
  WHERE x.stitch_code = 'GLUECK'::text AND x.shot_count = 2
  GROUP BY x.shooting_event_id, x.registration_stitch_id, x.shooter_id, x.master_number, x.first_name, x.last_name, x.birth_year;;
CREATE VIEW public.shooting_event_ranking_nachdoppel AS  SELECT shooting_event_id,
    registration_stitch_id,
    shooter_id,
    master_number,
    first_name,
    last_name,
    birth_year,
    shot_count,
    best_five_total,
    ranked_shots,
    row_number() OVER (PARTITION BY shooting_event_id ORDER BY best_five_total DESC, ranked_shots DESC, birth_year, master_number) AS rank
   FROM shooting_event_nachdoppel_evaluation n
  WHERE shot_count >= 5;;
CREATE VIEW public.shooting_event_ranking_section AS  SELECT shooting_event_id,
    registration_stitch_id,
    shooter_id,
    master_number,
    first_name,
    last_name,
    birth_year,
    total_score,
    series_tie_break,
    series_total,
    row_number() OVER (PARTITION BY shooting_event_id ORDER BY total_score DESC, series_tie_break DESC NULLS LAST, series_total DESC, birth_year, master_number) AS rank
   FROM shooting_event_stitch_evaluation e
  WHERE stitch_code = 'SEKTION'::text AND shot_count = 8;;
CREATE VIEW public.shooting_event_ruetli_evaluation AS  SELECT e.shooting_event_id,
    e.registration_stitch_id,
    e.shooter_id,
    e.master_number,
    e.first_name,
    e.last_name,
    e.birth_year,
    e.shot_count,
    e.total_score,
    e.hit_count,
    e.total_score + e.hit_count AS ranking_total,
    array_agg(rs.score ORDER BY rs.score DESC) AS ranked_shots
   FROM shooting_event_stitch_evaluation e
     JOIN shooting_event_ranked_shots rs ON rs.registration_stitch_id = e.registration_stitch_id
  WHERE e.stitch_code = 'RUETLI'::text AND e.shot_count = 15
  GROUP BY e.shooting_event_id, e.registration_stitch_id, e.shooter_id, e.master_number, e.first_name, e.last_name, e.birth_year, e.shot_count, e.total_score, e.hit_count;;
CREATE VIEW public.shooting_event_ranking_ruetli AS  SELECT shooting_event_id,
    registration_stitch_id,
    shooter_id,
    master_number,
    first_name,
    last_name,
    birth_year,
    shot_count,
    total_score,
    hit_count,
    ranking_total,
    ranked_shots,
    row_number() OVER (PARTITION BY shooting_event_id ORDER BY ranking_total DESC, ranked_shots DESC, birth_year, master_number) AS rank
   FROM shooting_event_ruetli_evaluation r;;
CREATE VIEW public.shooting_event_total_stitch_evaluation AS  SELECT e.shooting_event_id,
    e.registration_stitch_id,
    e.shooter_id,
    e.master_number,
    e.first_name,
    e.last_name,
    e.birth_year,
    e.stitch_id,
    e.stitch_code,
    e.stitch_name,
    e.scoring_type,
    e.shot_count,
    e.total_score,
    max(rs.score) FILTER (WHERE rs.score_rank = 1) AS shot_1,
    max(rs.score) FILTER (WHERE rs.score_rank = 2) AS shot_2,
    max(rs.score) FILTER (WHERE rs.score_rank = 3) AS shot_3,
    max(rs.score) FILTER (WHERE rs.score_rank = 4) AS shot_4,
    max(rs.score) FILTER (WHERE rs.score_rank = 5) AS shot_5,
    max(rs.score) FILTER (WHERE rs.score_rank = 6) AS shot_6,
    max(rs.score) FILTER (WHERE rs.score_rank = 7) AS shot_7,
    max(rs.score) FILTER (WHERE rs.score_rank = 8) AS shot_8,
    max(rs.score) FILTER (WHERE rs.score_rank = 9) AS shot_9,
    max(rs.score) FILTER (WHERE rs.score_rank = 10) AS shot_10
   FROM shooting_event_stitch_evaluation e
     LEFT JOIN shooting_event_ranked_shots rs ON rs.registration_stitch_id = e.registration_stitch_id
  WHERE e.stitch_code = ANY (ARRAY['KUNST'::text, 'MILITAER'::text, 'JM'::text])
  GROUP BY e.shooting_event_id, e.registration_stitch_id, e.shooter_id, e.master_number, e.first_name, e.last_name, e.birth_year, e.stitch_id, e.stitch_code, e.stitch_name, e.scoring_type, e.shot_count, e.total_score;;
CREATE VIEW public.shooting_event_ranking_jm AS  SELECT shooting_event_id,
    registration_stitch_id,
    shooter_id,
    master_number,
    first_name,
    last_name,
    birth_year,
    stitch_id,
    stitch_code,
    stitch_name,
    scoring_type,
    shot_count,
    total_score,
    shot_1,
    shot_2,
    shot_3,
    shot_4,
    shot_5,
    shot_6,
    shot_7,
    shot_8,
    shot_9,
    shot_10,
    row_number() OVER (PARTITION BY shooting_event_id ORDER BY total_score DESC, shot_1 DESC NULLS LAST, shot_2 DESC NULLS LAST, shot_3 DESC NULLS LAST, shot_4 DESC NULLS LAST, shot_5 DESC NULLS LAST, shot_6 DESC NULLS LAST, shot_7 DESC NULLS LAST, shot_8 DESC NULLS LAST, shot_9 DESC NULLS LAST, shot_10 DESC NULLS LAST, birth_year, master_number) AS rank
   FROM shooting_event_total_stitch_evaluation x
  WHERE stitch_code = 'JM'::text AND shot_count = 10;;
CREATE VIEW public.shooting_event_ranking_kunst AS  SELECT shooting_event_id,
    registration_stitch_id,
    shooter_id,
    master_number,
    first_name,
    last_name,
    birth_year,
    stitch_id,
    stitch_code,
    stitch_name,
    scoring_type,
    shot_count,
    total_score,
    shot_1,
    shot_2,
    shot_3,
    shot_4,
    shot_5,
    shot_6,
    shot_7,
    shot_8,
    shot_9,
    shot_10,
    row_number() OVER (PARTITION BY shooting_event_id ORDER BY total_score DESC, shot_1 DESC NULLS LAST, shot_2 DESC NULLS LAST, shot_3 DESC NULLS LAST, shot_4 DESC NULLS LAST, shot_5 DESC NULLS LAST, birth_year, master_number) AS rank
   FROM shooting_event_total_stitch_evaluation x
  WHERE stitch_code = 'KUNST'::text AND shot_count = 5;;
CREATE VIEW public.shooting_event_ranking_militaer AS  SELECT shooting_event_id,
    registration_stitch_id,
    shooter_id,
    master_number,
    first_name,
    last_name,
    birth_year,
    stitch_id,
    stitch_code,
    stitch_name,
    scoring_type,
    shot_count,
    total_score,
    shot_1,
    shot_2,
    shot_3,
    shot_4,
    shot_5,
    shot_6,
    shot_7,
    shot_8,
    shot_9,
    shot_10,
    row_number() OVER (PARTITION BY shooting_event_id ORDER BY total_score DESC, shot_1 DESC NULLS LAST, shot_2 DESC NULLS LAST, shot_3 DESC NULLS LAST, shot_4 DESC NULLS LAST, birth_year, master_number) AS rank
   FROM shooting_event_total_stitch_evaluation x
  WHERE stitch_code = 'MILITAER'::text AND shot_count = 4;;
ALTER TABLE public.clubs ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.clubs TO authenticated;
CREATE POLICY "authenticated full access" ON public.clubs AS PERMISSIVE FOR ALL TO authenticated USING (true) WITH CHECK (true);
ALTER TABLE public.competition_weapons ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.competition_weapons TO authenticated;
CREATE POLICY "authenticated full access" ON public.competition_weapons AS PERMISSIVE FOR ALL TO authenticated USING (true) WITH CHECK (true);
ALTER TABLE public.shooters ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.shooters TO authenticated;
CREATE POLICY "Testuser can read shooters" ON public.shooters AS PERMISSIVE FOR SELECT TO authenticated USING ((auth.uid() = '00000000-0000-4000-8000-000000000099'::uuid));
CREATE POLICY "authenticated full access" ON public.shooters AS PERMISSIVE FOR ALL TO authenticated USING (true) WITH CHECK (true);
ALTER TABLE public.shooting_event_categories ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.shooting_event_categories TO authenticated;
CREATE POLICY "authenticated full access" ON public.shooting_event_categories AS PERMISSIVE FOR ALL TO authenticated USING (true) WITH CHECK (true);
ALTER TABLE public.shooting_event_combination_stitches ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.shooting_event_combination_stitches TO authenticated;
CREATE POLICY "authenticated full access" ON public.shooting_event_combination_stitches AS PERMISSIVE FOR ALL TO authenticated USING (true) WITH CHECK (true);
ALTER TABLE public.shooting_event_combinations ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.shooting_event_combinations TO authenticated;
CREATE POLICY "authenticated full access" ON public.shooting_event_combinations AS PERMISSIVE FOR ALL TO authenticated USING (true) WITH CHECK (true);
ALTER TABLE public.shooting_event_group_members ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.shooting_event_group_members TO authenticated;
CREATE POLICY "authenticated full access" ON public.shooting_event_group_members AS PERMISSIVE FOR ALL TO authenticated USING (true) WITH CHECK (true);
ALTER TABLE public.shooting_event_groups ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.shooting_event_groups TO authenticated;
CREATE POLICY "authenticated full access" ON public.shooting_event_groups AS PERMISSIVE FOR ALL TO authenticated USING (true) WITH CHECK (true);
ALTER TABLE public.shooting_event_payouts ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.shooting_event_payouts TO authenticated;
CREATE POLICY "authenticated full access" ON public.shooting_event_payouts AS PERMISSIVE FOR ALL TO authenticated USING (true) WITH CHECK (true);
ALTER TABLE public.shooting_event_registration_stitches ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.shooting_event_registration_stitches TO authenticated;
CREATE POLICY "authenticated full access" ON public.shooting_event_registration_stitches AS PERMISSIVE FOR ALL TO authenticated USING (true) WITH CHECK (true);
ALTER TABLE public.shooting_event_registrations ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.shooting_event_registrations TO authenticated;
CREATE POLICY "Testuser can read event registrations" ON public.shooting_event_registrations AS PERMISSIVE FOR SELECT TO authenticated USING ((auth.uid() = '00000000-0000-4000-8000-000000000099'::uuid));
CREATE POLICY "authenticated full access" ON public.shooting_event_registrations AS PERMISSIVE FOR ALL TO authenticated USING (true) WITH CHECK (true);
ALTER TABLE public.shooting_event_stitch_blocks ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.shooting_event_stitch_blocks TO authenticated;
CREATE POLICY "authenticated full access" ON public.shooting_event_stitch_blocks AS PERMISSIVE FOR ALL TO authenticated USING (true) WITH CHECK (true);
ALTER TABLE public.shooting_event_stitch_instant_payout_rules ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.shooting_event_stitch_instant_payout_rules TO authenticated;
CREATE POLICY "authenticated full access" ON public.shooting_event_stitch_instant_payout_rules AS PERMISSIVE FOR ALL TO authenticated USING (true) WITH CHECK (true);
ALTER TABLE public.shooting_event_stitch_instant_payouts ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.shooting_event_stitch_instant_payouts TO authenticated;
CREATE POLICY "authenticated full access" ON public.shooting_event_stitch_instant_payouts AS PERMISSIVE FOR ALL TO authenticated USING (true) WITH CHECK (true);
ALTER TABLE public.shooting_event_stitch_passes ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.shooting_event_stitch_passes TO authenticated;
CREATE POLICY "authenticated full access" ON public.shooting_event_stitch_passes AS PERMISSIVE FOR ALL TO authenticated USING (true) WITH CHECK (true);
ALTER TABLE public.shooting_event_stitch_payout_settlements ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.shooting_event_stitch_payout_settlements TO authenticated;
CREATE POLICY "authenticated full access" ON public.shooting_event_stitch_payout_settlements AS PERMISSIVE FOR ALL TO authenticated USING (true) WITH CHECK (true);
ALTER TABLE public.shooting_event_stitch_shots ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.shooting_event_stitch_shots TO authenticated;
CREATE POLICY "authenticated full access" ON public.shooting_event_stitch_shots AS PERMISSIVE FOR ALL TO authenticated USING (true) WITH CHECK (true);
ALTER TABLE public.shooting_event_stitches ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.shooting_event_stitches TO authenticated;
CREATE POLICY "authenticated full access" ON public.shooting_event_stitches AS PERMISSIVE FOR ALL TO authenticated USING (true) WITH CHECK (true);
ALTER TABLE public.shooting_events ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.shooting_events TO authenticated;
CREATE POLICY "authenticated full access" ON public.shooting_events AS PERMISSIVE FOR ALL TO authenticated USING (true) WITH CHECK (true);
ALTER TABLE public.shooting_programs ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.shooting_programs TO authenticated;
CREATE POLICY "authenticated full access" ON public.shooting_programs AS PERMISSIVE FOR ALL TO authenticated USING (true) WITH CHECK (true);
ALTER TABLE public.shooting_ranges ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.shooting_ranges TO authenticated;
CREATE POLICY "Authenticated users can view all shooting ranges" ON public.shooting_ranges AS PERMISSIVE FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can delete own shooting ranges" ON public.shooting_ranges AS PERMISSIVE FOR DELETE TO authenticated USING ((auth.uid() = user_id));
CREATE POLICY "Users can insert own shooting ranges" ON public.shooting_ranges AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "Users can update own shooting ranges" ON public.shooting_ranges AS PERMISSIVE FOR UPDATE TO authenticated USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));
GRANT ALL ON public.shooting_event_nachdoppel_evaluation TO anon,authenticated;
GRANT ALL ON public.shooting_event_ranked_shots TO anon,authenticated;
GRANT ALL ON public.shooting_event_ranking_base TO anon,authenticated;
GRANT ALL ON public.shooting_event_ranking_glueck TO anon,authenticated;
GRANT ALL ON public.shooting_event_ranking_jm TO anon,authenticated;
GRANT ALL ON public.shooting_event_ranking_kunst TO anon,authenticated;
GRANT ALL ON public.shooting_event_ranking_militaer TO anon,authenticated;
GRANT ALL ON public.shooting_event_ranking_nachdoppel TO anon,authenticated;
GRANT ALL ON public.shooting_event_ranking_ruetli TO anon,authenticated;
GRANT ALL ON public.shooting_event_ranking_section TO anon,authenticated;
GRANT ALL ON public.shooting_event_ruetli_evaluation TO anon,authenticated;
GRANT ALL ON public.shooting_event_stitch_evaluation TO anon,authenticated;
GRANT ALL ON public.shooting_event_total_stitch_evaluation TO anon,authenticated;
