import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { invoke } from '@tauri-apps/api/core';
import {
  Activity, AlarmClock, ArrowDown, ArrowUp, Bell, Bot, Check, CheckCheck, ChevronDown,
  ChevronLeft, ChevronRight, CircleHelp, Clock3, Code2, FileText, Folder, Gauge, Grid2X2,
  History, Image, Laptop2, ListTodo, LoaderCircle, LockKeyhole, MessageSquare, MoreHorizontal,
  Paperclip, PanelRightClose, PanelRightOpen, Plus, Search, Send, Settings2, ShieldCheck,
  Sparkles, Square, X, Zap,
} from 'lucide-react';
import './style.css';

type View = 'chats' | 'activity' | 'approvals' | 'routines' | 'computer';
type Message = { id: string; role: 'user' | 'assistant'; text: string; time: number; attachment?: string };
type BotProfile = { id: string; name: string; description: string; model: string; tone: string; color: string; updated: number };
type Routine = { id: string; name: string; schedule: string; enabled: boolean; lastRun: string };
type Approval = { id: string; title: string; detail: string; app: string; time: string; status: 'pending' | 'approved' | 'denied' };
type Workspace = { bots: BotProfile[]; selectedBot: string; messages: Record<string, Message[]>; routines: Routine[]; approvals: Approval[] };

const colors = ['#d5f278', '#8cbcff', '#d5a2ff', '#ffb775', '#81ddd2', '#ff8f9c'];
const seedBots: BotProfile[] = [
  { id: 'main', name: 'Grok Bot', description: 'Tu asistente general', model: 'Grok 3', tone: 'Directo y útil', color: colors[0], updated: Date.now() },
  { id: 'research', name: 'Researcher', description: 'Investiga y resume información', model: 'Grok 3', tone: 'Analítico', color: colors[1], updated: Date.now() },
  { id: 'coding', name: 'Code helper', description: 'Ayuda con programación', model: 'Grok 3', tone: 'Técnico', color: colors[2], updated: Date.now() },
];
const seedApprovals: Approval[] = [
  { id: 'a1', title: 'Enviar correo a Maya', detail: 'Compartir el resumen del proyecto y los próximos pasos.', app: 'Mail', time: 'Hace 2 min', status: 'pending' },
  { id: 'a2', title: 'Mover 4 archivos', detail: 'Organizar los documentos de la carpeta Downloads en Projects.', app: 'Finder', time: 'Hace 18 min', status: 'pending' },
  { id: 'a3', title: 'Abrir enlace externo', detail: 'https://linear.app/acme/issue/AT-204', app: 'Browser', time: 'Ayer', status: 'approved' },
];
const seedRoutines: Routine[] = [
  { id: 'r1', name: 'Briefing de la mañana', schedule: 'Cada día · 8:30 AM', enabled: true, lastRun: 'Hoy, 8:30 AM' },
  { id: 'r2', name: 'Revisar tareas abiertas', schedule: 'Lunes a viernes · 4:00 PM', enabled: true, lastRun: 'Ayer, 4:00 PM' },
  { id: 'r3', name: 'Resumen semanal', schedule: 'Viernes · 3:30 PM', enabled: false, lastRun: '14 nov, 3:30 PM' },
];
const initialWorkspace: Workspace = { bots: seedBots, selectedBot: 'main', messages: {}, routines: seedRoutines, approvals: seedApprovals };
const navItems: { id: View; label: string; icon: React.ElementType }[] = [
  { id: 'chats', label: 'Chats', icon: MessageSquare },
  { id: 'activity', label: 'Actividad', icon: Activity },
  { id: 'approvals', label: 'Aprobaciones', icon: ShieldCheck },
  { id: 'routines', label: 'Rutinas', icon: AlarmClock },
  { id: 'computer', label: 'Computer', icon: Laptop2 },
];

