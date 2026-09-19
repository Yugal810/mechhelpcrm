import { buildDailyQuicksSummary } from '../shared/dailyQuicks/builder.js';
import {
  formatDailyQuicksEmailBody,
  formatDailyQuicksEmailHtml,
  formatDailyQuicksEmailSubject,
} from '../shared/dailyQuicks/emailFormatter.js';
import { toISTDateString } from '../shared/dailyQuicks/istDate.js';
import {
  fetchLeadsForSummary,
  getDailySummaryByDate,
  markEmailSent,
  upsertDailySummary,
} from '../lib/supabaseAdmin.js';
import { sendDailyQuicksEmail } from '../lib/sendEmail.js';

export default async function handler(req, res) {
  const authHeader = req.headers.authorization;
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const todayIST = toISTDateString(new Date());
    const isForce = req.query.force === 'true';
    const isTest = req.query.test === 'true';

    if (isTest) {
      console.log('Sending Hello test email...');
      await sendDailyQuicksEmail(
        '🔧 MechHelp CRM • Email Test (Hello)',
        'Hello!\n\nYour MechHelp CRM email notification system is working perfectly.\n\nHave a great day!'
      );
      return res.status(200).json({
        ok: true,
        testMode: true,
        message: 'Hello test email sent successfully to ' + process.env.ADMIN_NOTIFICATION_EMAIL,
      });
    }

    if (!isForce) {
      const existing = await getDailySummaryByDate(todayIST);
      if (existing?.email_sent) {
        console.log(`Daily Quicks already sent for ${todayIST}. Skipping.`);
        return res.status(200).json({
          ok: true,
          alreadyExecuted: true,
          date: todayIST,
          message: 'Summary already generated and email sent for today.',
        });
      }

      if (existing && !existing.email_sent) {
        console.warn(
          `Daily Quicks record for ${todayIST} exists but email_sent=false. Retrying email delivery.`
        );
      }
    }

    const leads = await fetchLeadsForSummary();
    const summary = buildDailyQuicksSummary(leads);
    const stored = await upsertDailySummary(summary);

    const subject = formatDailyQuicksEmailSubject(summary);
    const text = formatDailyQuicksEmailBody(summary);
    const html = formatDailyQuicksEmailHtml(summary);

    await sendDailyQuicksEmail(subject, text, html);
    await markEmailSent(todayIST);

    console.log(`Successfully sent Daily Quicks email for ${todayIST} to ${process.env.ADMIN_NOTIFICATION_EMAIL}`);

    return res.status(200).json({
      ok: true,
      alreadyExecuted: false,
      date: summary.date,
      generatedAt: stored.generated_at,
      stats: summary.stats,
    });
  } catch (error) {
    console.error('Daily Quicks cron failed:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({
      ok: false,
      error: message,
    });
  }
}
