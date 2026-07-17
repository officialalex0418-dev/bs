import Holiday from '../models/Holiday.js';
import Leave from '../models/Leave.js';
import Shift from '../models/Shift.js';

/**
 * Checks if a given date is a restricted day for attendance check-in.
 * Returns { restricted: boolean, reason: string }
 */
export async function checkAttendanceRestriction(user, dateStr) {
  const date = new Date(dateStr);
  const dayName = date.toLocaleDateString('en-US', { weekday: 'long' });

  // 1. Check Shift Off-Days
  if (user.shift) {
    const shift = await Shift.findById(user.shift);
    if (shift && shift.workingDays?.length > 0) {
      if (!shift.workingDays.includes(dayName)) {
        return { restricted: true, reason: `Today (${dayName}) is an off-day in your shift.` };
      }
    }
  }

  // 2. Check Public Holidays
  const holiday = await Holiday.findOne({
    company: user.company,
    startDate: { $lte: date },
    endDate: { $gte: date }
  });
  if (holiday) {
    return { restricted: true, reason: `Today is a public holiday: ${holiday.name}.` };
  }

  // 3. Check Approved Leaves
  const leave = await Leave.findOne({
    staff: user._id,
    status: 'APPROVED',
    fromDate: { $lte: date },
    toDate: { $gte: date }
  });
  if (leave) {
    return { restricted: true, reason: `You are on an approved leave today (${leave.type}).` };
  }

  return { restricted: false };
}
