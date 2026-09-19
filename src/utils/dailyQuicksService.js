import { supabase } from '../lib/supabase.js';
import { buildDailyQuicksSummary } from '../../shared/dailyQuicks/builder.js';
import { toISTDateString } from '../../shared/dailyQuicks/istDate.js';

const DAILY_SUMMARIES_KEY = 'mechhelp_crm_daily_summaries';
const useSupabase = Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY);

const mapDbRow = (row) => ({
  id: row.id,
  date: row.date,
  summary: row.summary,
  generatedAt: row.generated_at,
});

const readLocalSummaries = () => {
  const raw = localStorage.getItem(DAILY_SUMMARIES_KEY);
  return raw ? JSON.parse(raw) : [];
};

const writeLocalSummaries = (summaries) => {
  localStorage.setItem(DAILY_SUMMARIES_KEY, JSON.stringify(summaries));
};

export const DailyQuicksService = {
  async getSummaryByDate(date) {
    if (useSupabase) {
      const { data, error } = await supabase
        .from('daily_summaries')
        .select('*')
        .eq('date', date)
        .maybeSingle();

      if (error) throw error;
      return data ? mapDbRow(data) : null;
    }

    return readLocalSummaries().find((s) => s.date === date) ?? null;
  },

  async listSummaries(limit = 30) {
    if (useSupabase) {
      const { data, error } = await supabase
        .from('daily_summaries')
        .select('*')
        .order('date', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return (data || []).map(mapDbRow);
    }

    return readLocalSummaries()
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, limit);
  },

  async saveSummary(summary) {
    const generatedAt = new Date().toISOString();

    if (useSupabase) {
      const { data, error } = await supabase
        .from('daily_summaries')
        .upsert(
          { date: summary.date, summary, generated_at: generatedAt },
          { onConflict: 'date' }
        )
        .select('*')
        .single();

      if (error) throw error;
      return mapDbRow(data);
    }

    const summaries = readLocalSummaries();
    const existingIndex = summaries.findIndex((s) => s.date === summary.date);
    const stored = {
      id: existingIndex >= 0 ? summaries[existingIndex].id : crypto.randomUUID(),
      date: summary.date,
      summary,
      generatedAt,
    };

    if (existingIndex >= 0) {
      summaries[existingIndex] = stored;
    } else {
      summaries.unshift(stored);
    }

    writeLocalSummaries(summaries);
    return stored;
  },

  /** Load stored summary or build + persist for today if missing. */
  async getOrCreateTodaySummary(leads) {
    const today = toISTDateString();
    const existing = await this.getSummaryByDate(today);
    if (existing) return existing;

    const summary = buildDailyQuicksSummary(leads);
    return this.saveSummary(summary);
  },

  async getSummaryForDate(date, leads) {
    const stored = await this.getSummaryByDate(date);
    if (stored) return stored;

    const today = toISTDateString();
    if (date === today) {
      const summary = buildDailyQuicksSummary(leads);
      return this.saveSummary(summary);
    }

    return null;
  },
};