function readLocal(): Workspace {
  try {
    const value = localStorage.getItem('auton-workspace');
    if (value) {
      const parsed = JSON.parse(value) as Workspace;
      if (parsed.bots?.length) return { ...initialWorkspace, ...parsed };
    }
  } catch { /* use the starter workspace */ }
  return initialWorkspace;
}

function App() {
  const [workspace, setWorkspace] = useState<Workspace>(readLocal);
  const [view, setView] = useState<View>('chats');
  const [query, setQuery] = useState('');
  const [draft, setDraft] = useState('');
  const [fileName, setFileName] = useState('');
  const [rightOpen, setRightOpen] = useState(false);
  const [modal, setModal] = useState<'bot' | 'routine' | 'settings' | null>(null);
  const [editingBot, setEditingBot] = useState<BotProfile | null>(null);
  const [newBotName, setNewBotName] = useState('');
  const [newBotDescription, setNewBotDescription] = useState('');
  const [newRoutineName, setNewRoutineName] = useState('');
  const [online, setOnline] = useState(true);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState('');
  const [previewUpdated, setPreviewUpdated] = useState('justo ahora');
  const fileInput = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    invoke<string | null>('load_workspace').then((saved) => {
      if (saved) {
        const parsed = JSON.parse(saved) as Workspace;
        if (parsed.bots?.length) setWorkspace({ ...initialWorkspace, ...parsed });
      }
    }).catch(() => { /* localStorage keeps the web preview usable */ });
  }, []);

  useEffect(() => {
    const contents = JSON.stringify(workspace);
    localStorage.setItem('auton-workspace', contents);
    const timer = window.setTimeout(() => {
      invoke('save_workspace', { contents }).catch(() => undefined);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [workspace]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [workspace.messages, workspace.selectedBot, view]);
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(''), 2400);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const activeBot = workspace.bots.find((bot) => bot.id === workspace.selectedBot) ?? workspace.bots[0];
  const messages = workspace.messages[workspace.selectedBot] ?? [];
  const filteredBots = useMemo(() => workspace.bots.filter((bot) => bot.name.toLowerCase().includes(query.toLowerCase())), [workspace.bots, query]);
  const pendingApprovals = workspace.approvals.filter((item) => item.status === 'pending').length;

  const updateMessages = (botId: string, next: Message[]) => setWorkspace((current) => ({ ...current, messages: { ...current.messages, [botId]: next } }));
  const newChat = () => {
    updateMessages(workspace.selectedBot, []);
    setDraft('');
    setFileName('');
    setView('chats');
  };
  const localReply = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return 'Claro. Cuéntame un poco más y lo preparo.';
    if (/resum|summary|brief/i.test(trimmed)) return 'Puedo ayudarte con eso. Comparte el texto o los archivos que quieres resumir y te devuelvo los puntos clave, decisiones y siguientes pasos.';
    if (/código|code|bug|error|rust|react/i.test(trimmed)) return 'Vamos a resolverlo. Pásame el fragmento relevante y el comportamiento esperado; revisaré el flujo, las causas posibles y una solución concreta.';
    if (/plan|organiza|schedule|rutina/i.test(trimmed)) return 'Te propongo dividirlo en pasos pequeños, definir qué resultado buscamos y después dejar una rutina para que Auton lo repita. ¿Cuál es el plazo y qué debe quedar hecho?';
    return `Entendido. Voy a trabajar en “${trimmed.length > 72 ? `${trimmed.slice(0, 69)}…` : trimmed}”.\n\nEn esta primera versión puedo organizar la tarea, proponer pasos y dejar el resultado en esta conversación. Las conexiones a modelos y servicios externos se añadirán después.`;
  };
  const sendMessage = () => {
    const content = draft.trim();
    if ((!content && !fileName) || loading) return;
    const messageText = content || `Revisa este archivo: ${fileName}`;
    const userMessage: Message = { id: crypto.randomUUID(), role: 'user', text: messageText, time: Date.now(), attachment: fileName || undefined };
    const updated = [...messages, userMessage];
    updateMessages(workspace.selectedBot, updated);
    setDraft('');
    setFileName('');
    setLoading(true);
    const reply = localReply(messageText);
    window.setTimeout(() => {
      const answer: Message = { id: crypto.randomUUID(), role: 'assistant', text: reply, time: Date.now() };
      setWorkspace((current) => ({ ...current, messages: { ...current.messages, [current.selectedBot]: [...(current.messages[current.selectedBot] ?? []), answer] } }));
      setLoading(false);
    }, 650);
  };
  const openBotModal = (bot: BotProfile | null = null) => {
    setEditingBot(bot);
    setNewBotName(bot?.name ?? '');
    setNewBotDescription(bot?.description ?? '');
    setModal('bot');
  };
  const saveBot = () => {
    const name = newBotName.trim();
    if (!name) return;
    if (editingBot) {
      setWorkspace((current) => ({ ...current, bots: current.bots.map((bot) => bot.id === editingBot.id ? { ...bot, name, description: newBotDescription.trim() } : bot) }));
      setToast('Bot actualizado');
    } else {
      const bot: BotProfile = { id: crypto.randomUUID(), name, description: newBotDescription.trim() || 'Tu nuevo asistente', model: 'Grok 3', tone: 'Directo y útil', color: colors[workspace.bots.length % colors.length], updated: Date.now() };
      setWorkspace((current) => ({ ...current, bots: [...current.bots, bot], selectedBot: bot.id }));
      setView('chats');
      setToast('Bot creado');
    }
    setModal(null);
  };
  const addRoutine = () => {
    if (!newRoutineName.trim()) return;
    const item: Routine = { id: crypto.randomUUID(), name: newRoutineName.trim(), schedule: 'Todos los días · 9:00 AM', enabled: true, lastRun: 'Todavía no se ha ejecutado' };
    setWorkspace((current) => ({ ...current, routines: [item, ...current.routines] }));
    setNewRoutineName('');
    setModal(null);
    setToast('Rutina creada');
  };
  const updateApproval = (id: string, status: 'approved' | 'denied') => {
    setWorkspace((current) => ({ ...current, approvals: current.approvals.map((item) => item.id === id ? { ...item, status } : item) }));
    setToast(status === 'approved' ? 'Acción aprobada' : 'Acción rechazada');
  };
  const quickPrompt = (text: string) => { setDraft(text); document.querySelector<HTMLTextAreaElement>('.composer-input')?.focus(); };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-row">
          <div className="brand-mark"><Sparkles size={18} strokeWidth={2.4} /></div>
          <span className="brand-name">auton</span>
          <button className="icon-button sidebar-collapse" title="Contraer menú"><PanelRightClose size={16} /></button>
        </div>
        <div className="workspace-switcher"><div className="workspace-avatar">A</div><span><b>Personal</b><small>Espacio de trabajo</small></span><ChevronDown size={15} /></div>
        <button className="new-chat-button" onClick={newChat}><Plus size={16} /> Nuevo chat <kbd>⌘ K</kbd></button>
        <div className="nav-list">
          {navItems.map(({ id, label, icon: Icon }) => <button key={id} className={`nav-item ${view === id ? 'selected' : ''}`} onClick={() => setView(id)}><Icon size={17} strokeWidth={1.8} /><span>{label}</span>{id === 'approvals' && pendingApprovals > 0 && <b className="nav-count">{pendingApprovals}</b>}</button>)}
        </div>
        <div className="section-heading"><span>TUS BOTS</span><button className="icon-button tiny" title="Buscar bots" onClick={() => document.querySelector<HTMLInputElement>('.bot-search')?.focus()}><Search size={14} /></button></div>
        <div className="bot-search-wrap"><Search size={14} /><input className="bot-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar bot" /></div>
        <div className="bot-list">
          {filteredBots.map((bot) => <button key={bot.id} className={`bot-row ${view === 'chats' && activeBot.id === bot.id ? 'selected' : ''}`} onClick={() => { setWorkspace((current) => ({ ...current, selectedBot: bot.id })); setView('chats'); }}><span className="bot-avatar" style={{ '--bot-color': bot.color } as React.CSSProperties}><Bot size={15} /></span><span className="bot-row-copy"><b>{bot.name}</b><small>{bot.description}</small></span><MoreHorizontal className="bot-more" size={15} onClick={(event) => { event.stopPropagation(); openBotModal(bot); }} /></button>)}
          {filteredBots.length === 0 && <div className="empty-search">No hay bots con ese nombre.</div>}
          <button className="add-bot-row" onClick={() => openBotModal()}><span><Plus size={14} /></span> Crear un bot</button>
        </div>
        <div className="sidebar-footer">
          <div className="usage-card"><div className="usage-icon"><Gauge size={15} /></div><div><b>Tu espacio está listo</b><small>Conversaciones guardadas localmente</small></div><ChevronRight size={15} /></div>
          <button className="profile-row" onClick={() => setModal('settings')}><div className="profile-avatar">E</div><span><b>Tu cuenta</b><small>Configuración</small></span><MoreHorizontal size={16} /></button>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar"><div className="breadcrumbs"><span className="crumb-muted">Auton</span><ChevronRight size={14} /><span>{view === 'chats' ? activeBot.name : navItems.find((item) => item.id === view)?.label}</span>{view === 'chats' && <span className="model-pill"><span className="online-dot" />{activeBot.model}<ChevronDown size={12} /></span>}</div><div className="top-actions"><button className="top-action" onClick={() => setToast('El historial está guardado en este dispositivo')}><History size={15} /><span>Historial</span></button><button className="top-action" onClick={() => setToast('No tienes notificaciones nuevas')}><Bell size={15} /><span>Notificaciones</span></button><span className="top-divider" /><button className="icon-button" title="Ayuda" onClick={() => setToast('Auton · versión inicial')}><CircleHelp size={17} /></button><button className="top-avatar" onClick={() => setModal('settings')}>E</button></div></header>

        {view === 'chats' && <div className={`chat-layout ${rightOpen ? 'with-inspector' : ''}`}>
          <section className="chat-column">
            <div className="chat-toolbar"><div className="chat-title"><span className="title-bot-avatar" style={{ '--bot-color': activeBot.color } as React.CSSProperties}><Bot size={17} /></span><span><b>{activeBot.name}</b><small>{activeBot.description}</small></span></div><div className="chat-tools"><button className="icon-button" title="Nuevo chat" onClick={newChat}><Plus size={17} /></button><button className="icon-button" title="Detalles del bot" onClick={() => setRightOpen(!rightOpen)}>{rightOpen ? <PanelRightClose size={17} /> : <PanelRightOpen size={17} />}</button><button className="icon-button" title="Más opciones" onClick={() => openBotModal(activeBot)}><MoreHorizontal size={18} /></button></div></div>
            <div className="messages-scroll">
              {messages.length === 0 ? <div className="welcome-block"><div className="welcome-orbit"><div className="welcome-spark"><Sparkles size={23} /></div><span className="orbit orbit-one" /><span className="orbit orbit-two" /></div><p className="eyebrow">TU ESPACIO, TU ASISTENTE</p><h1>¿Qué hacemos <span>hoy?</span></h1><p className="welcome-subtitle">Estoy listo para ayudarte a pensar, crear y avanzar.</p><div className="suggestion-grid"><button onClick={() => quickPrompt('Ayúdame a organizar mi día y elegir las prioridades')}><span className="suggestion-icon lilac"><ListTodo size={17} /></span><span><b>Organiza mi día</b><small>Prioridades y tareas</small></span><ArrowUp size={14} /></button><button onClick={() => quickPrompt('Investiga y resume los puntos más importantes sobre ')}><span className="suggestion-icon blue"><Search size={17} /></span><span><b>Investiga un tema</b><small>Encuentra lo importante</small></span><ArrowUp size={14} /></button><button onClick={() => quickPrompt('Ayúdame a escribir un borrador para ')}><span className="suggestion-icon peach"><FileText size={17} /></span><span><b>Escribe un borrador</b><small>Empieza con una idea</small></span><ArrowUp size={14} /></button><button onClick={() => quickPrompt('Ayúdame a revisar este código y encontrar mejoras')}><span className="suggestion-icon green"><Code2 size={17} /></span><span><b>Revisa mi código</b><small>Encuentra mejoras</small></span><ArrowUp size={14} /></button></div></div> : <div className="message-list">{messages.map((message) => <MessageBubble key={message.id} message={message} />)}{loading && <div className="assistant-message"><div className="assistant-mark"><Sparkles size={14} /></div><div className="typing"><span /><span /><span /></div></div>}<div ref={bottomRef} /></div>}
            </div>
            <div className="composer-zone"><div className="composer"><textarea className="composer-input" rows={1} placeholder={`Escribe a ${activeBot.name}...`} value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); sendMessage(); } }} /><div className="composer-bottom"><div className="composer-tools"><button className="composer-tool" onClick={() => fileInput.current?.click()} title="Adjuntar archivo"><Paperclip size={16} /><span>Adjuntar</span></button><input ref={fileInput} type="file" hidden onChange={(event) => setFileName(event.target.files?.[0]?.name ?? '')} /><button className={`composer-tool ${online ? '' : 'muted-tool'}`} onClick={() => setOnline(!online)} title="Alternar acceso a internet"><Zap size={15} /><span>{online ? 'Web activa' : 'Web desactivada'}</span><span className={`switch ${online ? 'on' : ''}`} /></button>{fileName && <span className="attachment-chip"><FileText size={13} />{fileName}<button onClick={() => setFileName('')}><X size={12} /></button></span>}</div><button className={`send-button ${(draft.trim() || fileName) ? 'ready' : ''}`} onClick={sendMessage} disabled={!draft.trim() && !fileName}><ArrowUp size={17} /></button></div></div><div className="composer-caption">Auton puede cometer errores. Revisa la información importante.</div></div>
          </section>
          {rightOpen && <aside className="inspector"><div className="inspector-header"><span>Detalles</span><button className="icon-button" onClick={() => setRightOpen(false)}><X size={16} /></button></div><div className="inspector-bot"><span className="inspector-avatar" style={{ '--bot-color': activeBot.color } as React.CSSProperties}><Bot size={23} /></span><h3>{activeBot.name}</h3><p>{activeBot.description}</p><button className="outline-button" onClick={() => openBotModal(activeBot)}><Settings2 size={14} /> Configurar bot</button></div><div className="inspector-section"><span className="inspector-label">MODELO</span><button className="model-select" onClick={() => setToast('Grok 3 · modelo local de demostración')}>{activeBot.model}<ChevronDown size={14} /></button></div><div className="inspector-section"><span className="inspector-label">INSTRUCCIONES</span><div className="instructions-card">{activeBot.tone}. Usa un lenguaje claro y ofrece pasos concretos.</div></div><div className="inspector-section"><span className="inspector-label">HERRAMIENTAS</span><div className="tool-status"><span><Search size={15} /> Buscar en la web</span><span className={`status-switch ${online ? 'enabled' : ''}`} /></div><div className="tool-status"><span><Folder size={15} /> Archivos locales</span><span className="status-switch enabled" /></div></div><div className="inspector-footer"><LockKeyhole size={13} /> Tus conversaciones permanecen en este dispositivo.</div></aside>}
        </div>}

        {view === 'activity' && <div className="page-scroll"><div className="page-heading"><div><p className="eyebrow">TU ESPACIO DE TRABAJO</p><h1>Actividad</h1><p>Un resumen de lo que tus bots han estado haciendo.</p></div><button className="subtle-button" onClick={() => setToast('Actividad actualizada')}><History size={15} /> Actualizar</button></div><div className="stats-row"><StatCard icon={<MessageSquare size={17} />} value={String(Object.values(workspace.messages).reduce((sum, rows) => sum + rows.length, 0))} label="Mensajes" color="violet" /><StatCard icon={<AlarmClock size={17} />} value={String(workspace.routines.filter((r) => r.enabled).length)} label="Rutinas activas" color="green" /><StatCard icon={<ShieldCheck size={17} />} value={String(pendingApprovals)} label="Por aprobar" color="orange" /></div><div className="panel-card activity-panel"><div className="panel-title-row"><div><h2>Reciente</h2><p>Las últimas acciones de tu espacio.</p></div><button className="text-button" onClick={() => setToast('Mostrando toda la actividad disponible')}>Ver todo <ChevronRight size={14} /></button></div><Timeline workspace={workspace} /></div></div>}

        {view === 'approvals' && <div className="page-scroll"><div className="page-heading"><div><p className="eyebrow">CONTROL Y SEGURIDAD</p><h1>Aprobaciones</h1><p>Revisa las acciones antes de que tus bots las ejecuten.</p></div><span className="pending-pill"><span />{pendingApprovals} pendientes</span></div><div className="approval-list">{workspace.approvals.map((item) => <div className={`approval-card ${item.status !== 'pending' ? 'resolved' : ''}`} key={item.id}><div className="approval-icon"><ShieldCheck size={18} /></div><div className="approval-copy"><div className="approval-title-line"><h3>{item.title}</h3><span className={`approval-status ${item.status}`}>{item.status === 'pending' ? 'Requiere aprobación' : item.status === 'approved' ? 'Aprobada' : 'Rechazada'}</span></div><p>{item.detail}</p><div className="approval-meta"><span>{item.app}</span><i />{item.time}</div></div>{item.status === 'pending' ? <div className="approval-actions"><button className="deny-button" onClick={() => updateApproval(item.id, 'denied')}>Rechazar</button><button className="approve-button" onClick={() => updateApproval(item.id, 'approved')}><Check size={14} /> Aprobar</button></div> : <button className="icon-button" title="Acción completada"><CheckCheck size={17} /></button>}</div>)}{workspace.approvals.length === 0 && <EmptyState icon={<ShieldCheck size={22} />} title="Todo al día" text="Las solicitudes nuevas de tus bots aparecerán aquí." />}</div><div className="security-note"><LockKeyhole size={16} /><span><b>Tú tienes el control.</b> Las acciones sensibles esperan tu aprobación antes de ejecutarse.</span></div></div>}

        {view === 'routines' && <div className="page-scroll"><div className="page-heading"><div><p className="eyebrow">AUTOMATIZA LO REPETITIVO</p><h1>Rutinas</h1><p>Programa tareas para que tus bots las realicen por ti.</p></div><button className="primary-button" onClick={() => { setNewRoutineName(''); setModal('routine'); }}><Plus size={16} /> Nueva rutina</button></div><div className="routines-summary"><span className="routine-summary-icon"><AlarmClock size={19} /></span><span><b>{workspace.routines.filter((r) => r.enabled).length} rutinas activas</b><small>Próxima ejecución: Briefing de la mañana · mañana, 8:30 AM</small></span><span className="summary-spark"><Sparkles size={19} /></span></div><div className="routine-list">{workspace.routines.map((routine) => <div className="routine-card" key={routine.id}><div className="routine-icon"><Clock3 size={18} /></div><div className="routine-copy"><h3>{routine.name}</h3><p>{routine.schedule}</p><small>Última ejecución: {routine.lastRun}</small></div><button className={`toggle ${routine.enabled ? 'active' : ''}`} onClick={() => setWorkspace((current) => ({ ...current, routines: current.routines.map((item) => item.id === routine.id ? { ...item, enabled: !item.enabled } : item) }))} aria-label={routine.enabled ? 'Desactivar rutina' : 'Activar rutina'}><span /></button><button className="icon-button" title="Opciones" onClick={() => setToast('Puedes editar esta rutina en la siguiente versión')}><MoreHorizontal size={17} /></button></div>)}{workspace.routines.length === 0 && <EmptyState icon={<AlarmClock size={22} />} title="Sin rutinas todavía" text="Crea una tarea programada para empezar." />}</div><div className="routine-hint"><Sparkles size={15} /><span>Las rutinas de esta versión se guardan aquí; las ejecuciones automáticas se conectarán a tu backend.</span></div></div>}

        {view === 'computer' && <div className="page-scroll computer-page"><div className="page-heading"><div><p className="eyebrow">ENTORNO DE TRABAJO</p><h1>Computer</h1><p>Observa lo que ocurre en el escritorio de tu agente.</p></div><button className="subtle-button" onClick={() => { setPreviewUpdated('justo ahora'); setToast('Vista previa actualizada'); }}><History size={15} /> Actualizar</button></div><div className="computer-grid"><div className="screen-card"><div className="screen-card-top"><div className="window-dots"><i /><i /><i /></div><span>Vista previa del escritorio</span><span className="live-pill"><i /> PREVIEW</span></div><div className="desktop-preview"><div className="desktop-menu"><span>◉</span><span>Archivo</span><span>Editar</span><span>Ver</span><span className="desktop-clock">11:42</span></div><div className="desktop-wallpaper"><div className="desktop-orb orb-a" /><div className="desktop-orb orb-b" /><div className="desktop-widget"><span className="widget-weather">24°</span><span>Buenos días</span><small>¿Qué quieres hacer hoy?</small></div><div className="desktop-folder folder-one"><Folder size={21} /><small>Projects</small></div><div className="desktop-folder folder-two"><Folder size={21} /><small>Design</small></div><div className="desktop-dock"><span>◉</span><span>▣</span><span>⌕</span><span>▤</span><span>⚙</span></div></div></div><div className="screen-card-footer"><span><i className="green-dot" /> Vista de demostración</span><span>Actualizado {previewUpdated}</span></div></div><div className="computer-side"><div className="panel-card computer-status"><div className="panel-title-row"><div><h2>Estado del agente</h2><p>Sesión local</p></div><span className="idle-badge">Inactivo</span></div><div className="agent-avatar"><Laptop2 size={24} /></div><h3>Escritorio listo</h3><p>La vista previa muestra una maqueta. La captura y el control remoto se conectarán en una versión posterior.</p><button className="outline-button full" onClick={() => setToast('No hay una sesión remota conectada')}><Square size={13} /> Iniciar sesión remota</button></div><div className="panel-card"><div className="panel-title-row"><div><h2>Actividad reciente</h2><p>En este dispositivo</p></div></div><div className="mini-event"><span className="mini-event-icon"><Image size={15} /></span><span><b>Vista previa disponible</b><small>Hace un momento</small></span></div></div></div></div></div>}
      </main>

      {modal && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setModal(null); }}><div className="modal-card"><div className="modal-header"><div><span className="modal-icon"><Settings2 size={17} /></span><h2>{modal === 'bot' ? (editingBot ? 'Configurar bot' : 'Crear un bot') : modal === 'routine' ? 'Nueva rutina' : 'Configuración'}</h2></div><button className="icon-button" onClick={() => setModal(null)}><X size={17} /></button></div>{modal === 'bot' ? <><label className="field-label">Nombre<input autoFocus value={newBotName} onChange={(event) => setNewBotName(event.target.value)} placeholder="Ej. Asistente de marketing" /></label><label className="field-label">Descripción<textarea rows={3} value={newBotDescription} onChange={(event) => setNewBotDescription(event.target.value)} placeholder="¿En qué te ayuda este bot?" /></label><div className="field-label">Modelo<div className="field-select"><span>Grok 3</span><span className="demo-tag">DEMO</span><ChevronDown size={15} /></div></div><div className="modal-note"><LockKeyhole size={13} /> La configuración se guarda en este dispositivo.</div><div className="modal-actions"><button className="subtle-button" onClick={() => setModal(null)}>Cancelar</button><button className="primary-button" onClick={saveBot} disabled={!newBotName.trim()}>{editingBot ? 'Guardar cambios' : 'Crear bot'}</button></div></> : modal === 'routine' ? <><label className="field-label">Nombre de la rutina<input autoFocus value={newRoutineName} onChange={(event) => setNewRoutineName(event.target.value)} placeholder="Ej. Resumen de noticias" /></label><label className="field-label">Frecuencia<div className="field-select"><span>Todos los días · 9:00 AM</span><ChevronDown size={15} /></div></label><div className="modal-note"><AlarmClock size={13} /> La programación se guardará localmente; la ejecución requiere conectar un agente.</div><div className="modal-actions"><button className="subtle-button" onClick={() => setModal(null)}>Cancelar</button><button className="primary-button" onClick={addRoutine} disabled={!newRoutineName.trim()}>Crear rutina</button></div></> : <><div className="settings-profile"><div className="profile-avatar large">E</div><div><b>Espacio personal</b><small>Configuración local</small></div></div><div className="settings-row"><span><span className="settings-icon"><Grid2X2 size={15} /></span>Apariencia</span><span>Oscuro <ChevronDown size={14} /></span></div><div className="settings-row"><span><span className="settings-icon"><LockKeyhole size={15} /></span>Almacenamiento</span><span>En este dispositivo</span></div><div className="settings-row"><span><span className="settings-icon"><Code2 size={15} /></span>Versión</span><span>0.1.0 · Preview</span></div><div className="modal-actions"><button className="primary-button" onClick={() => setModal(null)}>Listo</button></div></>}</div></div>}
      {toast && <div className="toast"><Check size={15} />{toast}</div>}
    </div>
  );
}

