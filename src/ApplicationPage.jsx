import { useEffect, useState } from 'react';
import { arrayUnion, collection, doc, onSnapshot, serverTimestamp, Timestamp, updateDoc } from 'firebase/firestore';
import { auth, db } from './firebase.js';
import { statusClass, when, peso, amount, fileSize, fsAmount, join } from './format.js';
import { allYears, ROWS, isCalculated } from './statements.js';

const KIND_TITLE = {
  permit: 'Business permit',
  annexC: 'Annex C · Certificate of residency and business operation (signed)',
  training: 'Training certificates',
};
// Made by the app from the owner's answers on every submit (ready to print).
const GENERATED = [
  ['gen_annexA', 'Application form (Annex A)'],
  ['gen_annexD', 'Business plan (Annex D)'],
  ['gen_statements', 'Financial statements'],
];

// const QUICK_REASONS = [
//   'The business permit is not clear. Please upload a clearer copy.',
//   'The business permit has expired. Please upload the current one.',
//   'Annex C is not signed by the Punong Barangay. Please upload the signed copy.',
//   'Please add at least one training certificate.',
//   'Some financial statement lines are blank. Please complete them.',
//   'The amounts in your financial statements do not match. Please check them.',
//   'Please add your workers (at least 2 who have worked with you 2 years or more and live in Iloilo).',
// ];

export default function ApplicationPage({ id, staff }) {
  const [app, setApp] = useState(undefined);
  const [files, setFiles] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    const a = onSnapshot(
      doc(db, 'applications', id),
      (s) => setApp(s.exists() ? { id: s.id, ...s.data() } : null),
      (e) => setError(`${e.code}: ${e.message}`),
    );
    const f = onSnapshot(
      collection(db, 'applications', id, 'files'),
      (s) => setFiles(s.docs.map((d) => ({ id: d.id, ...d.data() }))),
      () => {},
    );
    return () => {
      a();
      f();
    };
  }, [id]);

  if (error) return <div className="alert red">{error}</div>;
  if (app === undefined) return <div className="card muted">Loading…</div>;
  if (app === null) return <div className="card">This application was not found. <a href="#/">Back to the list</a></div>;

  const a = app.answers || {};
  const v = a.v || {};
  const g = a.g || {};
  const lists = a.lists || {};
  const one = (k) => (g[k] || [])[0] || '';
  const sel = (k) => (g[k] || []).join(', ');
  const kind = one('bt') === 'I buy and resell' ? 'resell' : one('bt') === 'I offer a service' ? 'service' : 'prod';

  return (
    <>
      <a href="#/" className="back">← All applications</a>
      <div className="page-head">
        <div>
          <h1>{app.businessName || 'No business name'}</h1>
          <p className="muted">
            {app.ownerName} · {app.mobile} · {join([app.barangay, app.town])} · Submitted {when(app.submittedAt)}
          </p>
        </div>
        <span className={`badge lg ${statusClass(app.status)}`}>{app.status || 'Pending'}</span>
      </div>

      <div className="detail">
        <div className="col-main">
          <Files files={files} />
          <Section title="Step 1 · About the owner">
            <KV k="Name" v={join([v.fn, v.mn, v.ln], ' ')} />
            <KV k="Home address" v={join([v.a1, v.a2, v.a3, join([v.a4, v.a5], ' ')])} />
            <KV k="District" v={one('dist')} />
            <KV k="Birthday" v={v.dob} />
            <KV k="Sex" v={one('sex')} />
            <KV k="Civil status" v={one('civ')} />
            <KV k="Mobile number" v={app.mobile || a.mobile} />
            <KV k="Email" v={v.em} />
            <KV k="Facebook" v={v.fb} />
            <KV k="TIN" v={v.tin} />
            <KV k="Bank" v={v.bank} />
            <KV k="Living in barangay since" v={v.since} />
            <KV k="Experience" v={v.exp} />
          </Section>

          <Section title="Step 2 · The business">
            <KV k="Business name" v={v.bn} />
            <KV k="What the loan will help do" v={v.pj} />
            <KV k="Business address" v={one('loc') === 'Somewhere else' ? join([v.b1, v.b2, v.b3, join([v.b4, v.b5], ' ')]) : one('loc') ? 'At home (same as home address)' : ''} />
            <KV k="Started" v={v.os} />
            <KV k="Who owns it" v={one('own')} />
            <KV k="About the business" v={v.bd} />
            <KV k="During a crisis" v={one('cr')} />
          </Section>

          <Section title="Step 3 · What they sell">
            <KV k="Kind of business" v={one('bt')} />
            <Table
              cols={['Product', 'Unit', 'Price']}
              rows={(lists.products || []).map((p) => [p.name, p.unit, peso(p.price)])}
              right={[2]}
            />
            <KV k="About it" v={v.pd} />
            <KV k="Who buys" v={sel('tm')} />
            <KV k="Where customers are" v={sel('ma')} />
            <KV k="How people hear about it" v={sel('md')} />
          </Section>

          <Costs v={v} lists={lists} kind={kind} />
          <Statements answers={a} />

          <Section title="Step 6 · Workers">
            <Table
              cols={['Name', 'Work', 'Status', 'Years', 'Sex', 'Lives in Iloilo']}
              rows={(lists.workers || []).map((w) => [w.name, w.work, w.status, w.years, w.sex, w.iloilo || 'Yes'])}
            />
            <WorkerCheck workers={lists.workers || []} />
          </Section>

          <Section title="Step 7 · Financial projection (yearly)">
            <KV k="Expected sales" v={peso(v.es)} />
            <KV k="Expected expenses" v={peso(v.ex)} />
            <KV k="Expected gross income" v={peso(v.gi)} />
            <KV k="Expected net income" v={peso(v.ni)} />
          </Section>

          <Section title="Step 8 · Loan">
            <KV k="Amount to borrow" v={peso(v.la ?? app.loanAmount)} />
          </Section>
        </div>

        <aside className="col-side">
          <Review app={app} files={files} staff={staff} />
          <History items={app.history || []} />
        </aside>
      </div>
    </>
  );
}

