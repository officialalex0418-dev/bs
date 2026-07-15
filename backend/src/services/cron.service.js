import Attendance from '../models/Attendance.js';
import LocationLog from '../models/LocationLog.js';
import { todayStr } from '../utils/dates.js';

/**
 * BACKGROUND TASKS
 * - Auto checkout users who haven't sent a location ping in 45 minutes.
 */
export function startCronJobs() {
  console.log('⏲️ Starting Background Cron Jobs...');

  // Run every 5 minutes
  setInterval(async () => {
    try {
      await autoCheckoutInactiveUsers();
    } catch (err) {
      console.error('Auto-checkout cron error:', err);
    }
  }, 5 * 60 * 1000);
}

async function autoCheckoutInactiveUsers() {
  const fortyFiveMinsAgo = new Date(Date.now() - 45 * 60 * 1000);
  const today = todayStr();

  // 1. Find all active attendance records for today
  const activeSessions = await Attendance.find({
    date: today,
    'checkIn.time': { $exists: true },
    'checkOut.time': { $exists: false }
  }).populate('staff', 'name');

  for (const session of activeSessions) {
    // 2. Check the last location ping for this staff
    const lastLog = await LocationLog.findOne({ staff: session.staff._id })
      .sort({ recordedAt: -1 })
      .select('recordedAt');

    // 3. If no ping ever OR last ping was > 45 mins ago
    // We also check against checkIn.time in case they just checked in and haven't pinged yet
    const lastActivity = lastLog ? lastLog.recordedAt : session.checkIn.time;

    if (lastActivity < fortyFiveMinsAgo) {
      console.log(`👤 Auto-checking out ${session.staff.name} due to 45m inactivity.`);

      session.checkOut = {
        time: new Date(),
        address: 'System Auto Checkout (Inactivity)',
        deviceInfo: { platform: 'system', model: 'automated' }
      };

      if (session.checkIn?.time) {
        session.workedMinutes = Math.floor((session.checkOut.time - session.checkIn.time) / 60000);
      }

      await session.save();
    }
  }
}
