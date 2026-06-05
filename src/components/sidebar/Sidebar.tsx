import { useRef, useState, useEffect } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import {
  MessageSquare, Workflow, Database, LayoutDashboard,
  FileBarChart, ChevronDown, PanelLeft, PanelLeftClose,
  AlertTriangle, Sparkles, Building2, Home, Calendar,
  Shield, Search as SearchIcon, Settings, Clock, Check,
  Wand2, MoreHorizontal, LogOut, HelpCircle, ExternalLink,
  ClipboardCheck, FileText, Target, Layers, Bell,
  Inbox, FlaskConical, Share2,
} from 'lucide-react';
import type { View } from '../../hooks/useAppState';
import { useCurrentUser } from '../../context/CurrentUserContext';
import type { PermissionKey } from '../../data/rbac';
import { WORKSPACES } from '../../data/workspaces';

interface SidebarProps {
  view: View;
  setView: (v: View) => void;
  expanded: boolean;
  toggleSidebar: () => void;
  setSidebarExpanded: (v: boolean) => void;
  unreadNotifications: number;
  notificationDrawerOpen: boolean;
  onOpenNotifications: () => void;
  onOpenShare: () => void;
}

/* ── Flat nav item ── */
function NavItem({ icon: Icon, label, active, expanded, onClick, badge, dot }: {
  icon: React.ElementType; label: string; active: boolean; expanded: boolean; onClick: () => void; badge?: string; dot?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={!expanded ? label : undefined}
      className={`
        flex items-center gap-2.5 rounded-lg transition-colors duration-150 relative cursor-pointer
        ${expanded ? 'w-full h-8 px-3.5' : 'w-8 h-8 mx-auto px-0 justify-center'}
        ${active
          ? 'bg-sidebar-surface-active text-sidebar-accent font-semibold'
          : 'text-sidebar-text hover:bg-sidebar-surface-hover hover:text-sidebar-accent'
        }
      `}
    >
      {active && (
        <span className="absolute left-0 top-0 bottom-0 w-[3px] bg-sidebar-accent rounded-r-lg" />
      )}
      <span className="relative shrink-0 flex items-center justify-center">
        <Icon size={18} />
        {dot && !expanded && (
          <span
            className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-brand-400 ring-2 ring-sidebar-bg"
            aria-hidden="true"
          />
        )}
      </span>
      <AnimatePresence>
        {expanded && (
          <motion.span
            initial={{ opacity: 0, width: 0 }}
            animate={{ opacity: 1, width: 'auto' }}
            exit={{ opacity: 0, width: 0 }}
            transition={{ duration: 0.15 }}
            className="text-[14px] leading-[20px] truncate overflow-hidden whitespace-nowrap"
            style={{ fontWeight: active ? 600 : 520 }}
          >
            {label}
          </motion.span>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {expanded && badge && (
          <motion.span
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.12 }}
            className="ml-auto text-[12px] font-semibold bg-sidebar-accent text-brand-600 px-[7px] py-[2px] rounded-full tabular-nums"
          >
            {badge}
          </motion.span>
        )}
      </AnimatePresence>
    </button>
  );
}

/* ── Section divider with optional label ── */
function Divider({ label, expanded }: { label?: string; expanded: boolean }) {
  if (!expanded || !label) {
    return (
      <div className="mx-0 py-[13.5px]">
        <div className="h-px bg-sidebar-border" />
      </div>
    );
  }
  return (
    <div className="px-3.5 py-2">
      <span className="text-[12px] leading-[16px] font-medium uppercase text-white/60">{label}</span>
    </div>
  );
}

// Workspace switcher options — shared with the login chooser.
const TEAMS = WORKSPACES.map(w => ({ id: w.id, name: w.name }));