// ---------------------------------------------------------------- review

function Review({ app, files, staff }) {
  const [note, setNote] = useState(app.staffNote || '');
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState(null);

  useEffect(() => setNote(app.status === 'Returned for completion' ? app.staffNote || '' : ''), [app.id, app.status, app.staffNote]);

  const missing = ['permit', 'annexC', 'training'].filter((k) => !files.some((f) => f.kind === k));

  async function decide(status) {
    if (status === 'Returned for completion' && !note.trim()) {
      setMsg({ c: 'red', t: 'Write what the owner needs to fix. They will see this note in the app.' });
      return;
    }
    if (status === 'Accepted' && missing.length && !window.confirm('Some requirement files are missing. Accept anyway?')) return;
    setBusy(status);
    setMsg(null);
    const by = staff.name || staff.email;
    try {
      await updateDoc(doc(db, 'applications', app.id), {
        status,
        staffNote: status === 'Returned for completion' ? note.trim() : '',
        reviewedBy: staff.uid,
        reviewedByName: by,
        reviewedAt: serverTimestamp(),
        history: arrayUnion({ action: status, note: status === 'Returned for completion' ? note.trim() : '', by, at: Timestamp.now() }),
      });
      if (status === 'Pending') {
        setMsg({ c: 'green', t: 'Set back to Pending.' });
      } else {
        const sent = await notifyPhone(app.id);
        setMsg({
          c: sent.ok ? 'green' : 'amber',
          t: `Saved: ${status}. The owner sees it in the app.\n` + (sent.ok ? 'A notification was sent to their phone.' : `No phone notification: ${sent.error}`),
        });
      }
    } catch (e) {
      setMsg({ c: 'red', t: `Could not save (${e.code}). ${e.code === 'permission-denied' ? 'Check the staff Firestore rules.' : e.message}` });
    }
    setBusy('');
  }

  const addReason = (r) => setNote((n) => (n.trim() ? `${n.trim()}\n• ${r}` : `• ${r}`));

  return (
    <div className="card review">
      <h2>Decision</h2>
      {app.reviewedByName && (
        <p className="muted small">
          Last change by {app.reviewedByName} · {when(app.reviewedAt)}
        </p>
      )}
      {missing.length > 0 && <div className="alert amber">Missing files: {missing.map((k) => KIND_TITLE[k].split(' ·')[0]).join(', ')}</div>}

      <label className="small b">Note to the owner (needed when returning)</label>
      <textarea rows={6} value={note} onChange={(e) => setNote(e.target.value)} placeholder="What should the owner fix or add?" />
      {/* <div className="chips">
        {QUICK_REASONS.map((r) => (
          <button key={r} type="button" className="chip" onClick={() => addReason(r)} title={r}>
            + {r.split('.')[0]}
          </button>
        ))}
      </div> */}

      {msg && <div className={`alert ${msg.c}`}>{msg.t}</div>}

      <button className="btn red" disabled={!!busy} onClick={() => decide('Returned for completion')}>
        {busy === 'Returned for completion' ? 'Saving…' : 'Return for completion'}
      </button>
      <button className="btn green" disabled={!!busy} onClick={() => decide('Accepted')}>
        {busy === 'Accepted' ? 'Saving…' : 'Approve · Accept application'}
      </button>
      {app.status !== 'Pending' && (
        <button className="btn ghost" disabled={!!busy} onClick={() => decide('Pending')}>
          Set back to Pending
        </button>
      )}
    </div>
  );
}

