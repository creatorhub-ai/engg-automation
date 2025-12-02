// backend/marksWindowService.js
import { pool } from "./db.js";

export async function getWindowStatus({ batchNo, assessmentType, weekNo, nowUtc }) {
  const now = nowUtc || new Date();

  const { rows } = await pool.query(
    `SELECT *
       FROM marks_entry_windows
      WHERE batch_no = $1
        AND assessment_type = $2
        AND (week_no = $3 OR $3 IS NULL)
      ORDER BY week_no NULLS FIRST
      LIMIT 1`,
    [batchNo, assessmentType, weekNo ?? null]
  );

  if (rows.length === 0) {
    return {
      exists: false,
      is_open: false,
      portal_open_at: null,
      portal_close_at: null,
      is_extended: false,
      extended_until: null,
      now,
    };
  }

  const w = rows[0];
  const portalOpenAt = w.portal_open_at;
  const baseCloseAt = w.portal_close_at;
  const extendedUntil = w.extended_until;

  const effectiveCloseAt =
    w.is_extended && extendedUntil && extendedUntil > baseCloseAt
      ? extendedUntil
      : baseCloseAt;

  const isOpen = now >= portalOpenAt && now <= effectiveCloseAt;

  return {
    exists: true,
    is_open: isOpen,
    portal_open_at: portalOpenAt,
    portal_close_at: baseCloseAt,
    is_extended: w.is_extended,
    extended_until: extendedUntil,
    now,
  };
}
