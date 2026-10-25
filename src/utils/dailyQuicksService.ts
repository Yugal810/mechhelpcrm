import { supabase } from '../lib/supabase';
import type { Lead } from '../types';
import { buildDailyQuicksSummary } from '../../shared/dailyQuicks/builder';
import type { DailyQuicksSummary, StoredDailySummary } from '../../shared/dailyQuicks/types';
import { toISTDateString } from '../../shared/dailyQuicks/istDate';

const DAILY_SUMMARIES_KEY = 'mechhelp_crm_daily_summaries';
const useSupabase = Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY);

const mapDbRow = (row: {
  id: string;
  date: string;
  summary: DailyQuicksSummary;
  generated_at: string;
}): StoredDailySummary => ({
  id: row.id,
  date: row.date,
  summary: row.summary,
  generatedAt: row.generated_at,
});

const readLocalSummaries = (): StoredDailySummary[] => {
  const raw = localStorage.getItem(DAILY_SUMMARIES_KEY);
  return raw ? JSON.parse(raw) : [];
};

const writeLocalSummaries = (summaries: StoredDailySummary[]) => {
  localStorage.setItem(DAILY_SUMMARIES_KEY, JSON.stringify(summaries));
};

export const DailyQuicksService = {
  async getSummaryByDate(date: string): Promise<StoredDailySummary | null> {
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

  async listSummaries(limit = 30): Promise<StoredDailySummary[]> {
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

  async saveSummary(summary: DailyQuicksSummary): Promise<StoredDailySummary> {
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
    const stored: StoredDailySummary = {
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
  async getOrCreateTodaySummary(leads: Lead[]): Promise<StoredDailySummary> {
    const today = toISTDateString();
    const summary = buildDailyQuicksSummary(leads);
    return {
      id: 'today-live',
      date: today,
      summary,
      generatedAt: new Date().toISOString(),
    };
  },

  async getSummaryForDate(
    date: string,
    leads: Lead[]
  ): Promise<StoredDailySummary | null> {
    const today = toISTDateString();

    // For today's date, ALWAYS calculate live real-time summary from current leads
    if (date === today) {
      const summary = buildDailyQuicksSummary(leads);
      return {
        id: 'today-live',
        date: today,
        summary,
        generatedAt: new Date().toISOString(),
      };
    }

    const stored = await this.getSummaryByDate(date);
    if (stored) return stored;

    return null;
  },
};