/** Asks server/notify.gs to send the owner a phone notification. It reads the status and note itself. */
async function notifyPhone(applicationId) {
  const url = import.meta.env.VITE_NOTIFY_URL;
  if (!url) return { ok: false, error: 'VITE_NOTIFY_URL is not set in .env.' };
  try {
    const idToken = await auth.currentUser.getIdToken();
    // text/plain keeps it a "simple" request, which Apps Script accepts from a browser.
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ idToken, applicationId }) });
    return await res.json();
  } catch (e) {
    return { ok: false, error: `could not reach the notify service (${e.message}).` };
  }
}

function History({ items }) {
  if (!items.length) return null;
  const sorted = [...items].sort((x, y) => (y.at?.toMillis?.() || 0) - (x.at?.toMillis?.() || 0));
  return (
    <div className="card">
      <h2>History</h2>
      <ul className="history">
        {sorted.map((h, i) => (
          <li key={i}>
            <span className={`dot ${statusClass(h.action)}`} />
            <div>
              <b>{h.action}</b> <span className="muted small">· {h.by} · {when(h.at)}</span>
              {h.note && <div className="note">{h.note}</div>}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------- files

function Files({ files }) {
  const [open, setOpen] = useState(null);
  const groups = ['permit', 'annexC', 'training'];
  const uploaded = files.filter((f) => groups.includes(f.kind));
  const row = (f, title, sub) => (
    <div key={f.id}>
      <div className="file">
        <span className="pdf">PDF</span>
        <div className="grow">
          <b>{title}</b>
          <div className="muted small">{sub}</div>
        </div>
        {f.driveFileId && (
          <button className="btn ghost sm" onClick={() => setOpen(open === f.id ? null : f.id)}>
            {open === f.id ? 'Close' : 'View'}
          </button>
        )}
        {f.driveUrl && (
          <a className="btn ghost sm" href={f.driveUrl} target="_blank" rel="noreferrer">
            Open / Print
          </a>
        )}
      </div>
      {open === f.id && <iframe className="viewer" title={f.fileName} src={`https://drive.google.com/file/d/${f.driveFileId}/preview`} allow="autoplay" />}
    </div>
  );
  return (
    <>
    <Section title="Forms made by the app">
      <p className="muted small" style={{ marginTop: -6 }}>Filled in from the owner’s answers when they submitted. Ready to print.</p>
      {GENERATED.map(([kind, title]) => {
        const f = files.find((x) => x.kind === kind);
        return f ? (
          row(f, title, join([f.fileName, fileSize(f.size), f.uploadedAt ? `made ${when(f.uploadedAt)}` : ''], ' · '))
        ) : (
          <div key={kind} className="file missing">{title} · not sent (submitted with an older app version)</div>
        );
      })}
    </Section>
    <Section title={`Requirement files (${uploaded.length})`}>
      {groups.map((k) => {
        const fs = files.filter((f) => f.kind === k);
        return (
          <div key={k} className="file-group">
            <div className="file-group-title">{KIND_TITLE[k]}</div>
            {fs.length === 0 && <div className="file missing">Not uploaded</div>}
            {fs.map((f) =>
              row(
                f,
                k === 'training' ? f.title || f.fileName : f.fileName,
                join([k === 'training' ? f.provider : '', k === 'training' ? f.date : '', k === 'training' ? f.fileName : '', fileSize(f.size), f.uploadedAt ? `uploaded ${when(f.uploadedAt)}` : ''], ' · '),
              ),
            )}
          </div>
        );
      })}
      <p className="muted small">
        If a file does not show, log in to Google with an account the Drive folder is shared with, or click “Open / Print”.
      </p>
    </Section>
    </>
  );
}

// ---------------------------------------------------------------- costs

function Costs({ v, lists, kind }) {
  const period = kind === 'prod' ? 'one batch' : 'one week';
  const raw = lists[`raw_${kind}`] || [];
  const ovh = lists[`ovh_${kind}`] || [];
  const tools = lists[`tools_${kind}`] || [];
  const materials = raw.reduce((t, r) => t + (amount(r.qty) ?? 0) * (amount(r.price) ?? 0), 0);
  const labor = amount(v[`lab_${kind}`]) ?? 0;
  const other = ovh.reduce((t, o) => t + (amount(o.cost) ?? 0), 0);
  const total = materials + labor + other;
  const units = amount(v[`units_${kind}`]);
  const title = { prod: 'Cost of making', resell: 'Cost of what they resell', service: 'Cost of the service' }[kind];
  return (
    <Section title={`Step 4 · ${title} (${period})`}>
      <Table
        cols={['Item', 'Where bought', 'Qty', 'Price', 'Amount']}
        rows={raw.map((r) => [r.name, r.source, join([r.qty, r.unit], ' '), peso(r.price), peso((amount(r.qty) ?? 0) * (amount(r.price) ?? 0))])}
        right={[3, 4]}
      />
      <KV k="Materials" v={peso(materials)} />
      {kind !== 'resell' && <KV k="Tools" v={tools.map((t) => t.name).join(', ')} />}
      <KV k="Workers’ pay" v={peso(v[`lab_${kind}`])} />
      {ovh.map((o, i) => (
        <KV key={i} k={o.name} v={peso(o.cost)} />
      ))}
      <KV k={`Total cost of ${period}`} v={peso(total)} strong />
      <KV k={kind === 'service' ? 'Customers served' : 'Made or sold from this'} v={v[`units_${kind}`]} />
      {units > 0 && <KV k="Cost for each one" v={peso(total / units)} strong />}
    </Section>
  );
}

// ---------------------------------------------------------------- statements

function Statements({ answers }) {
  const years = allYears(answers);
  const [pick, setPick] = useState(years.length ? years[years.length - 1].year : null);
  if (!years.length) {
    return (
      <Section title="Step 5 · Financial statements">
        <div className="muted">No statements entered.</div>
      </Section>
    );
  }
  const y = years.find((x) => x.year === pick) || years[years.length - 1];
  const drawingsNegative = (y.bs.dr ?? 0) < 0;
  return (
    <Section title="Step 5 · Financial statements">
      <div className="tabs small">
        {years.map((x) => (
          <button key={x.year} className={`tab ${x.year === y.year ? 'on' : ''}`} onClick={() => setPick(x.year)}>
            {x.year}
          </button>
        ))}
      </div>
      {drawingsNegative && <div className="alert amber">Drawings are below zero in {y.year}: assets are more than capital + net income. Worth checking.</div>}
      <div className="fs-grid">
        <FsTable title="Income statement" rows={ROWS.inc} data={y.inc} first={y.first} />
        <div>
          <FsTable title="Cash flow statement" rows={ROWS.cf} data={y.cf} first={y.first} />
          <FsTable title={`Balance sheet · Dec 31, ${y.year}`} rows={ROWS.bs} data={y.bs} first={y.first} />
        </div>
      </div>
      <p className="muted small">
        <span className="calc-key">Grey</span> lines are worked out from what the owner typed (same rules as the app). Blank means the owner left it empty.
      </p>
    </Section>
  );
}

function FsTable({ title, rows, data, first }) {
  return (
    <table className="fs">
      <caption>{title}</caption>
      <tbody>
        {rows.map(([label, key, style], i) =>
          key === null ? (
            <tr key={i} className="h">
              <td colSpan={2}>{label}</td>
            </tr>
          ) : (
            <tr key={i} className={`${style || ''} ${isCalculated(key, first) ? 'calc' : ''}`}>
              <td>{label}</td>
              <td className="r">{data[key] === undefined || data[key] === null ? <span className="blank">blank</span> : fsAmount(data[key])}</td>
            </tr>
          ),
        )}
      </tbody>
    </table>
  );
}

// ---------------------------------------------------------------- small parts

function WorkerCheck({ workers }) {
  const ok = workers.filter((w) => (amount(w.years) ?? 0) >= 2 && w.iloilo !== 'No').length;
  return (
    <div className={`alert ${ok >= 2 ? 'green' : 'amber'}`}>
      {ok} worker{ok === 1 ? '' : 's'} with 2+ years and living in Iloilo {ok >= 2 ? '— meets' : '— does not meet'} the barangay certificate rule (2 needed).
    </div>
  );
}

function Section({ title, children }) {
  return (
    <section className="card">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

function KV({ k, v, strong }) {
  const empty = v === undefined || v === null || String(v).trim() === '' || v === '—';
  return (
    <div className={`kv ${strong ? 'strong' : ''}`}>
      <span className="k">{k}</span>
      <span className={`v ${empty ? 'empty' : ''}`}>{empty ? 'Not filled in' : v}</span>
    </div>
  );
}

function Table({ cols, rows, right = [] }) {
  if (!rows.length) return <div className="kv"><span className="v empty">Nothing added</span></div>;
  return (
    <div className="table-scroll">
      <table className="list plain">
        <thead>
          <tr>{cols.map((c, i) => <th key={c} className={right.includes(i) ? 'r' : ''}>{c}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>{r.map((c, j) => <td key={j} className={right.includes(j) ? 'r' : ''}>{c || '—'}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}