export const STATUSES = ['Pending', 'Returned for completion', 'Accepted'];

export const statusClass = (s) =>
  s === 'Accepted' ? 'green' : s === 'Returned for completion' ? 'red' : 'amber';

export function toDate(v) {
  if (!v) return null;
  if (typeof v.toDate === 'function') return v.toDate();
  if (typeof v === 'string' || typeof v === 'number') {
    const d = new Date(v);
    return isNaN(d) ? null : d;
  }
  return null;
}

export function when(v) {
  const d = toDate(v);
  return d ? d.toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' }) : '—';
}

export function amount(s) {
  if (s === null || s === undefined) return null;
  const t = String(s).replace(/[₱,\s]/g, '').replace(/^\((.*)\)$/, '-$1');
  if (t === '' || t === '-') return null;
  const n = Number(t);
  return isNaN(n) ? null : n;
}

export function peso(v) {
  const n = typeof v === 'number' ? v : amount(v);
  if (n === null) return '—';
  const s = Math.abs(n).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return n < 0 ? `(₱${s})` : `₱${s}`;
}

/** Statement style: 1,234.50 · negatives in brackets · zero as "-". */
export function fsAmount(n) {
  if (n === null || n === undefined) return '';
  if (Math.abs(n) < 0.005) return '-';
  const s = Math.abs(n).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return n < 0 ? `(${s})` : s;
}

export function fileSize(b) {
  if (!b) return '';
  return b > 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`;
}

export const join = (xs, sep = ', ') => xs.filter((x) => x && String(x).trim()).join(sep);