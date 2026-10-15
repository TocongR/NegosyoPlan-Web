import { useEffect, useState } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from './firebase.js';
import LoginPage from './LoginPage.jsx';
import OverviewPage from './OverviewPage.jsx';
import ApplicationsPage from './ApplicationsPage.jsx';
import ApplicationPage from './ApplicationPage.jsx';

/** Reads the address bar: "#/app/<uid>" = one application, "#/overview" = overview, anything else = the list. */
function useHashRoute() {
  const read = () => {
    const h = window.location.hash;
    const m = h.match(/^#\/app\/([^/?]+)/);
    if (m) return { page: 'app', id: decodeURIComponent(m[1]) };
    if (h.startsWith('#/overview')) return { page: 'overview' };
    return { page: 'list' };
  };
  const [route, setRoute] = useState(read);
  useEffect(() => {
    const on = () => setRoute(read());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}

export default function App() {
  const [user, setUser] = useState(undefined); // undefined = still checking
  const [staff, setStaff] = useState(null); // staff/{uid} document, or null
  const [denied, setDenied] = useState('');
  const route = useHashRoute();

  useEffect(
    () =>
      onAuthStateChanged(auth, async (u) => {
        setDenied('');
        if (!u) {
          setStaff(null);
          setUser(null);
          return;
        }
        try {
          const s = await getDoc(doc(db, 'staff', u.uid));
          if (s.exists()) {
            setStaff({ uid: u.uid, email: u.email, ...s.data() });
          } else {
            setDenied(`${u.email} is not an OLEDIPO staff account.`);
            await signOut(auth);
          }
        } catch (e) {
          setDenied(`Could not check staff access: ${e.code || e.message}`);
          await signOut(auth);
        }
        setUser(u);
      }),
    [],
  );

  // After logging in with no page chosen, land on the Overview.
  useEffect(() => {
    if (staff && !window.location.hash) window.location.hash = '#/overview';
  }, [staff]);

  if (user === undefined) return <div className="center muted">Loading…</div>;
  if (!staff) return <LoginPage notice={denied} />;

  return (
    <div className="shell">
      <aside className="sidebar">
        <a href="#/overview" className="brand">
          <span className="logo">
            <img src="/logo.png" alt="" />
          </span>
          <span className="brand-name">NegosyoPlan</span>
        </a>
        <div className="brand-sub">OLEDIPO Admin · EMBRACE Program</div>

        <nav className="nav">
          <a href="#/overview" className={`nav-item ${route.page === 'overview' ? 'on' : ''}`}>
            Overview
          </a>
          <a href="#/" className={`nav-item ${route.page === 'overview' ? '' : 'on'}`}>
            MSME Passports
          </a>
        </nav>

        <div className="side-foot">
          <div className="who">
            Signed in as
            <br />
            <b>{staff.name || staff.email}</b> · Admin
          </div>
          <button className="btn side-out" onClick={() => signOut(auth)}>
            Log out
          </button>
        </div>
      </aside>

      <main className="content">
        {route.page === 'app' && <ApplicationPage id={route.id} staff={staff} />}
        {route.page === 'overview' && <OverviewPage />}
        {route.page === 'list' && <ApplicationsPage />}
      </main>
    </div>
  );
}