// Date helpers. Everything works on local calendar days ("yyyy-mm-dd") so a
// task due "today" means today for the student, whatever the time zone.

const DAY_MS = 24 * 60 * 60 * 1000;

export const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_LONG = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function parseISODate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

export function diffDays(a: string, b: string): number {
  return Math.round((parseISODate(a).getTime() - parseISODate(b).getTime()) / DAY_MS);
}

export function isWeekend(d: Date): boolean {
  return d.getDay() === 0 || d.getDay() === 6;
}

/** Monday of the week containing `d`. */
export function startOfWeek(d: Date): Date {
  const day = startOfDay(d);
  const offset = (day.getDay() + 6) % 7;
  return addDays(day, -offset);
}

/** The school day `n` school days before `d` (weekends skipped). */
export function schoolDaysBack(d: Date, n: number): Date {
  let r = startOfDay(d);
  let left = n;
  while (left > 0) {
    r = addDays(r, -1);
    if (!isWeekend(r)) left--;
  }
  return r;
}

/** The school day `n` school days after `d` (weekends skipped). */
export function schoolDaysAhead(d: Date, n: number): Date {
  let r = startOfDay(d);
  let left = n;
  while (left > 0) {
    r = addDays(r, 1);
    if (!isWeekend(r)) left--;
  }
  return r;
}

export function weekdayName(d: Date): string {
  return WEEKDAYS[d.getDay()];
}

export function shortDate(s: string): string {
  const d = parseISODate(s);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

export function longDate(d: Date): string {
  return `${weekdayName(d)} ${d.getDate()} ${MONTHS_LONG[d.getMonth()]}`;
}

export function monthName(d: Date): string {
  return MONTHS_LONG[d.getMonth()];
}

export type DueTone = "amber" | "sky" | "neutral";

/** "Overdue", "Today", "Tomorrow", "Friday" or "12 Nov", with a colour tone. */
export function dueLabel(due: string, today: string): { label: string; tone: DueTone } {
  const diff = diffDays(due, today);
  if (diff < 0) return { label: "Overdue", tone: "amber" };
  if (diff === 0) return { label: "Today", tone: "sky" };
  if (diff === 1) return { label: "Tomorrow", tone: "sky" };
  const weekEnd = toISODate(addDays(startOfWeek(parseISODate(today)), 6));
  if (diffDays(due, weekEnd) <= 0) return { label: weekdayName(parseISODate(due)), tone: "neutral" };
  return { label: shortDate(due), tone: "neutral" };
}

/** "Just now", "10 min ago", "2h ago", "3d ago". */
export function timeAgo(iso: string, now: Date): string {
  const mins = Math.max(0, Math.round((now.getTime() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

/** Compact form for list rows: "10m", "2h", "1d". */
export function timeAgoShort(iso: string, now: Date): string {
  const mins = Math.max(0, Math.round((now.getTime() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.round(hours / 24)}d`;
}

export function greeting(now: Date): string {
  const h = now.getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

const NUMBER_WORDS = ["No", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten"];

export function numberWord(n: number, lower = false): string {
  const w = NUMBER_WORDS[n] ?? String(n);
  return lower ? w.toLowerCase() : w;
}
