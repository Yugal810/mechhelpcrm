import { formatISTDisplayDate } from './istDate.js';

function formatSection(title, rows) {
  const lines = rows.length
    ? rows.map((r) => `${r.customerName} | ${r.identifier}`).join('\n')
    : 'None';
  return `${title}\n\n${lines}`;
}

export function formatDailyQuicksEmailSubject(summary) {
  return `MechHelp CRM • Daily Quicks • ${formatISTDisplayDate(summary.date)}`;
}

export function formatDailyQuicksEmailBody(summary) {
  const { stats, sections } = summary;
  const divider = '-'.repeat(50);

  return [
    'Good Morning!',
    '',
    'Here is your Daily Quicks summary.',
    '',
    divider,
    '',
    '📊 SUMMARY',
    '',
    `• Total Leads: ${stats.totalLeads}`,
    `• Calls Due Today: ${stats.callsDueToday}`,
    `• Total Bookings: ${stats.totalBookings}`,
    `• Today's Bookings: ${stats.todaysBookings}`,
    `• Tomorrow's Bookings: ${stats.tomorrowsBookings}`,
    `• Rescheduled Bookings: ${stats.rescheduledBookings}`,
    `• Garage Notifications: ${stats.garageNotifications}`,
    `• VIP Customers: ${stats.vipCustomers}`,
    '',
    divider,
    '',
    formatSection("TODAY'S CALLS", sections.todaysCalls),
    '',
    divider,
    '',
    formatSection("TODAY'S BOOKINGS", sections.todaysBookings),
    '',
    divider,
    '',
    formatSection("TOMORROW'S BOOKINGS", sections.tomorrowsBookings),
    '',
    divider,
    '',
    formatSection('RESCHEDULED BOOKINGS', sections.rescheduledBookings),
    '',
    divider,
    '',
    formatSection('GARAGE NOTIFICATIONS', sections.garageNotifications),
    '',
    divider,
    '',
    formatSection('VIP CUSTOMERS', sections.vipCustomers),
    '',
    divider,
    '',
    'Have a productive day!',
  ].join('\n');
}

function renderRows(rows) {
  if (!rows.length) {
    return '<p style="margin:4px 0 0;color:#9ca3af;font-size:13px;">None</p>';
  }
  return `<ul style="margin:6px 0 0;padding-left:18px;font-size:13px;color:#374151;">
    ${rows
      .map(
        (r) =>
          `<li style="margin-bottom:4px;"><strong style="color:#111827;">${r.customerName}</strong>&nbsp;<span style="color:#9ca3af;">— ${r.identifier}</span></li>`
      )
      .join('')}
  </ul>`;
}

/** Rich HTML version of the Daily Quicks email for modern mail clients. */
export function formatDailyQuicksEmailHtml(summary) {
  const { stats, sections } = summary;
  const dateDisplay = formatISTDisplayDate(summary.date);

  const statCards = [
    ['Total Leads', stats.totalLeads],
    ['Calls Due Today', stats.callsDueToday],
    ['Total Bookings', stats.totalBookings],
    ["Today's Bookings", stats.todaysBookings],
    ["Tomorrow's Bookings", stats.tomorrowsBookings],
    ['Rescheduled', stats.rescheduledBookings],
    ['Garage Alerts', stats.garageNotifications],
    ['VIP Customers', stats.vipCustomers],
  ];

  const sectionBlocks = [
    ['📞', "Today's Calls", sections.todaysCalls],
    ['📅', "Today's Bookings", sections.todaysBookings],
    ['📆', "Tomorrow's Bookings", sections.tomorrowsBookings],
    ['🔄', 'Rescheduled Bookings', sections.rescheduledBookings],
    ['🏭', 'Garage Notifications', sections.garageNotifications],
    ['⭐', 'VIP Customers', sections.vipCustomers],
  ];

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>MechHelp CRM • Daily Quicks • ${dateDisplay}</title>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f3f4f6;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" border="0"
          style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#1a1a2e 0%,#16213e 100%);padding:28px 32px;">
              <p style="margin:0;font-size:22px;font-weight:700;color:#ffffff;letter-spacing:-0.3px;">🔧 MechHelp CRM</p>
              <p style="margin:6px 0 0;font-size:13px;color:#93c5fd;letter-spacing:0.5px;">Daily Quicks &nbsp;•&nbsp; ${dateDisplay}</p>
            </td>
          </tr>

          <!-- Greeting -->
          <tr>
            <td style="padding:24px 32px 8px;">
              <p style="margin:0;font-size:15px;color:#374151;">Good Morning! Here is your Daily Quicks summary for today.</p>
            </td>
          </tr>

          <!-- Stat Cards -->
          <tr>
            <td style="padding:20px 32px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  ${statCards
                    .slice(0, 4)
                    .map(
                      ([label, val]) =>
                        `<td width="25%" style="padding:4px;">
                          <div style="background:#f8faff;border:1px solid #e5e7eb;border-radius:8px;padding:14px 8px;text-align:center;">
                            <div style="font-size:24px;font-weight:700;color:#1d4ed8;">${val}</div>
                            <div style="font-size:11px;color:#6b7280;margin-top:4px;line-height:1.3;">${label}</div>
                          </div>
                        </td>`
                    )
                    .join('')}
                </tr>
                <tr style="height:8px;"><td colspan="4"></td></tr>
                <tr>
                  ${statCards
                    .slice(4)
                    .map(
                      ([label, val]) =>
                        `<td width="25%" style="padding:4px;">
                          <div style="background:#f8faff;border:1px solid #e5e7eb;border-radius:8px;padding:14px 8px;text-align:center;">
                            <div style="font-size:24px;font-weight:700;color:#1d4ed8;">${val}</div>
                            <div style="font-size:11px;color:#6b7280;margin-top:4px;line-height:1.3;">${label}</div>
                          </div>
                        </td>`
                    )
                    .join('')}
                </tr>
              </table>
            </td>
          </tr>

          <!-- Divider -->
          <tr><td style="padding:0 32px;"><hr style="border:none;border-top:1px solid #e5e7eb;margin:0;" /></td></tr>

          <!-- Detail Sections -->
          ${sectionBlocks
            .map(
              ([icon, title, rows]) => `
          <tr>
            <td style="padding:16px 32px;">
              <p style="margin:0 0 8px;font-size:14px;font-weight:700;color:#111827;">${icon}&nbsp; ${title}</p>
              ${renderRows(rows)}
            </td>
          </tr>
          <tr><td style="padding:0 32px;"><hr style="border:none;border-top:1px solid #f3f4f6;margin:0;" /></td></tr>`
            )
            .join('')}

          <!-- Footer -->
          <tr>
            <td style="padding:20px 32px 28px;text-align:center;">
              <p style="margin:0;font-size:12px;color:#9ca3af;">Have a productive day! &nbsp;—&nbsp; MechHelp CRM</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
