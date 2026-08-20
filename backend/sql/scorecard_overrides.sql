-- ============================================================================
-- scorecard_overrides
--
-- Backs the editable Scorecard on the Marks Dashboard. The scorecard itself is
-- still calculated on the fly from final_assessment_scores /
-- intermediate_assessment_scores / final_project_scores / viva_scores — this
-- table only stores the values an Admin / Manager / Coordinator has overridden
-- on top of that calculation, plus the mandatory remarks for the change.
--
-- One row per learner per batch. `overrides` holds only the fields that were
-- actually changed, e.g.
--   {"digital": 82.5, "project": 90, "certification": "YES"}
--
-- Group averages (Theory % / Grp1 % / Grp2 %), Overall % and Grade are never
-- stored — they are re-derived from the merged component percentages.
--
-- The backend now creates this table on demand (see ensureScorecardOverridesTable
-- in backend/index.js), so running this file is optional — it is kept as the
-- canonical schema reference and for provisioning the table up front.
-- ============================================================================

create table if not exists public.scorecard_overrides (
  id            bigserial   primary key,
  batch_no      text        not null,
  learner_email text        not null,
  overrides     jsonb       not null default '{}'::jsonb,
  remarks       text        not null default '',
  edited_by     text,
  edited_at     timestamptz not null default now(),
  constraint scorecard_overrides_batch_learner_key unique (batch_no, learner_email)
);

-- The scorecard endpoints read every override for a batch in one shot.
create index if not exists scorecard_overrides_batch_no_idx
  on public.scorecard_overrides (batch_no);

-- The backend connects with the service-role key, so no RLS policy is needed.
