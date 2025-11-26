// backend/helpers.js
import dayjs from "dayjs";

/**
 * Check if trainer can update status for a topic, based on batch_type and planned date.
 * - Morning batch: allow update only on same day until 23:59:59 (end of day)
 * - Afternoon batch: allow update until next day 11:00 AM
 *
 * Inputs:
 * - batchType: 'Morning' or 'Afternoon'
 * - plannedDateStr: date string (YYYY-MM-DD or ISO)
 * - now (optional) Date instance for testing
 */
export function canUpdateStatus(batchType, plannedDateStr, now = new Date()) {
  if (!batchType || !plannedDateStr) return false;

  const plannedDay = dayjs(plannedDateStr).startOf("day");
  const current = dayjs(now);

  if (batchType.toLowerCase() === "morning") {
    // allow if current is on same day and before end of day
    const endOfDay = plannedDay.endOf("day");
    return current.isAfter(plannedDay.startOf("day")) && current.isBefore(endOfDay.add(1, "second"));
  }

  if (batchType.toLowerCase() === "afternoon") {
    // allow until next day 11:00 AM
    const nextDayEleven = plannedDay.add(1, "day").hour(11).minute(0).second(0);
    return current.isBefore(nextDayEleven.add(1, "second"));
  }

  return false;
}
