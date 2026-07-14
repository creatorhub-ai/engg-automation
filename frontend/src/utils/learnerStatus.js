// Shared learner-status helpers.
//
// A learner whose status is "Dropout" or "Batch Movement" is treated as
// INACTIVE: their record is greyed out and non-interactive everywhere it is
// listed (Learners Dashboard, attendance marking, mark entry, reports, …).

export const LEARNER_STATUSES = ["Enabled", "Disabled", "Dropout", "Batch Movement"];

// True when the given status means the learner should be greyed / locked.
export function isInactiveLearnerStatus(status) {
  const s = (status || "").toString().trim().toLowerCase();
  return s === "dropout" || s === "batch movement" || s === "batch_movement";
}
