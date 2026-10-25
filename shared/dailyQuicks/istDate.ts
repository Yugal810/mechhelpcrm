const IST_TIMEZONE = 'Asia/Kolkata';

/** YYYY-MM-DD in IST for any Date. */
export function toISTDateString(date: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: IST_TIMEZONE }).format(date);
}

/** Robustly converts any date format (YYYY-MM-DD, DD/MM/YYYY, ISO string) to YYYY-MM-DD. */
export function normalizeDateToYmd(d?: string | null): string {
  if (!d) return '';
  const trimmed = d.trim();
  if (!trimmed) return '';
  
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    return trimmed.slice(0, 10);
  }
  if (/^\d{1,2}[\/-]\d{1,2}[\/-]\d{4}/.test(trimmed)) {
    const parts = trimmed.split(/[\/-]/);
    const p1 = parseInt(parts[0], 10);
    const p2 = parseInt(parts[1], 10);
    const year = parseInt(parts[2], 10);
    let day = p1;
    let month = p2;
    if (p2 > 12) {
      day = p2;
      month = p1;
    }
    const mm = String(month).padStart(2, '0');
    const dd = String(day).padStart(2, '0');
    return `${year}-${mm}-${dd}`;
  }
  const parsed = new Date(trimmed);
  if (!isNaN(parsed.getTime())) {
    const y = parsed.getFullYear();
    const m = String(parsed.getMonth() + 1).padStart(2, '0');
    const day = String(parsed.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
  return '';
}

function addDaysToDateString(dateStr: string, days: number): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day + days));
  return utc.toISOString().slice(0, 10);
}

/** DD/MM/YYYY display format for emails and UI headers. */
export function formatISTDisplayDate(dateStr: string): string {
  if (!dateStr) return '';
  const ymd = normalizeDateToYmd(dateStr);
  if (!ymd) return dateStr;
  const [year, month, day] = ymd.split('-');
  return `${day}/${month}/${year}`;
}

export function isISTToday(dateValue?: string | null, referenceDate: Date = new Date()): boolean {
  if (!dateValue) return false;
  const ref = toISTDateString(referenceDate);
  const target = normalizeDateToYmd(dateValue);
  return Boolean(target && target === ref);
}

export function isISTTomorrow(dateValue?: string | null, referenceDate: Date = new Date()): boolean {
  if (!dateValue) return false;
  const ref = addDaysToDateString(toISTDateString(referenceDate), 1);
  const target = normalizeDateToYmd(dateValue);
  return Boolean(target && target === ref);
}

export function isISTOnOrBefore(dateValue?: string | null, referenceDate: Date = new Date()): boolean {
  if (!dateValue) return false;
  const target = normalizeDateToYmd(dateValue);
  if (!target) return false;
  const ref = toISTDateString(referenceDate);
  return target <= ref;
}