function MessageBubble({ message }: { message: Message }) {
  const time = new Date(message.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return message.role === 'user' ? <div className="user-message"><div className="user-bubble">{message.text}{message.attachment && <div className="message-attachment"><FileText size={14} />{message.attachment}</div>}</div><span className="message-time">{time}</span></div> : <div className="assistant-message"><div className="assistant-mark"><Sparkles size={14} /></div><div className="assistant-content"><div className="assistant-name">Auton <span>· {time}</span></div><p>{message.text}</p><div className="message-actions"><button title="Copiar" onClick={() => { navigator.clipboard?.writeText(message.text); }}><FileText size={14} /></button><button title="Útil"><Check size={14} /></button><button title="Más opciones"><MoreHorizontal size={15} /></button></div></div></div>;
}

function StatCard({ icon, value, label, color }: { icon: React.ReactNode; value: string; label: string; color: string }) {
  return <div className="stat-card"><span className={`stat-icon ${color}`}>{icon}</span><span className="stat-copy"><b>{value}</b><small>{label}</small></span><span className="stat-trend">↗</span></div>;
}

function Timeline({ workspace }: { workspace: Workspace }) {
  const messages = Object.entries(workspace.messages).flatMap(([botId, rows]) => rows.filter((row) => row.role === 'user').map((row) => ({ row, bot: workspace.bots.find((item) => item.id === botId)?.name ?? 'Bot' }))).sort((a, b) => b.row.time - a.row.time).slice(0, 4);
  return <div className="timeline"><div className="timeline-item"><span className="timeline-icon green"><CheckCheck size={15} /></span><div><b>Sesión local iniciada</b><p>Tu espacio de trabajo está listo.</p><small>Hoy · Ahora</small></div></div>{messages.map(({ row, bot }) => <div className="timeline-item" key={row.id}><span className="timeline-icon violet"><MessageSquare size={15} /></span><div><b>Conversación con {bot}</b><p>{row.text}</p><small>{new Date(row.time).toLocaleString()}</small></div></div>)}{workspace.routines.filter((routine) => routine.enabled).slice(0, 2).map((routine) => <div className="timeline-item" key={routine.id}><span className="timeline-icon blue"><AlarmClock size={15} /></span><div><b>Rutina activa · {routine.name}</b><p>{routine.schedule}</p><small>Programada</small></div></div>)}</div>;
}

function EmptyState({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return <div className="empty-state"><span>{icon}</span><h3>{title}</h3><p>{text}</p></div>;
}

createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>);
