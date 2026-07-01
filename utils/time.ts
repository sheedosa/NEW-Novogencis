/**
 * Shared 12-hour clock parsing/formatting.
 *
 * Consolidates four byte-identical `parseTime12h` copies that previously lived in
 * AdminPage, ClientRecord, InboxPanel (minutes-since-midnight) and CalendarPanel
 * ({ h, m }). Single source of truth for appointment-time parsing + conflict checks.
 */

/** Parse "10:30 AM" / "02:00 PM" into { h, m } (24-hour). Null if unparseable. */
export function parseTime12hParts(t: string | undefined): { h: number; m: number } | null {
  if (!t) return null;
  const match = t.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return null;
  let h = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  const ampm = match[3].toUpperCase();
  if (ampm === 'PM' && h !== 12) h += 12;
  if (ampm === 'AM' && h === 12) h = 0;
  return { h, m };
}

/** Parse "10:30 AM" into minutes since midnight. Null if unparseable. */
export function parseTime12h(t: string | undefined): number | null {
  const parts = parseTime12hParts(t);
  return parts ? parts.h * 60 + parts.m : null;
}

/** Inverse of parseTime12h — render minutes-since-midnight as "h:mm AM/PM". */
export function formatMinutes12h(mins: number): string {
  const h24 = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  const ampm = h24 >= 12 ? 'PM' : 'AM';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}
