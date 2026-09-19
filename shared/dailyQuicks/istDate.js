const IST_TIMEZONE = 'Asia/Kolkata';

/** YYYY-MM-DD in IST for any Date. */
export function toISTDateString(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: IST_TIMEZONE }).format(date);
}

function addDaysToDateString(dateStr, days) {
  const [year, month, day] = dateStr.split('-').map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day + days));
  return utc.toISOString().slice(0, 10);
}

/** DD/MM/YYYY display format for emails and UI headers. */
export function formatISTDisplayDate(dateStr) {
  const [year, month, day] = dateStr.split('-');
  return `${day}/${month}/${year}`;
}

export function isISTToday(dateValue, referenceDate = new Date()) {
  const ref = toISTDateString(referenceDate);
  const target = dateValue.includes('T')
    ? toISTDateString(new Date(dateValue))
    : dateValue.slice(0, 10);
  return target === ref;
}

export function isISTTomorrow(dateValue, referenceDate = new Date()) {
  const ref = addDaysToDateString(toISTDateString(referenceDate), 1);
  const target = dateValue.includes('T')
    ? toISTDateString(new Date(dateValue))
    : dateValue.slice(0, 10);
  return target === ref;
}

export function isISTOnOrBefore(dateValue, referenceDate = new Date()) {
  const ref = toISTDateString(referenceDate);
  const target = dateValue.includes('T')
    ? toISTDateString(new Date(dateValue))
    : dateValue.slice(0, 10);
  return target <= ref;
}
