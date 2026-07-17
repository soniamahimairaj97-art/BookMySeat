export const today = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

export const key = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

// Parse a "YYYY-MM-DD" key as a local-time Date — new Date(str) parses as UTC
// and can shift a day when the browser's timezone is behind UTC.
export const parseKey = (k) => {
  const [y, m, d] = k.split("-").map(Number);
  return new Date(y, m - 1, d);
};

export const TODAY_KEY = key(today());

export const addDays = (d, n) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};

export const addMonths = (d, n) => {
  const x = new Date(d.getFullYear(), d.getMonth() + n, 1);
  return x;
};

export const startOfMonth = (d) => new Date(d.getFullYear(), d.getMonth(), 1);

export const fmtMonth = (d) => d.toLocaleDateString("en-IN", { month: "long", year: "numeric" });

export const isWeekend = (d) => d.getDay() === 0 || d.getDay() === 6;

export const fmtShort = (d) =>
  d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });

export const fmtLong = (d) =>
  d.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
