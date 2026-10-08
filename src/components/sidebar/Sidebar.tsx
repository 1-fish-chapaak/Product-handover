import { useRef, useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import {
  MessageSquare, Workflow, Database, LayoutDashboard,
  FileBarChart, ChevronDown,
  AlertTriangle, Sparkles, Building2, Home, Calendar,
  Shield, Search as SearchIcon, Settings, Clock, Check,
  Wand2, LogOut, HelpCircle, ExternalLink,
  ClipboardCheck, Layers, Inbox, BarChart3,
  Brain, Table2, ListChecks,
} from 'lucide-react';
import { pendingItems, useAllBatches, useFreshWorkspace } from '../../data/auditPlan';
import PersonalMemoryDrawer from './PersonalMemoryDrawer';
import NotificationBell from '../../notifications/NotificationBell';
import type { View } from '../../hooks/useAppState';
import { useCurrentUser } from '../../context/CurrentUserContext';
import type { PermissionKey } from '../../data/rbac';
import { ENGAGEMENT_EXCEPTIONS } from '../../data/engagement-exceptions';
import { myQueueFor, personForUser } from '../../data/grc-domain';
import { WORKSPACES } from '../../data/workspaces';

/**
 * THE SIDEBAR AS A DOCK (7 Oct, user ask: "Docker style, jaise MacBook mein
 * hota hai").
 *
 * A floating strip on the left — rounded, set off the page edge — holding the
 * same items, in the same order, under the same permissions as the rail it
 * replaces. EVERY ITEM CARRIES ITS NAME (8 Oct, user ask): a column of bare
 * icons made the reader hover to find out what anything was, and a name that
 * only exists on hover is not a label, it is a quiz. The groups (Programs,
 * Global, System) are split by thin lines; the page you are on is tinted and
 * marked at the left edge; counts sit at the end of their row.
 *
 * Two things went with the icons-only rail, because both only ever answered
 * "what is this?": the pop-out name on hover, and the Mac magnification —
 * a wide labelled row cannot grow towards the pointer without its text
 * running off the end.
 * It hides itself like the Mac's dock (8 Oct): off-screen until the pointer
 * touches the left edge, sliding over the page rather than taking room from it.
 *
 * `expanded` / `toggleSidebar` are still passed by the shell (its ⌘\ shortcut);
 * the dock ignores them.
 */

interface SidebarProps {
  view: View;
  setView: (v: View) => void;
  expanded: boolean;
  toggleSidebar: () => void;
  setSidebarExpanded: (v: boolean) => void;
  unreadNotifications: number;
  notificationDrawerOpen: boolean;
  onOpenNotifications: () => void;
}

/** How far the pointer reaches, in px, and how big the icon under it gets. */

/* ── One dock row — icon, name, and whatever it is counting ── */
function DockItem({ icon: Icon, label, active, onClick, badge }: {
  icon: React.ElementType; label: string; active: boolean; onClick: () => void; badge?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={badge ? `${label}, ${badge}` : label}
      aria-current={active ? 'page' : undefined}
      className={`relative w-full h-9 shrink-0 rounded-lg flex items-center gap-3 px-2.5 text-left transition-colors duration-150 cursor-pointer
        focus:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-accent focus-visible:ring-offset-1 focus-visible:ring-offset-sidebar-bg
        ${active ? 'bg-brand-500/25 text-sidebar-accent' : 'text-sidebar-text hover:bg-sidebar-surface-hover hover:text-sidebar-accent'}`}
    >
      {/* The page you are on, marked at the edge the rail runs along. A dot
          beside the icon worked when the row was the icon; on a full-width row
          it would float in the middle of nothing. */}
      {active && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 rounded-r-full bg-sidebar-accent" aria-hidden />}
      <Icon size={18} className="shrink-0" />
      <span className="min-w-0 flex-1 truncate text-[0.8125rem] font-medium">{label}</span>
      {/* At the end of the row, not pinned to the icon's corner — there is a
          row to put it on now, and a number reads better beside its name. */}
      {badge && (
        <span className="shrink-0 min-w-[18px] h-[18px] px-1 rounded-full bg-sidebar-accent text-brand-600 text-[0.625rem] font-bold leading-none flex items-center justify-center tabular-nums" aria-hidden>
          {badge}
        </span>
      )}
    </button>
  );
}

/* ── Group divider ── */
const DockDivider = () => <div className="w-full h-px my-1 bg-sidebar-border shrink-0" aria-hidden />;

// Workspace switcher options — shared with the login chooser.
const TEAMS = WORKSPACES.map(w => ({ id: w.id, name: w.name }));

export default function Sidebar({ view, setView, unreadNotifications, notificationDrawerOpen, onOpenNotifications }: SidebarProps) {
  const prefersReducedMotion = useReducedMotion() ?? false;
  const [teamOpen, setTeamOpen] = useState(false);
  const [teamSearch, setTeamSearch] = useState('');
  const teamRef = useRef<HTMLDivElement>(null);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [signOutConfirm, setSignOutConfirm] = useState(false);
  // "What IRA knows about me" — the personal-memory home (scope follows
  // surface: personal memory governance hangs off the identity menu).
  const [memoryDrawerOpen, setMemoryDrawerOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // ── Auto-hide, as on the Mac (8 Oct, user ask) ──
  // The dock lives off-screen and takes no room from the page. Touching the
  // left edge slides it in; leaving it slides it out after a beat. It stays
  // out while a menu, the bell's panel or the memory drawer is open, and
  // while keyboard focus is inside it — tabbing in reveals it too.
  const [shown, setShown] = useState(false);
  const [hovering, setHovering] = useState(false);
  const [focusInside, setFocusInside] = useState(false);
  const dockRef = useRef<HTMLDivElement>(null);

  const { currentUser, activeRole, can, canAny, signOut,
    activeWorkspaceId: activeTeam, setActiveWorkspace: setActiveTeam } = useCurrentUser();

  useEffect(() => {
    if (!teamOpen) return;
    const close = (e: MouseEvent) => {
      if (teamRef.current && !teamRef.current.contains(e.target as Node)) setTeamOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [teamOpen]);

  useEffect(() => {
    if (!userMenuOpen) return;
    const close = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) setUserMenuOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [userMenuOpen]);

  const held = hovering || focusInside || teamOpen || userMenuOpen || notificationDrawerOpen || memoryDrawerOpen;
  useEffect(() => {
    if (held) { setShown(true); return; }
    const t = window.setTimeout(() => setShown(false), 350);
    return () => window.clearTimeout(t);
  }, [held]);

  const filteredTeams = TEAMS.filter(t => t.name.toLowerCase().includes(teamSearch.toLowerCase()));
  const teamName = TEAMS.find(t => t.id === activeTeam)?.name ?? 'Workspace';

  // ── Permission-driven section visibility ──
  const programsVisible = canAny(['plan_view', 'eng_view', 'bp_view']);
  const globalVisible = canAny(['db_view', 'rp_view', 'risk_view', 'ctrl_view', 'wf_view', 'concierge_use']);
  const adminTabPerms: { view: View; perm: PermissionKey }[] = [
    { view: 'admin-users', perm: 'ad_users_manage' },
    { view: 'admin-roles', perm: 'ad_roles_manage' },
    { view: 'admin-logs', perm: 'ad_logs' },
  ];
  const adminVisible = adminTabPerms.some(t => can(t.perm));
  const firstAdminView: View = (adminTabPerms.find(t => can(t.perm))?.view) ?? 'admin-users';

  // Open items waiting on the signed-in user across every engagement — uses
  // the same derivation as MyQueueView so the badge always matches the list.
  // Builds & reviews appears once there's something in it to answer or review.
  const allBatches = useAllBatches();
  const buildsPending = pendingItems(allBatches, currentUser?.name);
  const buildsCount = buildsPending.needsInput.length + buildsPending.toReview.length;
  // A new client has no engagement exceptions yet — the queue starts empty.
  const freshWs = useFreshWorkspace();
  const myQueueCount = useMemo(
    () => (freshWs ? 0 : myQueueFor(ENGAGEMENT_EXCEPTIONS, personForUser(currentUser?.name)).length),
    [currentUser?.name, freshWs],
  );

  /* View group helpers for active detection */
  const workflowViews: View[] = ['workflow-templates', 'workflow-detail', 'workflow-library', 'workflow-executor'];
  const aiConciergeViews: View[] = ['ai-concierge', 'ai-concierge-forensics', 'ai-concierge-table-extractor'];
  const adminViews: View[] = ['admin-users', 'admin-roles', 'admin-logs'];

  const item = (icon: React.ElementType, label: string, active: boolean, go: () => void, badge?: string) => (
    <DockItem key={label} icon={icon} label={label} active={active} onClick={go} badge={badge} />
  );

  // Popovers open to the RIGHT of the dock, beside what opened them.
  const popover = 'absolute left-full ml-3 w-64 rounded-xl z-50 overflow-hidden border border-white/[0.12] bg-sidebar-bg shadow-2xl';

  return (
    <>
    {/* The edge that calls the dock — a thin strip along the left of the screen. */}
    <div aria-hidden className="fixed left-0 top-0 h-full w-1.5 z-[60]" onMouseEnter={() => setHovering(true)} onMouseLeave={() => setHovering(false)} />

    <motion.div
      ref={dockRef}
      className="fixed left-0 top-0 h-full py-2 pl-2 pr-4 z-[70]"
      initial={false}
      animate={{ x: shown ? 0 : '-100%' }}
      transition={prefersReducedMotion ? { duration: 0 } : { type: 'spring', stiffness: 420, damping: 38 }}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      // Keyboard focus only — a clicked icon keeps focus, and that must not
      // pin the dock open.
      onFocus={e => { if ((e.target as HTMLElement).matches(':focus-visible')) setFocusInside(true); }}
      onMouseDown={() => setFocusInside(false)}
      onBlur={e => { if (!dockRef.current?.contains(e.relatedTarget as Node)) setFocusInside(false); }}
    >
      {/* The rail's own contrast (8 Oct, user ask): solid sidebar purple and
          white icons, as the expanded sidebar had — with a faint mirror sheen
          on top (rim, head shine, diagonal glint). */}
      <div className="relative h-full w-[228px] rounded-[18px] bg-sidebar-bg noise-texture border border-white/10 shadow-[inset_0_1px_0_rgb(255_255_255_/_0.30),inset_0_-1px_0_rgb(255_255_255_/_0.08),0_10px_30px_-8px_rgb(38_6_74_/_0.45)] flex flex-col items-stretch px-2">
        <div aria-hidden className="pointer-events-none absolute inset-0 rounded-[18px] overflow-hidden"
          style={{ backgroundImage: [
            'linear-gradient(115deg, rgb(255 255 255 / 0) 28%, rgb(255 255 255 / 0.07) 40%, rgb(255 255 255 / 0.02) 47%, rgb(255 255 255 / 0) 52%, rgb(255 255 255 / 0.03) 60%, rgb(255 255 255 / 0) 66%)',
            'linear-gradient(90deg, rgb(255 255 255 / 0.05) 0%, rgb(255 255 255 / 0) 22%, rgb(255 255 255 / 0) 80%, rgb(255 255 255 / 0.05) 100%)',
            'linear-gradient(180deg, rgb(255 255 255 / 0.10) 0%, rgb(255 255 255 / 0.03) 14%, rgb(255 255 255 / 0) 35%, rgb(255 255 255 / 0) 85%, rgb(255 255 255 / 0.08) 100%)',
          ].join(', ') }} />

        {/* ── Top: workspace + bell ── */}
        <div className="shrink-0 pt-2.5 pb-1.5 flex items-center gap-2 relative" ref={teamRef}>
          <button
            type="button"
            onClick={() => { setTeamOpen(p => !p); setTeamSearch(''); }}
            aria-label={`IRAME.AI — workspace: ${teamName}`}
            aria-expanded={teamOpen}
            className="min-w-0 flex-1 flex items-center gap-2 px-1 py-1 rounded-lg hover:bg-sidebar-surface-hover transition-colors cursor-pointer"
          >
            <span className="w-8 h-8 shrink-0 rounded-lg bg-gradient-to-br from-brand-500 to-brand-400 flex items-center justify-center"
              style={{ boxShadow: '0 2px 8px rgb(106 18 205 / 0.30)' }}>
              <Sparkles size={15} className="text-white" />
            </span>
            {/* The workspace is the thing that changes; the product name above it
                is the thing that does not, so it sits smaller and quieter. */}
            <span className="min-w-0 flex-1 text-left">
              <span className="block text-[0.625rem] font-semibold uppercase tracking-wider text-sidebar-text/60">IRAME.AI</span>
              <span className="block truncate text-[0.8125rem] font-semibold text-white">{teamName}</span>
            </span>
          </button>

          <NotificationBell
            unreadCount={unreadNotifications}
            open={notificationDrawerOpen}
            onMouseDown={(e) => { e.stopPropagation(); }}
            onClick={() => { onOpenNotifications(); }}
            className={notificationDrawerOpen
              ? 'bg-sidebar-surface-active text-sidebar-accent'
              : 'text-white hover:bg-sidebar-surface-hover hover:text-sidebar-accent'}
            badgeClassName="bg-sidebar-accent text-brand-600"
          />

          {/* Workspace switcher */}
          <AnimatePresence>
            {teamOpen && (
              <motion.div
                initial={{ opacity: 0, x: -6, scale: 0.97 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: -4, scale: 0.98 }}
                transition={{ duration: 0.15, ease: [0.22, 0.68, 0, 1] }}
                className={`${popover} top-2`}
              >
                <div className="px-4 pt-3 pb-1">
                  <div className="text-[0.875rem] font-bold text-sidebar-accent leading-tight">IRAME.AI</div>
                  <div className="text-[0.75rem] text-white/70">Switch workspace</div>
                </div>
                <div className="p-3">
                  <div
                    className="flex items-center gap-2.5 px-3.5 h-10 rounded-lg text-[0.8125rem]"
                    style={{ border: '1px solid rgba(163, 102, 240, 0.35)', background: 'rgba(163, 102, 240, 0.08)' }}
                  >
                    <SearchIcon size={14} className="text-white shrink-0" />
                    <input
                      type="text"
                      placeholder="Search workspace"
                      value={teamSearch}
                      onChange={e => setTeamSearch(e.target.value)}
                      className="flex-1 bg-transparent outline-none text-white placeholder:text-white/60 text-[0.8125rem]"
                      style={{ boxShadow: 'none' }}
                      autoFocus
                    />
                  </div>
                </div>
                <div className="h-px bg-white/[0.08]" />
                <div className="py-1.5 max-h-[220px] overflow-y-auto">
                  {filteredTeams.map(team => {
                    const isActive = activeTeam === team.id;
                    return (
                      <button
                        key={team.id}
                        onClick={() => { setActiveTeam(team.id); setTeamOpen(false); }}
                        className={`w-full flex items-center justify-between px-4 py-3 text-[0.875rem] transition-colors duration-100 cursor-pointer ${isActive ? 'text-white' : 'text-white hover:bg-white/[0.05]'}`}
                      >
                        <span style={{ fontWeight: isActive ? 600 : 400 }}>{team.name}</span>
                        {isActive ? (
                          <div className="w-[22px] h-[22px] rounded-full bg-brand-400 flex items-center justify-center">
                            <Check size={12} className="text-white" strokeWidth={2.5} />
                          </div>
                        ) : (
                          <div className="w-[22px] h-[22px] rounded-full border-[1.5px] border-white/20" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <DockDivider />

        {/* ── The icons ── */}
        <nav
          aria-label="Main"
          className="flex-1 min-h-0 w-full overflow-y-auto overflow-x-hidden flex flex-col items-stretch gap-0.5 py-1.5 [scrollbar-width:none]"
        >
          {/* Top action — Ask IRA is free for everyone (no permission gate) */}
          {item(MessageSquare, 'Ask IRA', view === 'chat' || view === 'chat-trash', () => setView('chat'))}
          {/* Workflow Builder — agent chooser (General / GRC) + Audit with AI. */}
          {item(Workflow, 'Workflow Builder', view === 'workflow-builder' || view === 'audit-with-ai', () => setView('workflow-builder'))}
          {(allBatches.length > 0 || view === 'builds')
            && item(ListChecks, 'Builds & reviews', view === 'builds', () => setView('builds'), buildsCount > 0 ? String(buildsCount) : undefined)}

          {/* Primary — always available */}
          {item(Home, 'Home', view === 'home', () => setView('home'))}
          {item(Clock, 'Recents', view === 'recents', () => setView('recents'))}

          {/* ── PROGRAMS ── */}
          {programsVisible && <DockDivider />}
          {can('plan_view') && item(Calendar, 'Audit Planning', view === 'audit-planning', () => setView('audit-planning'))}
          {can('eng_view') && item(ClipboardCheck, 'Engagements', view === 'engagements' || view === 'engagement-overview' || view === 'engagement-case-management' || view === 'sox-icfr', () => setView('engagements'))}
          {/* SOX Testing — PARKED from the sidebar (user ask); the route and its
              page stay wired, so restoring it is one line here. */}
          {/* Personal cross-engagement queue — same eng_view gate as the routed
              'my-queue' view, so risk owners' home screen is always reachable. */}
          {can('eng_view') && item(Inbox, 'My Queue', view === 'my-queue', () => setView('my-queue'), myQueueCount > 0 ? String(myQueueCount) : undefined)}
          {can('bp_view') && item(Layers, 'Process Hub', view === 'programs' || view === 'business-processes' || view === 'bp-detail', () => setView('programs'))}

          {/* ── GLOBAL ── */}
          {globalVisible && <DockDivider />}
          {can('db_view') && item(LayoutDashboard, 'Dashboard', view === 'dashboards', () => setView('dashboards'))}
          {can('rp_view') && item(FileBarChart, 'Report', view === 'reports' || view === 'report-history' || view === 'report-builder', () => setView('reports'))}
          {/* RACM sits above the register and the library because it is where
              the other two come from. */}
          {can('racm_view') && item(Table2, 'RACM Library', view === 'racm-library', () => setView('racm-library'))}
          {can('risk_view') && item(AlertTriangle, 'Risk Register', view === 'audit-risk-register', () => setView('audit-risk-register'))}
          {can('ctrl_view') && item(Shield, 'Control Library', view === 'governance-controls' || view === 'governance-control-detail' || view === 'adapt-standard', () => setView('governance-controls'))}
          {can('wf_view') && item(Workflow, 'Workflow Library', workflowViews.includes(view), () => setView('workflow-library'))}
          {can('concierge_use') && item(Wand2, 'AI Concierge', aiConciergeViews.includes(view), () => setView('ai-concierge'))}

          {/* ── SYSTEM ── */}
          <DockDivider />
          {can('ds_live') && item(Database, 'Knowledge Hub', view === 'knowledge-hub' || view === 'data-sources' || view === 'configuration', () => setView('knowledge-hub'))}
          {/* One entry, four tabs — ungated, because two of the four tabs are
              open to everybody; the page drops the ones a role does not carry. */}
          {item(BarChart3, 'Platform Usage', view === 'platform-usage' || view === 'connectors', () => setView('platform-usage'))}
          {adminVisible && item(Settings, 'Admin', adminViews.includes(view), () => setView(firstAdminView))}
        </nav>

        <DockDivider />

        {/* ── Bottom: you ── */}
        <div className="shrink-0 pt-1 pb-2.5 relative" ref={userMenuRef}>
          <button
            type="button"
            onClick={() => { setUserMenuOpen(p => !p); setSignOutConfirm(false); setHelpOpen(false); }}
            aria-label={`Your account — ${currentUser?.name ?? 'signed out'}`}
            aria-expanded={userMenuOpen}
            className="w-full flex items-center gap-2.5 px-1 py-1 rounded-lg hover:bg-sidebar-surface-hover transition-colors cursor-pointer"
          >
            <span className="w-9 h-9 shrink-0 rounded-full bg-sidebar-accent flex items-center justify-center text-[0.75rem] font-bold text-brand-600">
              {currentUser?.initials ?? '—'}
            </span>
            <span className="min-w-0 flex-1 text-left">
              <span className="block truncate text-[0.8125rem] font-semibold text-white">{currentUser?.name ?? 'Signed out'}</span>
              {activeRole?.name && <span className="block truncate text-[0.6875rem] text-sidebar-text/70">{activeRole.name}</span>}
            </span>
          </button>

          {/* User menu */}
          <AnimatePresence>
            {userMenuOpen && (
              <motion.div
                initial={{ opacity: 0, x: -6, scale: 0.98 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: -4, scale: 0.98 }}
                transition={{ duration: 0.12 }}
                className={`${popover} bottom-2`}
              >
                {signOutConfirm ? (
                  <div className="p-4">
                    <div className="text-[0.8125rem] font-semibold text-white mb-1">Sign out?</div>
                    <div className="text-[0.75rem] text-white/50 mb-4">You'll need to sign in again to access your workspace.</div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setSignOutConfirm(false)}
                        className="flex-1 px-3 py-2 rounded-lg text-[0.8125rem] font-medium text-white/80 border border-white/[0.12] hover:bg-white/[0.06] transition-colors cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => { setSignOutConfirm(false); setUserMenuOpen(false); signOut(); }}
                        className="flex-1 px-3 py-2 rounded-lg text-[0.8125rem] font-medium text-white bg-risk hover:bg-risk-700 transition-colors cursor-pointer"
                      >
                        Sign Out
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    {/* Who you are — the expanded rail used to say this; the dock
                        has no room, so the menu does. */}
                    <div className="px-4 pt-3 pb-2.5 border-b border-white/[0.08]">
                      <div className="text-[0.8125rem] font-semibold text-sidebar-accent truncate">{currentUser?.name ?? 'Signed out'}</div>
                      <div className="text-[0.75rem] text-white truncate">{activeRole?.name ?? currentUser?.title ?? ''}</div>
                    </div>
                    <div className="py-1.5">
                      <div className="flex items-center gap-2.5 px-4 py-2.5 text-[0.8125rem] text-white cursor-not-allowed">
                        <Building2 size={14} className="text-white" />
                        Irame Labs Pvt Ltd
                      </div>
                      <button
                        onClick={() => { setUserMenuOpen(false); setHelpOpen(false); setMemoryDrawerOpen(true); }}
                        className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[0.8125rem] text-white hover:bg-white/[0.06] transition-colors cursor-pointer"
                      >
                        <Brain size={14} className="text-white" />
                        What IRA knows about me
                      </button>
                      <button
                        onClick={() => setHelpOpen(p => !p)}
                        className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[0.8125rem] text-white hover:bg-white/[0.06] transition-colors cursor-pointer"
                      >
                        <HelpCircle size={14} className="text-white" />
                        <span className="flex-1 text-left">Help & Support</span>
                        <ChevronDown size={12} className={`text-white transition-transform duration-150 ${helpOpen ? 'rotate-180' : ''}`} />
                      </button>
                      {helpOpen && (
                        <>
                          <div className="h-px mx-3 bg-white/[0.08]" />
                          <div className="py-1">
                            {[
                              { label: 'Get Started', url: 'https://irame.ai/get-started' },
                              { label: 'Term of Use', url: 'https://irame.ai/terms' },
                              { label: 'Privacy Policy', url: 'https://irame.ai/privacy' },
                            ].map(link => (
                              <button
                                key={link.label}
                                onClick={() => { setUserMenuOpen(false); setHelpOpen(false); window.open(link.url, '_blank'); }}
                                className="w-full flex items-center justify-between px-4 py-2.5 text-[0.8125rem] text-white hover:bg-white/[0.06] transition-colors cursor-pointer"
                              >
                                {link.label}
                                <ExternalLink size={12} className="text-white" />
                              </button>
                            ))}
                          </div>
                        </>
                      )}
                      <div className="h-px mx-3 my-1 bg-white/[0.08]" />
                      <button
                        onClick={() => setSignOutConfirm(true)}
                        className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[0.8125rem] text-red-400 hover:bg-white/[0.06] hover:text-red-300 transition-colors cursor-pointer"
                      >
                        <LogOut size={14} />
                        Sign Out
                      </button>
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>

      {/* Personal memory home — rendered at the shell level so the drawer
          overlays the app, not the dock. */}
      <AnimatePresence>
        {memoryDrawerOpen && <PersonalMemoryDrawer onClose={() => setMemoryDrawerOpen(false)} />}
      </AnimatePresence>
    </>
  );
}
