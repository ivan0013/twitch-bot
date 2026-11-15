'use client';

import { useCallback, useEffect, useState } from 'react';

type Entry = { id: string; username: string; joinedAt: string };
type QueueState = { isOpen: boolean; entries: Entry[]; demo?: boolean };
type TwitchConnection = { ready: boolean; connected: boolean; login?: string | null };
const DEMO_KEY = 'queuectrl-demo-v1';
const DEMO_NAMES = ['pixelpirata', 'MareaGamer', 'LunaByte', 'NexoPlay', 'GaliciaGG'];
function initialDemo(): QueueState {
  return { demo: true, isOpen: true, entries: DEMO_NAMES.map((username, i) => ({ id: 'demo-' + i, username, joinedAt: new Date(Date.now() - (5 - i) * 60000).toISOString() })) };
}
function loadDemo() {
  try { const value = localStorage.getItem(DEMO_KEY); if (value) return JSON.parse(value) as QueueState; } catch {}
  return initialDemo();
}
export default function Home() {
  const [state, setState] = useState<QueueState | null>(null);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [working, setWorking] = useState(false);
  const [newViewer, setNewViewer] = useState('');
  const [twitch, setTwitch] = useState<TwitchConnection | null>(null);
  const [connecting, setConnecting] = useState(false);
  useEffect(() => {
    fetch('/api/auth/twitch/status', { cache: 'no-store' }).then(r => r.json()).then(setTwitch).catch(() => setTwitch({ ready: false, connected: false }));
    const outcome = new URLSearchParams(window.location.search).get('twitch');
    if (outcome) {
      setNotice(outcome === 'connected' ? 'Twitch conectado correctamente.' : outcome === 'connected_webhook_pending'
        ? 'Cuenta conectada. Falta completar la suscripción al chat de Twitch.' : 'No se pudo completar la conexión con Twitch (' + outcome + ').');
      window.history.replaceState(null, '', '/');
    }
  }, []);
  async function connectTwitch() {
    if (!password || connecting) { setNotice('Introduce primero la contraseña de administrador.'); return; }
    setConnecting(true);
    try {
      const result = await fetch('/api/auth/twitch/start', { method: 'POST',
        headers: { Authorization: 'Basic ' + btoa('admin:' + password) } });
      const body = await result.json() as { url?: string; error?: string };
      if (!result.ok || !body.url) throw new Error(body.error ?? 'No se pudo iniciar la conexión');
      window.location.assign(body.url);
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Error de conexión'); setConnecting(false); }
  }
  const refresh = useCallback(async () => {
    try {
      const response = await fetch('/api/queue', { cache: 'no-store' });
      if (!response.ok) throw new Error('No se pudo consultar la cola. Revisa Neon y las migraciones.');
      const payload: QueueState = await response.json();
      setState(payload.demo ? loadDemo() : payload); setError('');
    } catch (e) { setError(e instanceof Error ? e.message : 'Error desconocido'); }
  }, []);
  useEffect(() => { void refresh(); const timer = setInterval(() => void refresh(), 5000); return () => clearInterval(timer); }, [refresh]);
  async function run(action: string) {
    if ((!state?.demo && !password) || working) return;
    setWorking(true); setNotice('');
    if (state?.demo) {
      const current = loadDemo();
      let viewer: string | null = null;
      if (action === 'open') current.isOpen = true;
      else if (action === 'close') current.isOpen = false;
      else if (action === 'clear') current.entries = [];
      else if (action === 'next') viewer = current.entries.shift()?.username ?? null;
      else if (action === 'add' && newViewer.trim() && current.isOpen) {
        const username = newViewer.trim().replace(/^@/, '').slice(0, 25);
        if (!current.entries.some(e => e.username.toLowerCase() === username.toLowerCase())) current.entries.push({ id: crypto.randomUUID(), username, joinedAt: new Date().toISOString() });
        setNewViewer('');
      }
      localStorage.setItem(DEMO_KEY, JSON.stringify(current));
      setState({ ...current });
      setNotice(action === 'next' ? (viewer ? 'Le toca jugar a @' + viewer : 'La cola está vacía.') : 'Simulación actualizada.');
      setWorking(false);
      return;
    }
    try {
      const response = await fetch('/api/queue', { method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Basic ' + btoa('admin:' + password) },
        body: JSON.stringify({ action }) });
      const data = await response.json();
      if (!response.ok) throw new Error(response.status === 401 ? 'Contraseña incorrecta.' : data.error ?? 'Error');
      setNotice(action === 'next' ? (data.viewer ? 'Le toca jugar a @' + data.viewer : 'La cola está vacía.') : 'Cambio guardado.');
      await refresh();
    } catch (e) { setNotice(e instanceof Error ? e.message : 'Error'); }
    finally { setWorking(false); }
  }
  return <main className="shell">
    <header className="topbar"><a className="brand" href="/">QUEUE<span>CTRL</span><b>.</b></a><span className="header-note">TWITCH / CONTROL ROOM</span><span className="live-dot">{state?.demo ? '● MODO DEMO' : '● LIVE SYNC'}</span></header>
    <section className="hero"><div className="eyebrow">TU DIRECTO, TU RITMO <span>— 01 / QUEUE MANAGER</span></div><h1>La siguiente<br/><em>partida</em> empieza aquí<span className="accent">.</span></h1><p>Tu chat decide quién se apunta. Tú decides cuándo empieza el siguiente turno.</p></section>
    {state?.demo && <p className="demo-banner">MODO DEMOSTRACIÓN · Los jugadores son ficticios. Los cambios se guardan solo en este navegador. No hay conexión a Twitch.</p>}
    <section className="dashboard">
      <div className="queue-panel">
        <div className="panel-heading"><div><span className="kicker">EN TIEMPO REAL</span><h2>Lista de espera <span className="count">{state?.entries.length ?? '—'}</span></h2></div><span className={'status ' + (state?.isOpen ? 'open' : 'closed')}>{state ? state.isOpen ? '● ABIERTA' : '● CERRADA' : 'CARGANDO'}</span></div>
        {error && <p className="error" role="alert">{error}</p>}
        {!state ? <div className="empty">Conectando con la cola…</div> : state.entries.length === 0 ? <div className="empty"><span>↗</span><strong>Aún no hay nadie esperando.</strong><small>Escribe !join en el chat para entrar en la cola.</small></div> :
          <ol className="entries">{state.entries.map((entry, index) => <li key={entry.id}><span className="position">{String(index + 1).padStart(2, '0')}</span><span className="avatar">{entry.username[0]?.toUpperCase()}</span><strong>@{entry.username}</strong>{index === 0 && <span className="next-tag">SIGUIENTE</span>}<small>{new Date(entry.joinedAt).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</small></li>)}</ol>}
        <div className="queue-footer">ACTUALIZACIÓN AUTOMÁTICA CADA 5 SEGUNDOS <span>↻</span></div>
      </div>
      <aside className="side-panel"><span className="kicker">SOLO STREAMER</span><h2>Control de cola<span className="accent">.</span></h2>{!state?.demo && <><label htmlFor="password">Contraseña de administrador</label><input id="password" type="password" autoComplete="off" value={password} onChange={e => setPassword(e.target.value)} placeholder="Introduce tu clave" /><p className="hint">La clave solo se utiliza para enviar acciones; no se guarda en el navegador.</p></>}
      {state?.demo && <><label htmlFor="demo-viewer">Simular nuevo viewer</label><div className="demo-add"><input id="demo-viewer" value={newViewer} onChange={e => setNewViewer(e.target.value)} maxLength={25} placeholder="Nombre de viewer" /><button disabled={!newViewer.trim() || !state.isOpen || working} onClick={() => void run('add')}>+ Añadir</button></div><button className="reset-demo" onClick={() => { const fresh = initialDemo(); localStorage.setItem(DEMO_KEY, JSON.stringify(fresh)); setState(fresh); setNotice('Demo reiniciada.'); }}>↺ Reiniciar demo</button></>}<button className="primary" disabled={(!state?.demo && !password) || working} onClick={() => void run('next')}>Siguiente jugador <span>↗</span></button><div className="actions"><button disabled={(!state?.demo && !password) || working} onClick={() => void run(state?.isOpen ? 'close' : 'open')}>{state?.isOpen ? 'Cerrar cola' : 'Abrir cola'}</button><button disabled={(!state?.demo && !password) || working} onClick={() => { if (window.confirm('¿Vaciar toda la lista de espera?')) void run('clear'); }}>Vaciar cola</button></div>{notice && <p className="notice" role="status">{notice}</p>}<div className="twitch-connect"><span className="kicker">INTEGRACIÓN TWITCH</span>
        <p>{twitch?.connected ? '✓ Conectado como @' + twitch.login : twitch?.ready ? 'Listo para autorizar tu canal.' : 'Pendiente de configuración de Twitch y Neon en Vercel.'}</p>
        <button className="connect-button" disabled={connecting || !twitch?.ready || !password} onClick={() => void connectTwitch()}>{connecting ? 'Redirigiendo…' : twitch?.connected ? 'Volver a conectar Twitch' : 'Conectar con Twitch ↗'}</button>
        {!twitch?.ready && <small>Necesitas configurar las credenciales y la base de datos para activar la conexión real. La demo seguirá funcionando.</small>}
      </div><div className="commands"><span className="kicker">COMANDOS DE CHAT</span><p><code>!join</code> Apuntarse</p><p><code>!salir</code> Abandonar</p><p><code>!cola</code> Ver estado</p><p><code>!siguiente</code> Solo streamer</p></div></aside>
    </section><footer>QUEUECTRL / BUILT WITH IDEAS. <span>READY WHEN YOU ARE ↗</span></footer>
  </main>;
}
