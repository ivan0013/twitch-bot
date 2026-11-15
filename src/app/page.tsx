'use client';

import { useCallback, useEffect, useState } from 'react';

type Entry = { id: string; username: string; joinedAt: string };
type QueueState = { isOpen: boolean; entries: Entry[] };
export default function Home() {
  const [state, setState] = useState<QueueState | null>(null);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [working, setWorking] = useState(false);
  const refresh = useCallback(async () => {
    try {
      const response = await fetch('/api/queue', { cache: 'no-store' });
      if (!response.ok) throw new Error('No se pudo consultar la cola. Revisa Neon y las migraciones.');
      setState(await response.json()); setError('');
    } catch (e) { setError(e instanceof Error ? e.message : 'Error desconocido'); }
  }, []);
  useEffect(() => { void refresh(); const timer = setInterval(() => void refresh(), 5000); return () => clearInterval(timer); }, [refresh]);
  async function run(action: string) {
    if (!password || working) return;
    setWorking(true); setNotice('');
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
    <header className="topbar"><a className="brand" href="/">QUEUE<span>CTRL</span><b>.</b></a><span className="header-note">TWITCH / CONTROL ROOM</span><span className="live-dot">LIVE SYNC</span></header>
    <section className="hero"><div className="eyebrow">TU DIRECTO, TU RITMO <span>— 01 / QUEUE MANAGER</span></div><h1>La siguiente<br/><em>partida</em> empieza aquí<span className="accent">.</span></h1><p>Tu chat decide quién se apunta. Tú decides cuándo empieza el siguiente turno.</p></section>
    <section className="dashboard">
      <div className="queue-panel">
        <div className="panel-heading"><div><span className="kicker">EN TIEMPO REAL</span><h2>Lista de espera <span className="count">{state?.entries.length ?? '—'}</span></h2></div><span className={'status ' + (state?.isOpen ? 'open' : 'closed')}>{state ? state.isOpen ? '● ABIERTA' : '● CERRADA' : 'CARGANDO'}</span></div>
        {error && <p className="error" role="alert">{error}</p>}
        {!state ? <div className="empty">Conectando con la cola…</div> : state.entries.length === 0 ? <div className="empty"><span>↗</span><strong>Aún no hay nadie esperando.</strong><small>Escribe !join en el chat para entrar en la cola.</small></div> :
          <ol className="entries">{state.entries.map((entry, index) => <li key={entry.id}><span className="position">{String(index + 1).padStart(2, '0')}</span><span className="avatar">{entry.username[0]?.toUpperCase()}</span><strong>@{entry.username}</strong>{index === 0 && <span className="next-tag">SIGUIENTE</span>}<small>{new Date(entry.joinedAt).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</small></li>)}</ol>}
        <div className="queue-footer">ACTUALIZACIÓN AUTOMÁTICA CADA 5 SEGUNDOS <span>↻</span></div>
      </div>
      <aside className="side-panel"><span className="kicker">SOLO STREAMER</span><h2>Control de cola<span className="accent">.</span></h2><label htmlFor="password">Contraseña de administrador</label><input id="password" type="password" autoComplete="off" value={password} onChange={e => setPassword(e.target.value)} placeholder="Introduce tu clave" /><p className="hint">La clave solo se utiliza para enviar acciones; no se guarda en el navegador.</p><button className="primary" disabled={!password || working} onClick={() => void run('next')}>Siguiente jugador <span>↗</span></button><div className="actions"><button disabled={!password || working} onClick={() => void run(state?.isOpen ? 'close' : 'open')}>{state?.isOpen ? 'Cerrar cola' : 'Abrir cola'}</button><button disabled={!password || working} onClick={() => { if (window.confirm('¿Vaciar toda la lista de espera?')) void run('clear'); }}>Vaciar cola</button></div>{notice && <p className="notice" role="status">{notice}</p>}<div className="commands"><span className="kicker">COMANDOS DE CHAT</span><p><code>!join</code> Apuntarse</p><p><code>!salir</code> Abandonar</p><p><code>!cola</code> Ver estado</p><p><code>!siguiente</code> Solo streamer</p></div></aside>
    </section><footer>QUEUECTRL / BUILT WITH IDEAS. <span>READY WHEN YOU ARE ↗</span></footer>
  </main>;
}
