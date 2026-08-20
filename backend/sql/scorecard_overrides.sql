-- ============================================================================
-- scorecard_overrides
--
-- Backs the editable Scorecard on the Marks Dashboard. The scorecard itself is
-- still calculated on the fly from final_assessment_scores /
-- intermediate_assessment_scores / final_project_scores / viva_scores — this
-- table only stores the values an Admin / Manager / Coordinator has overridden
-- on top of that calculation, plus the remarks for the change.
--
-- One row per learner per batch. `overrides` holds only the fields that were
-- actually changed, e.g.
--   {"digital": 82.5, "project": 90, "certification": "YES"}
--
-- Group averages (Theory % / Grp1 % / Grp2 %), Overall % and Grade are never
-- stored — they are re-derived from the merged component percentages.
--
-- The backend creates this table on demand (ensureScorecardOverridesTable in
-- backend/index.js) whenever DATABASE_URL is configured. Run this file in the
-- Supabase SQL editor if it is not, or to provision the table up front.
--
-- Safe to run repeatedly: it also REPAIRS a table that already exists but is
-- missing columns or the (batch_no, learner_email) unique key — that missing
-- key is what makes the save fail with SQLSTATE 42P10.
-- ============================================================================

create table if not exists public.scorecard_overrides (
  id            bigserial   primary key,
  batch_no      text        not null,
  learner_email text        not null,
  overrides     jsonb       not null default '{}'::jsonb,
  remarks       text                 default '',
  edited_by     text,
  edited_at     timestamptz not null default now()
);

-- ── Repair: add anything an older / hand-created table is missing ───────────
alter table public.scorecard_overrides add column if not exists batch_no      text;
alter table public.scorecard_overrides add column if not exists learner_email text;
alter table public.scorecard_overrides add column if not exists overrides     jsonb not null default '{}'::jsonb;
alter table public.scorecard_overrides add column if not exists remarks       text;
alter table public.scorecard_overrides add column if not exists edited_by     text;
alter table public.scorecard_overrides add column if not exists edited_at     timestamptz not null default now();

-- A NOT NULL on remarks would reject a marks-only edit.
alter table public.scorecard_overrides alter column remarks drop not null;
alter table public.scorecard_overrides alter column remarks set default '';

-- ── Repair: collapse duplicates, then install the unique key ────────────────
delete from public.scorecard_overrides a
 using public.scorecard_overrides b
 where a.batch_no = b.batch_no
   and a.learner_email = b.learner_email
   and a.id < b.id;

do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.scorecard_overrides'::regclass
       and conname  = 'scorecard_overrides_batch_learner_key'
  ) then
    alter table public.scorecard_overrides
      add constraint scorecard_overrides_batch_learner_key
      unique (batch_no, learner_email);
  end if;
end $$;

-- The scorecard endpoints read every override for a batch in one shot.
create index if not exists scorecard_overrides_batch_no_idx
  on public.scorecard_overrides (batch_no);

-- The backend connects with the service-role key, so no RLS policy is needed.
-- If RLS was switched on for this table in the dashboard, turn it back off:
alter table public.scorecard_overrides disable row level security;

-- Make PostgREST pick the table up immediately instead of on its next reload.
notify pgrst, 'reload schema';
