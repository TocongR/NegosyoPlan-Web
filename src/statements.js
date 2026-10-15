// Same rules as the mobile app (lib/logic/statements.dart · computeYear):
// the owner types item lines; totals and carry-overs are worked out here.
import { amount } from './format.js';

const CALCULATED = new Set(['tga', 'tcs', 'gi', 'toe', 'ni', 'io', 'tc', 'ce', 'inv', 'tca', 'tnca', 'ta', 'ani', 'capt', 'dr', 'tcap', 'tlc']);
const CARRIED = new Set(['cb', 'capb']);

function computeYear(inc = {}, cf = {}, bs = {}, prev) {
  const typed = (m) => {
    const o = {};
    for (const [k, val] of Object.entries(m || {})) {
      if (!CALCULATED.has(k) && !(prev && CARRIED.has(k))) o[k] = amount(val);
    }
    return o;
  };
  const i = typed(inc), c = typed(cf), b = typed(bs);
  const v = (m, k) => (m[k] === undefined ? null : m[k]);
  const add = (xs) => (xs.every((x) => x === null) ? null : xs.reduce((a, x) => a + (x ?? 0), 0));
  const sub = (a, x) => (a === null && x === null ? null : (a ?? 0) - (x ?? 0));
  const neg = (x) => (x === null ? null : -x);
  const put = (m, k, x) => {
    if (x !== null) m[k] = x;
  };

  put(i, 'tga', add([v(i, 'bi'), v(i, 'pu')]));
  put(i, 'tcs', sub(v(i, 'tga'), v(i, 'ei')));
  put(i, 'gi', sub(v(i, 'sales'), v(i, 'tcs')));
  put(i, 'toe', add([v(i, 'sw'), v(i, 'pl'), v(i, 'plw'), v(i, 'tt')]));
  put(i, 'ni', sub(v(i, 'gi'), v(i, 'toe')));

  if (prev) put(c, 'cb', v(prev.cf, 'ce'));
  put(c, 'io', v(i, 'ni'));
  put(c, 'tc', add([v(c, 'cb'), v(c, 'io')]));
  put(c, 'ce', sub(v(c, 'tc'), v(c, 'cd')));

  put(b, 'inv', v(i, 'ei'));
  put(b, 'tca', add([v(b, 'cash'), v(b, 'inv')]));
  put(b, 'tnca', add([v(b, 'lb'), neg(v(b, 'lbd')), v(b, 'cm'), neg(v(b, 'cmd')), v(b, 'eq'), neg(v(b, 'eqd'))]));
  put(b, 'ta', add([v(b, 'tca'), v(b, 'tnca')]));
  if (prev) put(b, 'capb', v(prev.bs, 'tcap'));
  put(b, 'ani', v(i, 'ni'));
  put(b, 'capt', add([v(b, 'capb'), v(b, 'ani')]));
  if (v(b, 'capt') !== null && v(b, 'ta') !== null) put(b, 'dr', v(b, 'capt') - v(b, 'ta'));
  put(b, 'tcap', sub(v(b, 'capt'), v(b, 'dr')));
  put(b, 'tlc', v(b, 'tcap'));
  return { inc: i, cf: c, bs: b };
}

/** All years in order, each with its worked-out figures. */
export function allYears(answers) {
  const years = answers?.years || {};
  const list = [...new Set([...Object.keys(years).map(Number), ...(answers?.extraYears || []).map(Number)])]
    .filter((y) => !isNaN(y))
    .sort((a, b) => a - b);
  const out = [];
  let prev = null;
  for (const y of list) {
    const s = years[String(y)] || {};
    const hasPrev = prev !== null && out.length && out[out.length - 1].year === y - 1;
    const f = computeYear(s.inc, s.cf, s.bs, hasPrev ? prev : null);
    out.push({ year: y, ...f, first: !hasPrev });
    prev = f;
  }
  return out;
}

// [label, key, style] — style: h = heading, t = total, g = grand total
export const ROWS = {
  inc: [
    ['Sales', 'sales', 'g'],
    ['Less: Cost of sales', null, 'h'],
    ['Beginning inventory', 'bi'],
    ['Purchases', 'pu'],
    ['Total goods available for sale', 'tga', 't'],
    ['Ending inventory', 'ei'],
    ['Total cost of sales', 'tcs', 't'],
    ['Gross income', 'gi', 'g'],
    ['Less: Operating expenses', null, 'h'],
    ['Salaries and wages', 'sw'],
    ['Permits and licenses', 'pl'],
    ['Power, light and water', 'plw'],
    ['Travel and transportation', 'tt'],
    ['Total operating expenses', 'toe', 't'],
    ['Net income', 'ni', 'g'],
  ],
  cf: [
    ['Cash beginning (January)', 'cb'],
    ['Add: Income from operation', 'io'],
    ['Total cash', 'tc', 't'],
    ['Less: Cash disbursements', 'cd'],
    ['Cash ending', 'ce', 'g'],
  ],
  bs: [
    ['Current assets', null, 'h'],
    ['Cash on hand & in bank', 'cash'],
    ['Merchandise inventory', 'inv'],
    ['Total current assets', 'tca', 't'],
    ['Non-current assets', null, 'h'],
    ['Lot, building', 'lb'],
    ['Accum. depreciation', 'lbd'],
    ['Cars, motorcycle', 'cm'],
    ['Accum. depreciation', 'cmd'],
    ['Equipment', 'eq'],
    ['Accum. depreciation', 'eqd'],
    ['Total non-current assets', 'tnca', 't'],
    ['Total assets', 'ta', 'g'],
    ['Capital', null, 'h'],
    ['Capital, beginning', 'capb'],
    ['Accum. net income', 'ani'],
    ['Total', 'capt', 't'],
    ['Less: Drawings', 'dr'],
    ['Total capital', 'tcap', 't'],
    ['Total liabilities & capital', 'tlc', 'g'],
  ],
};

export const isCalculated = (key, first) => CALCULATED.has(key) || (!first && CARRIED.has(key));