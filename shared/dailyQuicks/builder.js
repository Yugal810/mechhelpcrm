import { isISTOnOrBefore, isISTToday, isISTTomorrow, toISTDateString } from './istDate.js';

const CLOSED_STAGES = ['Booked', 'Completed', 'Lost'];

function toEntry(lead) {
  return {
    customerName: lead.customerName || 'Unknown',
    identifier: lead.identifier,
  };
}

function sortByName(entries) {
  return [...entries].sort((a, b) =>
    a.customerName.localeCompare(b.customerName, undefined, { sensitivity: 'base' })
  );
}

/**
 * Builds the canonical Daily Quicks summary from lead data.
 * Used by both the dashboard and the 7 AM cron email.
 */
export function buildDailyQuicksSummary(leads, referenceDate = new Date()) {
  const date = toISTDateString(referenceDate);

  const activeLeads = leads.filter((l) => !CLOSED_STAGES.includes(l.leadType));

  const todaysCalls = sortByName(
    activeLeads
      .filter((l) => isISTOnOrBefore(l.nextFollowUpDate, referenceDate))
      .map(toEntry)
  );

  const bookedLeads = leads.filter((l) => l.leadType === 'Booked' && l.bookingDateTime);

  const todaysBookings = sortByName(
    bookedLeads.filter((l) => isISTToday(l.bookingDateTime, referenceDate)).map(toEntry)
  );

  const tomorrowsBookings = sortByName(
    bookedLeads.filter((l) => isISTTomorrow(l.bookingDateTime, referenceDate)).map(toEntry)
  );

  const garageNotifications = sortByName(
    bookedLeads
      .filter((l) => isISTTomorrow(l.bookingDateTime, referenceDate) && !l.garageNotified)
      .map(toEntry)
  );

  const rescheduledBookings = sortByName(
    leads.filter((l) => (l.bookingHistory?.length || 0) > 0).map(toEntry)
  );

  const vipCustomers = sortByName(leads.filter((l) => l.isVip).map(toEntry));

  const stats = {
    totalLeads: leads.length,
    callsDueToday: todaysCalls.length,
    totalBookings: bookedLeads.length,
    todaysBookings: todaysBookings.length,
    tomorrowsBookings: tomorrowsBookings.length,
    garageNotifications: garageNotifications.length,
    rescheduledBookings: rescheduledBookings.length,
    vipCustomers: vipCustomers.length,
  };

  return {
    date,
    stats,
    sections: {
      todaysCalls,
      todaysBookings,
      tomorrowsBookings,
      rescheduledBookings,
      garageNotifications,
      vipCustomers,
    },
  };
}
