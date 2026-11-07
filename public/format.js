const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const number = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pad = (n) => String(n).padStart(2, '0');

export function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

// money(12.5) -> "$12.50" · money(12.5, { sign: true }) -> "+$12.50" · negativos con signo menos real
export function money(n, { sign = false } = {}) {
  const v = Math.round((Number(n) || 0) * 100) / 100;
  const abs = number.format(Math.abs(v));
  if (v < 0) return `−$${abs}`;
  return sign && v > 0 ? `+$${abs}` : `$${abs}`;
}

export const pct = (n) => `${(Math.round((Number(n) || 0) * 10) / 10).toFixed(1)}%`;

export const toISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const todayISO = () => toISO(new Date());
export const parseISO = (s) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};

export function shortDate(iso) {
  const d = parseISO(iso);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

export function longDate(iso) {
  const d = parseISO(iso);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

// Fecha corta; agrega el año solo si no es el actual.
export function smartDate(iso) {
  return parseISO(iso).getFullYear() === new Date().getFullYear() ? shortDate(iso) : longDate(iso);
}