export default function Sidebar({ view, setView, expanded, toggleSidebar, unreadNotifications, notificationDrawerOpen, onOpenNotifications, onOpenShare }: SidebarProps) {
  const prefersReducedMotion = useReducedMotion();
  const [hoverExpanded, setHoverExpanded] = useState(false);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [teamOpen, setTeamOpen] = useState(false);
  const [teamSearch, setTeamSearch] = useState('');
  const teamRef = useRef<HTMLDivElement>(null);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [signOutConfirm, setSignOutConfirm] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [rolesOpen, setRolesOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const { currentUser, activeRole, roles, can, canAny, setActiveRole, signOut,
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

  const filteredTeams = TEAMS.filter(t => t.name.toLowerCase().includes(teamSearch.toLowerCase()));

  const isExpanded = expanded || hoverExpanded;

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

  const handleMouseEnter = () => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    if (!expanded) {
      hoverTimerRef.current = setTimeout(() => setHoverExpanded(true), 200);
    }
  };

  const handleMouseLeave = () => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    if (!expanded) {
      hoverTimerRef.current = setTimeout(() => setHoverExpanded(false), 250);
    }
  };

  /* View group helpers for active detection */
  const workflowViews: View[] = ['workflow-templates', 'workflow-detail', 'workflow-library', 'workflow-executor'];
  const aiConciergeViews: View[] = ['ai-concierge', 'ai-concierge-forensics', 'ai-concierge-table-extractor'];
  const adminViews: View[] = ['admin-users', 'admin-roles', 'admin-logs'];

  return (
    // Outer layout slot — ALWAYS the collapsed 64px width. Neither hovering nor
    // pinning the rail open reflows the page; the visual rail overlays instead,
    // so the content never moves/resizes.
    <div
      className="relative h-full shrink-0 z-50 w-16"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
    {/* Visual rail — absolutely positioned so any expanded state (hover OR
        pinned) floats OVER the content with a drop shadow, instead of pushing it. */}
    <motion.div
      animate={{ width: isExpanded ? 256 : 64 }}
      transition={{
        duration: prefersReducedMotion ? 0 : 0.28,
      }}
      className={`absolute inset-y-0 left-0 h-full bg-sidebar-bg noise-texture flex flex-col overflow-hidden z-50 ${isExpanded ? 'shadow-[8px_0_32px_-10px_rgba(15,8,30,0.55)]' : ''}`}
    >
      {/* ── Sidebar header: collapsed shows ONLY the bell (centered in 64px);
          expanded shows logo + IRAME.AI + Audit Intelligence on the left,
          bell on the right. The bell uses Framer Motion's `layout` prop so
          it slides smoothly between the two positions in lockstep with the
          sidebar's width animation — no manual position calculations. ── */}
      <div className={`border-b border-sidebar-border shrink-0 relative h-[59px] flex items-center ${isExpanded ? 'px-4 justify-between gap-3' : 'px-0 justify-center'}`} ref={teamRef}>
        {/* Logo + IRAME.AI label + team switcher — expanded only */}
        <AnimatePresence initial={false}>
          {isExpanded && (
            <motion.div
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: 'auto' }}
              exit={{ opacity: 0, width: 0 }}
              transition={{ duration: 0.22, ease: [0.22, 0.68, 0, 1] }}
              className="flex items-center gap-3 overflow-hidden"
            >
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-brand-400 flex items-center justify-center shrink-0" style={{ boxShadow: '0 2px 8px rgb(106 18 205 / 0.30)' }}>
                <Sparkles size={14} className="text-white" />
              </div>
              <div>
                <div className="text-[14px] font-bold text-sidebar-accent leading-tight whitespace-nowrap">IRAME.AI</div>
                <button
                  onClick={() => { setTeamOpen(p => !p); setTeamSearch(''); }}
                  className="text-[12px] text-white font-medium whitespace-nowrap flex items-center gap-1 hover:text-sidebar-text transition-colors cursor-pointer"
                >
                  {TEAMS.find(t => t.id === activeTeam)?.name ?? 'Workspace'}
                  <ChevronDown size={8} className={`text-white transition-transform duration-150 ${teamOpen ? 'rotate-180' : ''}`} />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Notification bell — uses motion `layout` to smoothly transition
            position between collapsed (centered, 64px) and expanded (right
            edge, 256px). The `layout` system measures the DOM before/after
            and animates the transform — no slide-in-from-the-right glitch. */}
        <motion.button
          layout
          transition={{ duration: 0.28, ease: [0.22, 0.68, 0, 1] }}
          onMouseEnter={() => {
            // Hovering the bell should not auto-expand the sidebar.
            // Cancelling the pending expand timer keeps the bell stationary
            // under the user's cursor so the click target doesn't slide away.
            if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
          }}
          onMouseDown={(e) => { e.stopPropagation(); }}
          onClick={(e) => {
            e.stopPropagation();
            // Cancel any pending hover-expand and clear the hover state so
            // clicking the bell doesn't drag the sidebar open under the user.
            if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
            setHoverExpanded(false);
            onOpenNotifications();
          }}
          title="Notifications"
          aria-label="Notifications"
          className={`relative shrink-0 w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer transition-colors
            ${notificationDrawerOpen
              ? 'bg-sidebar-surface-active text-sidebar-accent'
              : 'text-white hover:bg-sidebar-surface-hover hover:text-sidebar-accent'}
          `}
        >
          <Bell size={17} />
          <AnimatePresence>
            {unreadNotifications > 0 && (
              <motion.span
                key={unreadNotifications}
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.6, opacity: 0 }}
                transition={{ duration: 0.2, ease: [0.34, 1.56, 0.64, 1] }}
                className="absolute -top-1 -right-1 min-w-[16px] h-[16px] px-[4px] rounded-full bg-sidebar-accent text-brand-600 text-[10px] font-semibold leading-none flex items-center justify-center tabular-nums"
                aria-hidden="true"
              >
                {unreadNotifications > 99 ? '99+' : unreadNotifications}
              </motion.span>
            )}
          </AnimatePresence>
        </motion.button>

        {/* Team switcher dropdown */}
        <AnimatePresence>
          {teamOpen && isExpanded && (
            <motion.div
              initial={{ opacity: 0, y: -6, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.98 }}
              transition={{ duration: 0.15, ease: [0.22, 0.68, 0, 1] }}
              className="absolute left-3 right-3 top-full mt-0 rounded-xl z-50 overflow-hidden border border-white/[0.12] bg-sidebar-bg shadow-2xl"
            >
              {/* Search */}
              <div className="p-3">
                <div
                  className="flex items-center gap-2.5 px-3.5 h-10 rounded-lg text-[13px]"
                  style={{
                    border: '1px solid rgba(163, 102, 240, 0.35)',
                    background: 'rgba(163, 102, 240, 0.08)',
                  }}
                >
                  <SearchIcon size={14} className="text-white shrink-0" />
                  <input
                    type="text"
                    placeholder="Search workspace"
                    value={teamSearch}
                    onChange={e => setTeamSearch(e.target.value)}
                    className="flex-1 bg-transparent outline-none text-white placeholder:text-white/60 text-[13px]"
                    style={{ boxShadow: 'none' }}
                    autoFocus
                  />
                </div>
              </div>

              <div className="h-px bg-white/[0.08]" />

              {/* Team list */}
              <div className="py-1.5 max-h-[220px] overflow-y-auto">
                {filteredTeams.map(team => {
                  const isActive = activeTeam === team.id;
                  return (
                    <button
                      key={team.id}
                      onClick={() => { setActiveTeam(team.id); setTeamOpen(false); }}
                      className={`w-full flex items-center justify-between px-4 py-3 text-[14px] transition-colors duration-100 cursor-pointer ${isActive ? 'text-white' : 'text-white hover:bg-white/[0.05]'}`}
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

      {/* ── Navigation ── */}
      <nav className={`flex-1 overflow-y-auto overflow-x-hidden py-2 ${isExpanded ? 'px-2' : 'px-0'}`}>
        <div className="space-y-0.5">

          {/* Top action — Ask IRA is free for everyone (no permission gate) */}
          <NavItem icon={MessageSquare} label="Ask IRA" active={view === 'chat' || view === 'chat-trash'} expanded={isExpanded} onClick={() => setView('chat')} />

          {/* Primary — always available */}
          <NavItem icon={Home} label="Home" active={view === 'home'} expanded={isExpanded} onClick={() => setView('home')} />
          <NavItem icon={Clock} label="Recents" active={view === 'recents'} expanded={isExpanded} onClick={() => setView('recents')} />

          {/* ── PROGRAMS ── */}
          {programsVisible && <Divider label="Programs" expanded={isExpanded} />}

          {can('plan_view') && <NavItem icon={Calendar} label="Audit Planning" active={view === 'audit-planning'} expanded={isExpanded} onClick={() => setView('audit-planning')} />}
          {can('eng_view') && <NavItem icon={ClipboardCheck} label="Engagements" active={view === 'engagements' || view === 'engagement-overview' || view === 'engagement-case-management'} expanded={isExpanded} onClick={() => setView('engagements')} />}
          {can('bp_view') && <NavItem icon={Layers} label="Process Hub" active={view === 'programs' || view === 'business-processes' || view === 'bp-detail'} expanded={isExpanded} onClick={() => setView('programs')} />}

          {/* ── GLOBAL ── */}
          {globalVisible && <Divider label="Global" expanded={isExpanded} />}

          {can('db_view') && <NavItem icon={LayoutDashboard} label="Dashboard" active={view === 'dashboards'} expanded={isExpanded} onClick={() => setView('dashboards')} />}
          {can('rp_view') && <NavItem icon={FileBarChart} label="Report" active={view === 'reports' || view === 'report-history' || view === 'report-builder'} expanded={isExpanded} onClick={() => setView('reports')} />}
          {can('risk_view') && <NavItem icon={AlertTriangle} label="Risk Register" active={view === 'audit-risk-register'} expanded={isExpanded} onClick={() => setView('audit-risk-register')} />}
          {can('ctrl_view') && <NavItem icon={Shield} label="Control Library" active={view === 'governance-controls' || view === 'governance-control-detail'} expanded={isExpanded} onClick={() => setView('governance-controls')} />}
          {can('wf_view') && <NavItem icon={Workflow} label="Workflow Library" active={workflowViews.includes(view)} expanded={isExpanded} onClick={() => setView('workflow-library')} />}
          {can('concierge_use') && <NavItem icon={Wand2} label="AI Concierge" active={aiConciergeViews.includes(view)} expanded={isExpanded} onClick={() => setView('ai-concierge')} />}

          {/* ── SYSTEM ── */}
          <Divider label="System" expanded={isExpanded} />

          {can('ds_live') && <NavItem icon={Database} label="Knowledge Hub" active={view === 'knowledge-hub' || view === 'data-sources' || view === 'configuration'} expanded={isExpanded} onClick={() => setView('knowledge-hub')} />}
          {adminVisible && <NavItem icon={Settings} label="Admin" active={adminViews.includes(view)} expanded={isExpanded} onClick={() => setView(firstAdminView)} />}

          {/* Global workspace share — opens the Share modal from anywhere. */}
          <NavItem icon={Share2} label="Share" active={false} expanded={isExpanded} onClick={onOpenShare} />

        </div>
      </nav>

      {/* ── User profile ── */}
      <div className={`border-t border-sidebar-border shrink-0 relative py-3 ${isExpanded ? 'px-3' : 'px-0'}`} ref={userMenuRef}>
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="flex items-center gap-2.5 px-2.5 py-2.5 rounded-lg bg-sidebar-surface border border-sidebar-border cursor-pointer hover:bg-sidebar-surface-hover transition-colors"
            >
              <div className="w-8 h-8 rounded-full bg-sidebar-accent flex items-center justify-center text-[12px] font-bold text-brand-600 shrink-0">
                {currentUser?.initials ?? '—'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-semibold text-sidebar-accent truncate">{currentUser?.name ?? 'Signed out'}</div>
                <div className="text-[12px] text-white truncate">{activeRole?.name ?? currentUser?.title ?? ''}</div>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); toggleSidebar(); }}
                title="Collapse sidebar (⌘\)"
                aria-label="Collapse sidebar"
                aria-pressed={true}
                className="p-1 rounded-md hover:bg-white/[0.08] transition-colors text-white hover:text-sidebar-text cursor-pointer"
              >
                <PanelLeftClose size={16} />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setUserMenuOpen(p => !p); setSignOutConfirm(false); setHelpOpen(false); }}
                className="p-1 rounded-md hover:bg-white/[0.08] transition-colors text-white hover:text-sidebar-text cursor-pointer"
              >
                <MoreHorizontal size={16} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* User menu dropdown */}
        <AnimatePresence>
          {userMenuOpen && isExpanded && (
            <motion.div
              initial={{ opacity: 0, y: 4, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 4, scale: 0.98 }}
              transition={{ duration: 0.12 }}
              className="absolute left-3 right-3 bottom-full mb-0 rounded-xl z-50 overflow-hidden border border-white/[0.12] bg-sidebar-bg shadow-2xl"
            >
              {signOutConfirm ? (
                <div className="p-4">
                  <div className="text-[13px] font-semibold text-white mb-1">Sign out?</div>
                  <div className="text-[12px] text-white/50 mb-4">You'll need to sign in again to access your workspace.</div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setSignOutConfirm(false)}
                      className="flex-1 px-3 py-2 rounded-lg text-[13px] font-medium text-white/80 border border-white/[0.12] hover:bg-white/[0.06] transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => { setSignOutConfirm(false); setUserMenuOpen(false); signOut(); }}
                      className="flex-1 px-3 py-2 rounded-lg text-[13px] font-medium text-white bg-risk hover:bg-risk-700 transition-colors cursor-pointer"
                    >
                      Sign Out
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="py-1.5">
                    <div className="flex items-center gap-2.5 px-4 py-2.5 text-[13px] text-white cursor-not-allowed">
                      <Building2 size={14} className="text-white" />
                      Irame Labs Pvt Ltd
                    </div>
                    {/* View-as-role switcher (prototype demo affordance) */}
                    <button
                      onClick={() => setRolesOpen(p => !p)}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] text-white hover:bg-white/[0.06] transition-colors cursor-pointer"
                    >
                      <Shield size={14} className="text-white" />
                      <span className="flex-1 text-left">View as role</span>
                      <span className="text-[11px] text-white/50 mr-1">{activeRole?.name}</span>
                      <ChevronDown size={12} className={`text-white transition-transform duration-150 ${rolesOpen ? 'rotate-180' : ''}`} />
                    </button>
                    {rolesOpen && (
                      <>
                        <div className="h-px mx-3 bg-white/[0.08]" />
                        <div className="py-1 max-h-[220px] overflow-y-auto">
                          {roles.map(r => (
                            <button
                              key={r.id}
                              onClick={() => { setActiveRole(r.id); setRolesOpen(false); setUserMenuOpen(false); }}
                              className="w-full flex items-center justify-between px-4 py-2.5 text-[13px] text-white hover:bg-white/[0.06] transition-colors cursor-pointer"
                            >
                              <span className="flex items-center gap-2">
                                {r.name}
                                <span className="text-[11px] text-white/40">{r.permissions.length}</span>
                              </span>
                              {activeRole?.id === r.id && <Check size={13} className="text-brand-400" strokeWidth={2.5} />}
                            </button>
                          ))}
                        </div>
                        <div className="h-px mx-3 bg-white/[0.08]" />
                      </>
                    )}
                    <button
                      onClick={() => setHelpOpen(p => !p)}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] text-white hover:bg-white/[0.06] transition-colors cursor-pointer"
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
                          ].map(item => (
                            <button
                              key={item.label}
                              onClick={() => { setUserMenuOpen(false); setHelpOpen(false); window.open(item.url, '_blank'); }}
                              className="w-full flex items-center justify-between px-4 py-2.5 text-[13px] text-white hover:bg-white/[0.06] transition-colors cursor-pointer"
                            >
                              {item.label}
                              <ExternalLink size={12} className="text-white" />
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                    <div className="h-px mx-3 my-1 bg-white/[0.08]" />
                    <button
                      onClick={() => setSignOutConfirm(true)}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] text-red-400 hover:bg-white/[0.06] hover:text-red-300 transition-colors cursor-pointer"
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

        {!isExpanded && (
          <button
            onClick={toggleSidebar}
            className="w-full flex items-center justify-center text-white hover:text-sidebar-text transition-colors p-1.5 rounded-lg hover:bg-sidebar-surface-hover cursor-pointer"
            title="Pin sidebar open (⌘\)"
            aria-label="Pin sidebar open"
            aria-pressed={false}
          >
            <PanelLeft size={15} />
          </button>
        )}
      </div>
    </motion.div>
    </div>
  );
}
