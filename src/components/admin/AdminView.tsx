/**
 * Administration — the "Access Console".
 *
 * A flattened, single-spine governance surface: People · Teams · Roles ·
 * Audit Log. Roles is a two-pane workspace (see RolesWorkspace.tsx); the other
 * sections are an inline stat ledger over a SmartTable, with create/edit flows
 * in centered modals. Every mutation writes to the audit trail and the live
 * RBAC model. No impersonation surface — invite → role assignment only.
 */

import { DateFilterPicker, dateInFilter, isDateFilterActive, DEFAULT_DATE_FILTER, type DateFilter } from '../shared/DateFilterPicker';
import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import {
  Users, User, Shield, ScrollText,
  UserPlus, Plus, Download, ArrowRight,
  ChevronDown, Pencil, Trash2, X, Check, Crown, Send, UserCheck, UserX, Gauge, UserMinus,
} from 'lucide-react';
import { PERMISSION_GROUPS } from '../../data/rbac';
import { useCurrentUser } from '../../context/CurrentUserContext';
import { useAdminData, useAuditLog, type AuditLog, type AdminTeam, type AdminUser, type UserStatus } from '../../context/AdminDataContext';
import SmartTable, { type Column } from '../shared/SmartTable';
import ColumnFilter from '../shared/ColumnFilter';
import FloatingLines from '../shared/FloatingLines';
import { StatusBadge, ActionBadge, ResultBadge } from '../shared/StatusBadge';
import Modal from '../shared/Modal';
import Checkbox from '../shared/Checkbox';
import ConfirmationModal from '../shared/ConfirmationModal';
import EmptyState from '../shared/EmptyState';
import { useToast } from '../shared/Toast';
import { RolesWorkspace, CreateRoleModal, type RoleSeed } from './RolesWorkspace';
import {
  FIELD_LABEL, FIELD_INPUT, BTN_CANCEL, BTN_PRIMARY,
  BTN_CTA_PRIMARY, BTN_CTA_OUTLINE, BTN_ROW, type Stat,
} from './adminTokens';
import { InitialsAvatar, MemberSearch, RowActions, AdminKpiRow, AdminSelect } from './AdminPrimitives';

interface Props {
  activeTab?: string;
}

/** Three flat tabs — every one shares the same skeleton: KPI band → toolbar
 *  (search left · filters/CTA right) → content. People & Teams are two views of
 *  one "Members" tab, toggled by a segmented switch above the (unchanged) People
 *  / Teams screens. */
type SectionId = 'members' | 'roles' | 'logs';
type MembersView = 'people' | 'teams';

const STATUS_MAP: Record<UserStatus, string> = {
  Active: 'active', Inactive: 'inactive', Invited: 'invited', Suspended: 'suspended', Locked: 'locked',
};

/* Semantic tones for the status selector pills — the status is a noun, so a
   selected pill wears its own colour (active=compliant, suspended=high,
   locked=risk, inactive=draft) rather than a generic brand fill. */
const STATUS_PILL_TONE: Record<UserStatus, { on: string; dot: string }> = {
  Active:    { on: 'bg-compliant-50 text-compliant-700', dot: 'bg-compliant-700' },
  Suspended: { on: 'bg-high-50 text-high-700',           dot: 'bg-high-700' },
  Locked:    { on: 'bg-risk-50 text-risk-700',           dot: 'bg-risk-700' },
  Inactive:  { on: 'bg-draft-50 text-draft-700',         dot: 'bg-draft-700' },
  Invited:   { on: 'bg-brand-50 text-brand-700',         dot: 'bg-brand-500' },
};

/* Audit-log filter dots — mirror the ActionBadge / ResultBadge tones so the
   Action + Result filters read like the Status filter (colored dot + label)
   and match the pills shown in the table rows. */
const ACTION_DOT: Record<string, string> = {
  Create: 'bg-compliant-700',
  Update: 'bg-evidence-700',
  Delete: 'bg-risk-700',
  Login:  'bg-brand-500',
  Export: 'bg-draft-700',
};
const RESULT_DOT: Record<string, string> = {
  Success: 'bg-compliant-700',
  Failed:  'bg-risk-700',
};

/* Team owner/admin badge — a small crown pill, reused in the Teams table and
   the Create / Manage Team member lists. */
function OwnerBadge() {
  return (
    <span className="inline-flex items-center gap-1 px-1.5 h-5 rounded-full bg-brand-50 text-brand-700 text-[0.625rem] font-semibold shrink-0">
      <Crown size={10} /> Owner
    </span>
  );
}

/* ── Section tabs — the horizontal underlined nav at the bottom of the header
      strip, matching Knowledge Hub's UnderlinedTabs exactly (pb-3 + font-semibold
      + a spring motion underline via layoutId). No inline CTA: each section's
      primary action lives on its body's controls row, the way KH does it. ── */
interface SectionDef { id: SectionId; label: string; icon: typeof Users; count?: number; }
function SectionTabs({ sections, current, onSelect }: { sections: SectionDef[]; current: SectionId; onSelect: (id: SectionId) => void }) {
  return (
    <div className="flex gap-6">
      {sections.map(s => {
        const Icon = s.icon;
        const isActive = current === s.id;
        return (
          <button
            key={s.id}
            onClick={() => onSelect(s.id)}
            className={`pb-3 text-[0.8125rem] font-semibold relative transition-colors cursor-pointer whitespace-nowrap ${
              isActive ? 'text-brand-700' : 'text-ink-500 hover:text-ink-700'
            }`}
          >
            <span className="flex items-center gap-2">
              <Icon size={14} />
              {s.label}
              {s.count != null && (
                <span className={`text-[0.625rem] font-bold px-1.5 py-0.5 rounded-full tabular-nums ${
                  isActive ? 'bg-brand-100 text-brand-700' : 'bg-paper-50 text-ink-500'
                }`}>{s.count}</span>
              )}
            </span>
            {isActive && (
              <motion.div
                layoutId="admin-tab-underline"
                className="absolute bottom-0 left-0 right-0 h-[3px] bg-brand-600 rounded-full"
                transition={{ type: 'spring', stiffness: 380, damping: 32 }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════
 * Modals
 * ════════════════════════════════════════════════════════════════════════ */

/* ── Inline cell select — a self-contained dropdown that edits one field
      directly in the table (role / team / status), so the common changes never
      need a modal. `trigger` renders the current value; the menu picks a new
      one. Stops row-click propagation so it doesn't also open Manage. ── */
interface InlineOption { value: string; label: string; node?: React.ReactNode; }
function InlineCellSelect({
  current, options, onPick, trigger, footer, menuWidth = 'w-48', align = 'left', direction = 'down',
}: {
  current: string;
  options: InlineOption[];
  onPick: (value: string) => void;
  trigger: (open: boolean) => React.ReactNode;
  footer?: (close: () => void) => React.ReactNode;
  menuWidth?: string;
  align?: 'left' | 'right';
  direction?: 'up' | 'down';
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);
  const up = direction === 'up';
  const posCls = `${up ? 'bottom-full mb-1.5' : 'top-full mt-1.5'} ${align === 'right' ? 'right-0' : 'left-0'}`;
  const originCls = up ? (align === 'right' ? 'origin-bottom-right' : 'origin-bottom-left') : (align === 'right' ? 'origin-top-right' : 'origin-top-left');
  return (
    <div className="relative" ref={ref} onClick={e => e.stopPropagation()}>
      <button onClick={e => { e.stopPropagation(); setOpen(o => !o); }} className="no-focus-ring cursor-pointer text-left">
        {trigger(open)}
      </button>
      {open && (
        <motion.div
          initial={{ opacity: 0, y: up ? 4 : -4, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.13, ease: [0.2, 0, 0, 1] }}
          className={`absolute ${posCls} ${originCls} ${menuWidth} bg-canvas-elevated border border-canvas-border rounded-xl shadow-[0_10px_30px_-12px_rgba(15,8,30,0.28)] p-1 z-30 max-h-[280px] overflow-y-auto`}
        >
          {options.map(o => {
            const sel = o.value === current;
            return (
              <button
                key={o.value}
                onClick={e => { e.stopPropagation(); onPick(o.value); setOpen(false); }}
                className={`no-focus-ring flex w-full items-center justify-between gap-2 px-2.5 h-8 rounded-md text-[0.8125rem] text-left cursor-pointer transition-colors ${sel ? 'bg-brand-50 text-brand-700 font-semibold' : 'text-ink-700 hover:bg-canvas'}`}
              >
                <span className="truncate flex items-center gap-2 min-w-0">{o.node ?? o.label}</span>
                {sel && <Check size={14} className="shrink-0 text-brand-600" />}
              </button>
            );
          })}
          {footer && footer(() => setOpen(false))}
        </motion.div>
      )}
    </div>
  );
}

/* Action button styles for the floating bulk bar (on the dark brand surface). */
const BULK_ACTION = 'inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md text-[0.8125rem] font-medium text-white/90 hover:bg-white/10 transition-colors cursor-pointer';
const BULK_ACTION_RISK = 'inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md text-[0.8125rem] font-medium text-risk-300 hover:bg-white/10 transition-colors cursor-pointer';

/* ── Bulk bar — the floating selection toolbar shared by People & Teams. A
      content-width pill anchored bottom-center on the brand-900 surface (the
      platform's single dark surface), with thin vertical dividers between the
      count, the actions, and the close. Matches the app's other bulk bars. ── */
function BulkBar({ count, total, allSelected, onSelectAll, onClear, children }: {
  count: number;
  total: number;
  allSelected: boolean;
  onSelectAll: () => void;
  onClear: () => void;
  children: React.ReactNode;
}) {
  const prefersReduced = useReducedMotion();
  return (
    <motion.div
      initial={prefersReduced ? { opacity: 0, x: '-50%' } : { opacity: 0, y: 16, x: '-50%' }}
      animate={{ opacity: 1, y: 0, x: '-50%' }}
      exit={prefersReduced ? { opacity: 0, x: '-50%' } : { opacity: 0, y: 16, x: '-50%' }}
      transition={{ duration: 0.18, ease: [0.2, 0, 0, 1] }}
      className="fixed bottom-6 left-1/2 z-50 flex items-center h-11 rounded-xl bg-brand-900 text-white shadow-[0_12px_36px_-12px_rgba(15,8,30,0.5)]"
    >
      <div className="flex items-center gap-2 pl-3.5 pr-3">
        <span className="text-[0.8125rem] font-semibold tabular-nums whitespace-nowrap">{count} selected</span>
        {!allSelected && (
          <button onClick={onSelectAll} className="text-[0.75rem] font-medium text-white/55 hover:text-white transition-colors cursor-pointer whitespace-nowrap">Select all {total}</button>
        )}
      </div>
      <span className="w-px h-5 bg-white/15" />
      <div className="flex items-center gap-0.5 px-1.5">{children}</div>
      <span className="w-px h-5 bg-white/15" />
      <button onClick={onClear} aria-label="Clear selection" className="mx-1 inline-flex items-center justify-center w-8 h-8 rounded-md text-white/70 hover:text-white hover:bg-white/10 transition-colors cursor-pointer">
        <X size={16} />
      </button>
    </motion.div>
  );
}

/* ── Manage user — one modal that shows the user AND edits them. Opened from a
      row click or the Manage action; saves name / email / role / team / status,
      shows effective permissions + recent activity, and removes. ── */
function UserManageModal({ user, onClose, onManageRole }: { user: AdminUser; onClose: () => void; onManageRole: (roleId: string) => void }) {
  const { addToast } = useToast();
  const logEvent = useAuditLog();
  const { updateUser, removeUser, inviteUser, updateTeam, teams, users } = useAdminData();
  const { roles, currentUser } = useCurrentUser();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmSuspend, setConfirmSuspend] = useState(false);
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [roleId, setRoleId] = useState(user.roleId);
  const [team, setTeam] = useState(user.team);
  const [status, setStatus] = useState<UserStatus>(user.status);
  // Save is enabled only when a field actually changed (dirty-state).
  const dirty = name !== user.name || email !== user.email || roleId !== user.roleId || team !== user.team || status !== user.status;
  // Per-team chosen new owner for the transfer picker (team.id \u2192 member name; '' = Unassigned).
  const [transfer, setTransfer] = useState<Record<string, string>>({});

  const teamOptions = [...new Set([...teams.map(t => t.name), user.team, '\u2014'])];
  // Teams this person currently owns \u2014 drives the transfer-ownership warnings.
  const ownedTeams = teams.filter(t => t.owner === user.name);
  // Teams this person is the ONLY member of — removing them would leave the team
  // empty/ownerless, which isn't allowed (a team must always have an owner).
  const soleMemberTeams = teams.filter(t => t.members.length > 0 && t.members.every(m => m === user.name));
  const isAdminName = (n: string) => users.find(u => u.name === n)?.roleId === 'role-admin';
  // Lockout guards (C1/C2): the signed-in user can't strip their own admin
  // access, and the final active System Admin can't be demoted/suspended/removed.
  const isSelf = !!currentUser && currentUser.email === user.email;
  const activeAdmins = users.filter(u => u.roleId === 'role-admin' && u.status === 'Active');
  const isLastAdmin = user.roleId === 'role-admin' && user.status === 'Active'
    && activeAdmins.length === 1 && activeAdmins[0].email === user.email;
  // Default new owner per team: a System Admin member (excl. this user), else the
  // first remaining member. A team always keeps an owner — never Unassigned.
  const defaultNewOwner = (t: AdminTeam) => {
    const cands = t.members.filter(m => m !== user.name);
    return cands.find(isAdminName) ?? cands[0] ?? '';
  };
  const chosenOwner = (t: AdminTeam) => transfer[t.id] ?? defaultNewOwner(t);
  const applyTransfers = () => {
    ownedTeams.forEach(t => {
      const next = chosenOwner(t);
      updateTeam(t.id, { owner: next || undefined });
      logEvent({ action: 'Update', description: `Transferred ownership of "${t.name}" to ${next || 'Unassigned'}`, module: 'Admin', entity: 'Team' });
    });
  };

  // Inline per-team owner picker shown inside the delete / suspend confirms.
  const transferPicker = ownedTeams.length === 0 ? null : (
    <div className="mt-3 rounded-lg border border-canvas-border bg-canvas p-2.5 space-y-2">
      <div className="text-[0.625rem] font-semibold text-ink-500 uppercase tracking-wide">Reassign ownership</div>
      {ownedTeams.map(t => {
        const cands = t.members.filter(m => m !== user.name);
        return (
          <div key={t.id} className="flex items-center gap-2">
            <span className="text-[0.75rem] text-ink-700 flex-1 min-w-0 truncate">{t.name}</span>
            <AdminSelect
              size="sm"
              align="end"
              className="shrink-0 w-[11rem]"
              ariaLabel={`Reassign ${t.name} to`}
              value={chosenOwner(t)}
              onChange={v => setTransfer(p => ({ ...p, [t.id]: v }))}
              options={cands.map(c => ({ value: c, label: c, hint: isAdminName(c) ? 'Admin' : undefined }))}
            />
          </div>
        );
      })}
    </div>
  );

  const doSave = () => {
    updateUser(user.email, { name: name.trim(), email: email.trim(), roleId, team, status });
    logEvent({ action: 'Update', description: `Updated user "${name.trim()}" (status: ${status})`, module: 'Admin', entity: 'User' });
    onClose();
    addToast({ message: 'User updated', type: 'success' });
  };
  const save = () => {
    // Validate the identity fields the same way Invite does — name + email are
    // required, the email must be well-formed, and (since email is the row key)
    // it can't collide with another user's.
    const nm = name.trim();
    const mail = email.trim();
    if (!nm || !mail) { addToast({ message: 'Name and email are required', type: 'error' }); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) { addToast({ message: 'Enter a valid email address', type: 'error' }); return; }
    if (users.some(u => u.email !== user.email && u.email.toLowerCase() === mail.toLowerCase())) {
      addToast({ message: 'A user with this email already exists', type: 'error' }); return;
    }
    // Block changes that strip the user's own admin access (C1) or demote/
    // suspend the last active administrator (C2).
    const losesAdmin = roleId !== 'role-admin' || status !== 'Active';
    if (isSelf && user.roleId === 'role-admin' && losesAdmin) {
      addToast({ message: "You can't remove your own administrator access", type: 'error' }); return;
    }
    if (isLastAdmin && losesAdmin) {
      addToast({ message: 'There must be at least one active administrator', type: 'error' }); return;
    }
    // Suspending/locking a team owner hands their ownership off \u2014 confirm first.
    const restricting = (status === 'Suspended' || status === 'Locked') && user.status !== status;
    if (restricting && ownedTeams.length > 0) { setConfirmSuspend(true); return; }
    doSave();
  };
  const remove = () => {
    if (isSelf) { addToast({ message: "You can't remove your own account", type: 'error' }); setConfirmDelete(false); return; }
    if (isLastAdmin) { addToast({ message: 'There must be at least one active administrator', type: 'error' }); setConfirmDelete(false); return; }
    if (soleMemberTeams.length > 0) {
      const names = soleMemberTeams.map(t => `"${t.name}"`).join(', ');
      addToast({ message: `Can't remove — ${user.name} is the only member of ${soleMemberTeams.length === 1 ? 'team' : 'teams'} ${names}. A team must keep an owner — add another member or delete the team first.`, type: 'error' });
      setConfirmDelete(false); return;
    }
    // Honour the picker's ownership choices only now that removal is actually
    // proceeding — running it earlier would strip ownership even when a guard
    // above refuses the delete (N3).
    applyTransfers();
    removeUser(user.email);
    logEvent({ action: 'Delete', description: `Removed user "${user.name}"`, module: 'Admin', entity: 'User' });
    setConfirmDelete(false);
    onClose();
    addToast({ message: `${user.name} removed`, type: 'success' });
  };

  return (
    <>
      <Modal
        title="Manage User"
        width="max-w-[600px]"
        onClose={onClose}
        footer={
          <>
            {/* Invited users are removed via the panel's Revoke; only show the
                footer remove for users who've actually joined. */}
            {user.status !== 'Invited' && (
              <button
                onClick={() => setConfirmDelete(true)}
                disabled={isSelf || isLastAdmin}
                title={isSelf ? "You can't remove your own account" : isLastAdmin ? 'There must be at least one active administrator' : undefined}
                className="mr-auto inline-flex items-center gap-1.5 h-9 px-3 rounded-md text-[0.8125rem] font-medium text-risk-700 hover:bg-risk-50 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
              >
                <Trash2 size={14} /> Remove User
              </button>
            )}
            <button className={BTN_CANCEL} onClick={onClose}>Cancel</button>
            <button className={`${BTN_PRIMARY} disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-brand-600`} disabled={!dirty} onClick={save}>Save Changes</button>
          </>
        }
      >
        <div className="space-y-6">
          {/* Profile — name + email are the identity; no separate card. */}
          <section>
            <h3 className="text-[0.6875rem] font-semibold text-ink-500 uppercase tracking-[0.14em] mb-3">Profile</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={FIELD_LABEL}>Full Name</label>
                <input value={name} onChange={e => setName(e.target.value)} className={FIELD_INPUT} />
              </div>
              <div>
                <label className={FIELD_LABEL}>Email</label>
                <input value={email} onChange={e => setEmail(e.target.value)} className={FIELD_INPUT} />
              </div>
            </div>
          </section>

          {/* Access — role, team, status in one tight block. */}
          <section>
            <h3 className="text-[0.6875rem] font-semibold text-ink-500 uppercase tracking-[0.14em] mb-3">Access</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={FIELD_LABEL}>Role</label>
                <AdminSelect
                  ariaLabel="Role"
                  value={roleId}
                  onChange={setRoleId}
                  options={roles.map(r => ({ value: r.id, label: r.name }))}
                />
              </div>
              <div>
                <label className={FIELD_LABEL}>Team</label>
                <AdminSelect
                  ariaLabel="Team"
                  value={team}
                  onChange={setTeam}
                  options={teamOptions.map(t => ({ value: t, label: t }))}
                />
              </div>
            </div>
            <div className="mt-4">
              <label className={FIELD_LABEL}>Status</label>
              {user.status === 'Invited' ? (
                /* An invited user has no Active/Suspended/… status yet — that only
                   applies once they accept. Offer invite actions, not the toggle. */
                <div className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-md border border-canvas-border bg-canvas">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="inline-flex items-center gap-1.5 px-2 h-6 rounded-md bg-brand-50 text-brand-700 text-[0.6875rem] font-medium shrink-0">
                      <span className="w-1.5 h-1.5 rounded-full bg-brand-500" />Invited
                    </span>
                    <span className="text-[0.75rem] text-ink-500 truncate">Hasn't accepted yet — active status applies once they join.</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => { logEvent({ action: 'Update', description: `Resent invitation to "${user.name}"`, module: 'Admin', entity: 'User' }); addToast({ message: `Invitation resent to ${user.email}`, type: 'success' }); }}
                      className={BTN_ROW}
                    >
                      <Send size={12} /> Resend
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        removeUser(user.email);
                        logEvent({ action: 'Delete', description: `Revoked invitation for "${user.name}"`, module: 'Admin', entity: 'User' });
                        onClose();
                        addToast({
                          message: `Invitation to ${user.name} revoked`,
                          type: 'success',
                          action: { label: 'Undo', onClick: () => { inviteUser({ name: user.name, initials: user.initials, email: user.email, roleId: user.roleId, team: user.team, status: 'Invited', lastLogin: 'Never' }); addToast({ message: 'Invitation restored', type: 'info' }); } },
                        });
                      }}
                      className="inline-flex items-center gap-1.5 px-2.5 h-7 rounded-md border border-canvas-border text-[0.75rem] font-medium text-risk-700 hover:bg-risk-50 transition-colors cursor-pointer"
                    >
                      <X size={12} /> Revoke
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 flex-wrap">
                  {(['Active', 'Suspended', 'Locked', 'Inactive'] as UserStatus[]).map(s => {
                    const sel = status === s;
                    const tone = STATUS_PILL_TONE[s];
                    return (
                      <button
                        key={s}
                        onClick={() => setStatus(s)}
                        aria-pressed={sel}
                        className={`inline-flex items-center gap-1.5 px-3 h-8 rounded-md border text-[0.75rem] font-medium transition-colors cursor-pointer ${
                          sel ? `${tone.on} border-transparent` : 'border-canvas-border text-ink-600 hover:bg-canvas'
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${sel ? tone.dot : 'bg-ink-300'}`} />
                        {s}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </section>

          {/* Effective permissions — one compact summary line + bar; the full
              matrix lives behind "Manage role" (no long grid here). */}
          {(() => {
            const role = roles.find(r => r.id === roleId);
            const enabled = new Set(role?.permissions ?? []);
            const allPerms = PERMISSION_GROUPS.flatMap(g => g.perms);
            const enabledCount = allPerms.filter(p => enabled.has(p.key)).length;
            const pct = allPerms.length ? Math.round((enabledCount / allPerms.length) * 100) : 0;
            return (
              <section>
                <div className="flex items-center justify-between gap-3 mb-2.5">
                  <h3 className="text-[0.6875rem] font-semibold text-ink-500 uppercase tracking-[0.14em]">Effective Permissions</h3>
                  <button
                    onClick={() => onManageRole(roleId)}
                    className="shrink-0 inline-flex items-center gap-1 text-[0.75rem] font-medium text-brand-700 hover:text-brand-600 transition-colors cursor-pointer"
                  >
                    Manage role <ArrowRight size={12} />
                  </button>
                </div>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-[0.8125rem] text-ink-700">
                    <span className="font-semibold text-ink-900 tabular-nums">{enabledCount}</span>
                    <span className="text-ink-400 tabular-nums"> / {allPerms.length}</span> permissions
                    <span className="text-ink-400"> · via </span>
                    <span className="font-medium text-ink-700">{role?.name ?? '—'}</span>
                  </span>
                  <span className="text-[0.8125rem] font-semibold text-brand-700 tabular-nums shrink-0">{pct}%</span>
                </div>
                <div className="mt-2 h-1.5 rounded-full bg-canvas-border/70 overflow-hidden">
                  <div className="h-full rounded-full bg-brand-500 transition-all duration-300" style={{ width: `${pct}%` }} />
                </div>

                {/* Per-module coverage map — compact (module + count, no chips)
                    so the modal never scrolls. The full matrix is behind
                    "Manage role". */}
                {enabledCount === 0 ? (
                  <p className="mt-3 text-[0.75rem] text-ink-400">No permissions granted by this role.</p>
                ) : (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {PERMISSION_GROUPS.map(g => {
                      const cnt = g.perms.filter(p => enabled.has(p.key)).length;
                      const tot = g.perms.length;
                      const state = cnt === 0 ? 'none' : cnt === tot ? 'full' : 'partial';
                      return (
                        <span
                          key={g.group}
                          className={`inline-flex items-center gap-1.5 px-2 h-7 rounded-md text-[0.6875rem] font-medium ${
                            state === 'full' ? 'bg-brand-50 text-brand-700'
                              : state === 'partial' ? 'bg-canvas border border-brand-200 text-brand-700'
                              : 'bg-canvas border border-canvas-border text-ink-400'
                          }`}
                        >
                          {g.group}
                          <span className="tabular-nums opacity-70">{cnt}/{tot}</span>
                        </span>
                      );
                    })}
                  </div>
                )}
              </section>
            );
          })()}
        </div>
      </Modal>

      <ConfirmationModal
        open={confirmDelete}
        title="Remove user?"
        description={<>
          This will remove <span className="font-semibold">{user.name}</span>. This action cannot be undone.
          {ownedTeams.length > 0 && (
            <>
              <span className="mt-2 block text-risk-700">⚠ They own {ownedTeams.length === 1 ? 'a team' : 'teams'}. Choose who inherits {ownedTeams.length === 1 ? 'it' : 'each'}:</span>
              {transferPicker}
            </>
          )}
        </>}
        confirmLabel="Remove User"
        tone="destructive"
        onConfirm={remove}
        onClose={() => setConfirmDelete(false)}
      />

      <ConfirmationModal
        open={confirmSuspend}
        title={`${status === 'Locked' ? 'Lock' : 'Suspend'} a team owner?`}
        description={<>
          <span className="font-semibold">{user.name}</span> owns {ownedTeams.length === 1 ? 'a team' : 'teams'}. {status === 'Locked' ? 'Locking' : 'Suspending'} them hands it off — choose who inherits {ownedTeams.length === 1 ? 'it' : 'each'}:
          {transferPicker}
        </>}
        confirmLabel={status === 'Locked' ? 'Lock & Transfer' : 'Suspend & Transfer'}
        tone="destructive"
        onConfirm={() => { applyTransfers(); setConfirmSuspend(false); doSave(); }}
        onClose={() => setConfirmSuspend(false)}
      />
    </>
  );
}

/* ── Invite user ── */
function InviteUserModal({ onClose }: { onClose: () => void }) {
  const { addToast } = useToast();
  const logEvent = useAuditLog();
  const { inviteUser, defaultRoleId, teams, users } = useAdminData();
  const { roles } = useCurrentUser();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [team, setTeam] = useState('');
  const [selectedRoleId, setSelectedRoleId] = useState(() => roles.find(r => r.id === defaultRoleId)?.id ?? roles[0]?.id ?? '');
  const selectedRole = roles.find(r => r.id === selectedRoleId);
  // Guards a double-click / double-Enter from sending two invites (F3).
  const submitting = useRef(false);

  const invite = () => {
    if (submitting.current) return;
    const name = fullName.trim();
    const mail = email.trim();
    if (!name || !mail) { addToast({ message: 'Name and email are required', type: 'error' }); return; }
    // Validate email shape (A1) and uniqueness (A2/B1 — email is the row key).
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) { addToast({ message: 'Enter a valid email address', type: 'error' }); return; }
    if (users.some(u => u.email.toLowerCase() === mail.toLowerCase())) { addToast({ message: 'A user with this email already exists', type: 'error' }); return; }
    // Initials: unicode-safe, skips empty parts, falls back to the email (A3/A4).
    const letters = name.split(/\s+/).filter(Boolean).map(p => Array.from(p)[0] ?? '').join('');
    const initials = (Array.from(letters || Array.from(mail)[0] || '?').slice(0, 2).join('')).toUpperCase();
    const roleLabel = roles.find(r => r.id === selectedRoleId)?.name ?? selectedRoleId;
    submitting.current = true;
    inviteUser({ name, initials, email: mail, roleId: selectedRoleId, team: team || '—', status: 'Invited', lastLogin: 'Never' });
    logEvent({ action: 'Create', description: `Invited user "${name}" with role "${roleLabel}"`, module: 'Admin', entity: 'User' });
    onClose();
    addToast({ message: 'Invitation sent', type: 'success' });
  };

  return (
    <Modal
      title="Invite User"
      width="max-w-[600px]"
      onClose={onClose}
      footer={
        <>
          <button className={BTN_CANCEL} onClick={onClose}>Cancel</button>
          <button className={`${BTN_PRIMARY} disabled:opacity-40 disabled:cursor-not-allowed`} onClick={invite} disabled={!fullName.trim() || !email.trim()}>Send Invite</button>
        </>
      }
    >
      <div className="space-y-6">
        {/* Profile — name + email side by side, matching Manage User. */}
        <section>
          <h3 className="text-[0.6875rem] font-semibold text-ink-500 uppercase tracking-[0.14em] mb-3">Profile</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={FIELD_LABEL}>Full Name <span className="text-risk-700">*</span></label>
              <input value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Enter full name" className={FIELD_INPUT} />
            </div>
            <div>
              <label className={FIELD_LABEL}>Email <span className="text-risk-700">*</span></label>
              <input value={email} onChange={e => setEmail(e.target.value)} placeholder="Enter email address" className={FIELD_INPUT} />
            </div>
          </div>
        </section>

        {/* Access — role + team, the invite-time mirror of Manage User's Access
            block (no Status: a new invite is always "Invited"). */}
        <section>
          <h3 className="text-[0.6875rem] font-semibold text-ink-500 uppercase tracking-[0.14em] mb-3">Access</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={FIELD_LABEL}>Role</label>
              <AdminSelect
                ariaLabel="Role"
                value={selectedRoleId}
                onChange={setSelectedRoleId}
                options={roles.map(r => ({ value: r.id, label: r.name, hint: r.id === defaultRoleId ? 'Default' : undefined }))}
              />
            </div>
            <div>
              <label className={FIELD_LABEL}>Team</label>
              <AdminSelect
                ariaLabel="Team"
                placeholder="Unassigned"
                value={team}
                onChange={setTeam}
                options={[{ value: '', label: 'Unassigned' }, ...teams.map(t => ({ value: t.name, label: t.name }))]}
              />
            </div>
          </div>
          {selectedRole?.description && (
            <p className="mt-2 text-[0.75rem] text-ink-500">{selectedRole.description}</p>
          )}
        </section>

        {/* Effective permissions — the same live preview as Manage User, so the
            inviter sees exactly what the chosen role grants. */}
        {(() => {
          const enabled = new Set(selectedRole?.permissions ?? []);
          const allPerms = PERMISSION_GROUPS.flatMap(g => g.perms);
          const enabledCount = allPerms.filter(p => enabled.has(p.key)).length;
          const pct = allPerms.length ? Math.round((enabledCount / allPerms.length) * 100) : 0;
          return (
            <section>
              <div className="flex items-center justify-between gap-3 mb-2.5">
                <h3 className="text-[0.6875rem] font-semibold text-ink-500 uppercase tracking-[0.14em]">Effective Permissions</h3>
                <span className="text-[0.6875rem] text-ink-400">One role per user</span>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-[0.8125rem] text-ink-700">
                  <span className="font-semibold text-ink-900 tabular-nums">{enabledCount}</span>
                  <span className="text-ink-400 tabular-nums"> / {allPerms.length}</span> permissions
                  <span className="text-ink-400"> · via </span>
                  <span className="font-medium text-ink-700">{selectedRole?.name ?? '—'}</span>
                </span>
                <span className="text-[0.8125rem] font-semibold text-brand-700 tabular-nums shrink-0">{pct}%</span>
              </div>
              <div className="mt-2 h-1.5 rounded-full bg-canvas-border/70 overflow-hidden">
                <div className="h-full rounded-full bg-brand-500 transition-all duration-300" style={{ width: `${pct}%` }} />
              </div>

              {enabledCount === 0 ? (
                <p className="mt-3 text-[0.75rem] text-ink-400">No permissions granted by this role.</p>
              ) : (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {PERMISSION_GROUPS.map(g => {
                    const cnt = g.perms.filter(p => enabled.has(p.key)).length;
                    const tot = g.perms.length;
                    const state = cnt === 0 ? 'none' : cnt === tot ? 'full' : 'partial';
                    return (
                      <span
                        key={g.group}
                        className={`inline-flex items-center gap-1.5 px-2 h-7 rounded-md text-[0.6875rem] font-medium ${
                          state === 'full' ? 'bg-brand-50 text-brand-700'
                            : state === 'partial' ? 'bg-canvas border border-brand-200 text-brand-700'
                            : 'bg-canvas border border-canvas-border text-ink-400'
                        }`}
                      >
                        {g.group}
                        <span className="tabular-nums opacity-70">{cnt}/{tot}</span>
                      </span>
                    );
                  })}
                </div>
              )}
            </section>
          );
        })()}
      </div>
    </Modal>
  );
}

/* ── Create team ── */
function CreateTeamModal({ onClose }: { onClose: () => void }) {
  const { addToast } = useToast();
  const logEvent = useAuditLog();
  const { addTeam, users, teams } = useAdminData();
  const submitting = useRef(false);
  const [teamName, setTeamName] = useState('');
  const [memberSearch, setMemberSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  // Owner is one of the selected members (tracked by email). null = auto-pick:
  // the first System-Admin member, else the first member. The signed-in admin is
  // a backend identity that isn't in the People list, so a team is owned by one
  // of its real members — never the (non-member) creator (N6).
  const [ownerEmail, setOwnerEmail] = useState<string | null>(null);

  const filtered = users.filter(m =>
    !memberSearch || m.name.toLowerCase().includes(memberSearch.toLowerCase()) || m.email.toLowerCase().includes(memberSearch.toLowerCase())
  );

  const toggle = (email: string) => setSelected(prev => {
    const n = new Set(prev);
    if (n.has(email)) { n.delete(email); if (ownerEmail === email) setOwnerEmail(null); }
    else n.add(email);
    return n;
  });

  // Effective owner = the explicit pick if still selected, else the auto choice
  // (first admin member, else first member). Empty when no members are selected.
  const selectedUsers = users.filter(u => selected.has(u.email));
  const autoOwner = selectedUsers.find(u => u.roleId === 'role-admin') ?? selectedUsers[0];
  const effectiveOwnerEmail = (ownerEmail && selected.has(ownerEmail)) ? ownerEmail : (autoOwner?.email ?? '');
  const ownerName = users.find(u => u.email === effectiveOwnerEmail)?.name;

  const create = () => {
    if (submitting.current) return;
    const trimmed = teamName.trim();
    if (!trimmed) { addToast({ message: 'Team name is required', type: 'error' }); return; }
    // Reject duplicate team names (A5).
    if (teams.some(t => t.name.trim().toLowerCase() === trimmed.toLowerCase())) { addToast({ message: 'A team with this name already exists', type: 'error' }); return; }
    const members = selectedUsers.map(u => u.name);
    // Owner is always a selected member (or none for an empty team) — no phantom.
    const finalOwner = ownerName;
    submitting.current = true;
    addTeam(trimmed, members, finalOwner);
    logEvent({ action: 'Create', description: `Created team "${trimmed}" with ${members.length} member${members.length !== 1 ? 's' : ''}${finalOwner ? `, owner ${finalOwner}` : ''}`, module: 'Admin', entity: 'Team' });
    onClose();
    addToast({ message: 'Team created', type: 'success' });
  };

  return (
    <Modal
      title="Create Team"
      onClose={onClose}
      footer={
        <>
          <span className="mr-auto text-[0.75rem] text-ink-500 tabular-nums">{selected.size} member{selected.size !== 1 ? 's' : ''} selected</span>
          <button className={BTN_CANCEL} onClick={onClose}>Cancel</button>
          <button className={`${BTN_PRIMARY} disabled:opacity-40 disabled:cursor-not-allowed`} onClick={create} disabled={!teamName.trim()}>Create Team</button>
        </>
      }
    >
      <div className="space-y-6">
        {/* Details — name + owner on one row. Owner is one of the selected
            members (auto-picks the first admin member until you choose); the
            member rows below stay read-only re: ownership. */}
        <section>
          <h3 className="text-[0.6875rem] font-semibold text-ink-500 uppercase tracking-[0.14em] mb-3">Details</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={FIELD_LABEL}>Team Name <span className="text-risk-700">*</span></label>
              <input value={teamName} onChange={e => setTeamName(e.target.value)} placeholder="Enter a unique team name" className={FIELD_INPUT} />
            </div>
            <div>
              <label className={`${FIELD_LABEL} flex items-center gap-1.5`}>
                <Crown size={12} className="text-brand-600" /> Owner
              </label>
              <AdminSelect
                value={effectiveOwnerEmail}
                onChange={setOwnerEmail}
                placeholder={selected.size ? 'Select owner' : 'Add a member first'}
                options={selectedUsers.map(u => ({ value: u.email, label: u.name, hint: u.roleId === 'role-admin' ? 'Admin' : undefined }))}
                ariaLabel="Change team owner"
              />
            </div>
          </div>
        </section>

        <section>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-[0.6875rem] font-semibold text-ink-500 uppercase tracking-[0.14em]">Members</h3>
            <span className="text-[0.6875rem] text-ink-400 tabular-nums">{selected.size} selected</span>
          </div>

          <MemberSearch value={memberSearch} onChange={setMemberSearch} placeholder="Search members..." />

          <div className="mt-3 border border-canvas-border rounded-xl overflow-hidden max-h-[300px] overflow-y-auto">
            {filtered.map((m, i) => {
              const isChecked = selected.has(m.email);
              return (
                <div
                  key={m.email}
                  onClick={() => toggle(m.email)}
                  className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors ${i > 0 ? 'border-t border-canvas-border' : ''} ${isChecked ? 'bg-brand-50/40' : 'hover:bg-canvas'}`}
                >
                  <Checkbox checked={isChecked} />
                  <InitialsAvatar name={m.name} size={28} />
                  <div className="min-w-0 flex-1">
                    <div className="text-[0.8125rem] font-medium text-ink-800 truncate">{m.name}</div>
                    <div className="text-[0.75rem] text-ink-500 truncate">{m.email}</div>
                  </div>
                  {isChecked && effectiveOwnerEmail === m.email && <OwnerBadge />}
                </div>
              );
            })}
            {filtered.length === 0 && (
              <div className="px-4 py-8 text-center text-[0.8125rem] text-ink-400">No users match your search.</div>
            )}
          </div>
        </section>
      </div>
    </Modal>
  );
}

/* ── Manage / edit team ── */
function EditTeamModal({ team, onClose }: { team: AdminTeam; onClose: () => void }) {
  const { addToast } = useToast();
  const logEvent = useAuditLog();
  const { users, updateTeam, removeTeam, teams, setTeamMembership } = useAdminData();
  const [teamName, setTeamName] = useState(team.name);
  const [memberSearch, setMemberSearch] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [members, setMembers] = useState<Set<string>>(new Set(team.members));
  const [owner, setOwner] = useState<string>(team.owner ?? '');
  // Save is enabled only when name / members / owner actually changed.
  const dirty = (teamName.trim() !== '' && teamName.trim() !== team.name) || owner !== (team.owner ?? '') || members.size !== team.members.length || team.members.some(m => !members.has(m));
  // Ownership transfer is gated by a confirm — too consequential for a stray click.
  const [pendingOwner, setPendingOwner] = useState<string | null>(null);

  const filtered = users.map(u => u.name).filter(name => !memberSearch || name.toLowerCase().includes(memberSearch.toLowerCase()));

  // A team always keeps an owner. When the current owner is removed, ownership
  // auto-transfers to a System Admin member if there is one, else to the first
  // remaining member. (Manual "Make owner" below can still pick any member.)
  const nextOwner = (names: Iterable<string>) => {
    const list = [...names];
    return list.find(n => users.find(u => u.name === n)?.roleId === 'role-admin') ?? list[0];
  };

  const toggle = (name: string) => {
    // A team must keep at least one member (and therefore an owner) — block
    // unchecking the last one.
    if (members.has(name) && members.size === 1) {
      addToast({ message: 'A team must have at least one member', type: 'error' });
      return;
    }
    setMembers(prev => {
      const n = new Set(prev);
      if (n.has(name)) { n.delete(name); if (owner === name) setOwner(nextOwner(n) ?? ''); }
      else n.add(name);
      return n;
    });
  };

  const save = () => {
    const trimmed = teamName.trim() || team.name;
    // Reject a rename that collides with another team (A5).
    if (teams.some(t => t.id !== team.id && t.name.trim().toLowerCase() === trimmed.toLowerCase())) {
      addToast({ message: 'A team with this name already exists', type: 'error' }); return;
    }
    const finalOwner = members.has(owner) ? owner : (nextOwner(members) ?? undefined);
    // Rename + owner on the team entity; membership is written through the users
    // (single source). Rename first so the cascade lands before the membership diff.
    updateTeam(team.id, { name: trimmed, owner: finalOwner });
    setTeamMembership(trimmed, [...members]);
    logEvent({ action: 'Update', description: `Updated team "${trimmed}" (${members.size} members${finalOwner ? `, owner ${finalOwner}` : ''})`, module: 'Admin', entity: 'Team' });
    onClose();
    addToast({ message: 'Team updated', type: 'success' });
  };
  const remove = () => {
    removeTeam(team.id);
    logEvent({ action: 'Delete', description: `Deleted team "${team.name}"`, module: 'Admin', entity: 'Team' });
    setConfirmDelete(false);
    onClose();
    addToast({ message: `Team ${team.name} deleted`, type: 'success' });
  };

  return (
    <>
      <Modal
        title="Manage Team"
        width="max-w-[600px]"
        onClose={onClose}
        footer={
          <>
            <button onClick={() => setConfirmDelete(true)} className="mr-auto inline-flex items-center gap-1.5 h-9 px-3 rounded-md text-[0.8125rem] font-medium text-risk-700 hover:bg-risk-50 transition-colors cursor-pointer">
              <Trash2 size={14} /> Delete Team
            </button>
            <button className={BTN_CANCEL} onClick={onClose}>Cancel</button>
            <button className={`${BTN_PRIMARY} disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-brand-600`} disabled={!dirty} onClick={save}>Save Changes</button>
          </>
        }
      >
        <div className="space-y-6">
          {/* Details — name + owner on one row. Owner is changed here: picking
              another member swaps ownership (gated by a confirm); the member
              rows below stay read-only re: ownership. */}
          <section>
            <h3 className="text-[0.6875rem] font-semibold text-ink-500 uppercase tracking-[0.14em] mb-3">Details</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={FIELD_LABEL}>Team Name</label>
                <input value={teamName} onChange={e => setTeamName(e.target.value)} className={FIELD_INPUT} />
              </div>
              <div>
                <label className={`${FIELD_LABEL} flex items-center gap-1.5`}>
                  <Crown size={12} className="text-brand-600" /> Owner
                </label>
                <AdminSelect
                  value={owner}
                  onChange={(name) => { if (name && name !== owner) setPendingOwner(name); }}
                  options={[...members].map(n => ({ value: n, label: n }))}
                  ariaLabel="Change team owner"
                />
              </div>
            </div>
          </section>

          {/* Members */}
          <section>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-[0.6875rem] font-semibold text-ink-500 uppercase tracking-[0.14em]">Members</h3>
              <span className="text-[0.6875rem] text-ink-400 tabular-nums">{members.size} selected</span>
            </div>

            <MemberSearch value={memberSearch} onChange={setMemberSearch} placeholder="Search members..." />

            <div className="mt-3 border border-canvas-border rounded-xl overflow-hidden max-h-[280px] overflow-y-auto">
              {filtered.map((name, i) => {
                const isIn = members.has(name);
                return (
                  <div
                    key={name + i}
                    onClick={() => toggle(name)}
                    className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors ${i > 0 ? 'border-t border-canvas-border' : ''} ${isIn ? 'bg-brand-50/40' : 'hover:bg-canvas'}`}
                  >
                    <Checkbox checked={isIn} />
                    <InitialsAvatar name={name} size={28} />
                    <span className="text-[0.8125rem] text-ink-800 flex-1 min-w-0 truncate">{name}</span>
                    {isIn && owner === name && <OwnerBadge />}
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </Modal>

      <ConfirmationModal
        open={confirmDelete}
        title="Delete team?"
        description={<>This will delete <span className="font-semibold">{team.name}</span> and unassign its members. This action cannot be undone.</>}
        confirmLabel="Delete Team"
        tone="destructive"
        onConfirm={remove}
        onClose={() => setConfirmDelete(false)}
      />

      <ConfirmationModal
        open={!!pendingOwner}
        title="Transfer team ownership?"
        description={<><span className="font-semibold">{pendingOwner}</span> will become the owner of <span className="font-semibold">{team.name}</span>{owner ? <>, replacing <span className="font-semibold">{owner}</span></> : null}. The change takes effect when you save.</>}
        confirmLabel="Make owner"
        tone="primary"
        onConfirm={() => { if (pendingOwner) setOwner(pendingOwner); setPendingOwner(null); }}
        onClose={() => setPendingOwner(null)}
      />
    </>
  );
}

/* ════════════════════════════════════════════════════════════════════════
 * People section
 * ════════════════════════════════════════════════════════════════════════ */

type UserRow = AdminUser & { roleName: string } & Record<string, unknown>;

const USER_STATUSES: UserStatus[] = ['Active', 'Suspended', 'Locked', 'Inactive'];

function PeopleSection({ onManageRole, onInvite }: { onManageRole: (roleId: string) => void; onInvite: () => void }) {
  const prefersReduced = useReducedMotion();
  const { users, teams, updateUser, removeUser, updateTeam, inviteUser } = useAdminData();
  const { roles, currentUser } = useCurrentUser();
  const logEvent = useAuditLog();
  const { addToast } = useToast();
  const roleName = (roleId: string) => roles.find(r => r.id === roleId)?.name ?? '—';
  const tableData: UserRow[] = users.map(u => ({ ...u, roleName: roleName(u.roleId) }));

  // ── Lockout protection (C1/C2/C3) ── the org must keep ≥1 active System Admin,
  // and the signed-in user can't strip their own admin access.
  const activeAdminEmails = users.filter(u => u.roleId === 'role-admin' && u.status === 'Active').map(u => u.email);
  const isSelfEmail = (email: string) => !!currentUser && currentUser.email === email;
  const wouldStripLastAdmin = (emails: string[]) =>
    activeAdminEmails.length > 0 && activeAdminEmails.every(e => emails.includes(e));

  const [manageUser, setManageUser] = useState<AdminUser | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmBulkRemove, setConfirmBulkRemove] = useState(false);
  // Bulk suspend/lock of owners is gated by a confirm (with the owner picker).
  const [pendingBulkStatus, setPendingBulkStatus] = useState<UserStatus | null>(null);
  // Per-team chosen new owner for the bulk transfer picker (team.id → name; '' = Unassigned).
  const [bulkTransfer, setBulkTransfer] = useState<Record<string, string>>({});
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [roleFilter, setRoleFilter] = useState<string[]>([]);
  const [teamFilter, setTeamFilter] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  // Pending-invitation row actions (Resend / Revoke) are gated by a confirm.
  const [inviteAction, setInviteAction] = useState<{ kind: 'resend' | 'revoke'; user: UserRow } | null>(null);
  // Inline role/team changes are confirmed before applying — `run` executes the
  // staged change on confirm.
  const [pendingChange, setPendingChange] = useState<{ title: string; body: string; run: () => void } | null>(null);
  const requestChange = (title: string, body: string, run: () => void) => setPendingChange({ title, body, run });

  // Pending-invitation actions, shown only on Invited rows, each confirmed first.
  // Resend re-sends the email; Revoke removes the pending invite (Undo in the
  // toast restores it).
  const resendInvite = (u: UserRow) => {
    logEvent({ action: 'Update', description: `Resent invitation to "${u.name}"`, module: 'Admin', entity: 'User' });
    addToast({ message: `Invitation resent to ${u.email}`, type: 'success' });
  };
  const revokeInvite = (u: UserRow) => {
    removeUser(u.email);
    logEvent({ action: 'Delete', description: `Revoked invitation for "${u.name}"`, module: 'Admin', entity: 'User' });
    addToast({
      message: `Invitation to ${u.name} revoked`,
      type: 'success',
      action: {
        label: 'Undo',
        onClick: () => {
          inviteUser({ name: u.name, initials: u.initials, email: u.email, roleId: u.roleId, team: u.team, status: 'Invited', lastLogin: 'Never' });
          addToast({ message: 'Invitation restored', type: 'info' });
        },
      },
    });
  };

  // Inline single-field edit — writes through to the live model + audit trail,
  // so changing a role / team / status never needs the Manage panel. The change
  // applies instantly (no confirm dialog — that would break the quick-edit
  // pattern and breed confirmation fatigue); instead the success toast carries
  // an Undo, the right safety net for a reversible, access-affecting change.
  const applyChange = (u: UserRow, patch: Partial<AdminUser>, desc: string, toast: string) => {
    // Block an inline demote/suspend that would lock out self or the last admin.
    const demotes = patch.roleId !== undefined && patch.roleId !== 'role-admin' && u.roleId === 'role-admin';
    const restricts = patch.status !== undefined && patch.status !== 'Active' && u.status === 'Active';
    if (demotes || restricts) {
      if (isSelfEmail(u.email) && u.roleId === 'role-admin') { addToast({ message: "You can't remove your own administrator access", type: 'error' }); return; }
      if (wouldStripLastAdmin([u.email])) { addToast({ message: 'There must be at least one active administrator', type: 'error' }); return; }
    }
    const prev = Object.fromEntries(
      Object.keys(patch).map(k => [k, (u as Record<string, unknown>)[k]]),
    ) as Partial<AdminUser>;
    updateUser(u.email, patch);
    logEvent({ action: 'Update', description: desc, module: 'Admin', entity: 'User' });
    addToast({
      message: toast,
      type: 'success',
      action: {
        label: 'Undo',
        onClick: () => {
          updateUser(u.email, prev);
          logEvent({ action: 'Update', description: `Reverted change for "${u.name}"`, module: 'Admin', entity: 'User' });
          addToast({ message: 'Change reverted', type: 'info' });
        },
      },
    });
  };

  const toggleSelect = (email: string) => setSelected(prev => { const n = new Set(prev); if (n.has(email)) n.delete(email); else n.add(email); return n; });
  const clearSelection = () => setSelected(new Set());

  // KPI band — the same skeleton every tab opens on. Cards double as
  // click-to-filter chips (active card carries the 2px brand bottom border).
  const counts = {
    active: users.filter(u => u.status === 'Active').length,
    invited: users.filter(u => u.status === 'Invited').length,
    suspended: users.filter(u => u.status === 'Suspended').length,
  };
  // KPI band — pure metric cards (not filters). Status filtering lives in the
  // toolbar Status dropdown alongside Role/Team.
  const stats: Stat[] = [
    { key: 'total', label: 'Total Users', value: users.length, icon: Users },
    { key: 'active', label: 'Active', value: counts.active, icon: UserCheck },
    { key: 'invited', label: 'Invited', value: counts.invited, icon: Send },
    { key: 'suspended', label: 'Suspended', value: counts.suspended, icon: UserX },
  ];

  const q = search.trim().toLowerCase();
  const visibleUsers = tableData.filter(u => {
    if (statusFilter.length && !statusFilter.includes(u.status)) return false;
    if (roleFilter.length && !roleFilter.includes(u.roleName)) return false;
    if (teamFilter.length && !teamFilter.includes(u.team)) return false;
    if (q && ![u.name, u.email, u.roleName, u.team].some(v => String(v ?? '').toLowerCase().includes(q))) return false;
    return true;
  });

  const roleOptions = [...new Set(tableData.map(u => u.roleName))].sort();
  const teamOptions = [...new Set(tableData.map(u => u.team))].sort((a, b) => (a === '—' ? 1 : b === '—' ? -1 : a.localeCompare(b)));
  const statusOptions = [...new Set(tableData.map(u => String(u.status)))].sort();
  const hasFilter = roleFilter.length > 0 || teamFilter.length > 0 || statusFilter.length > 0 || q.length > 0;
  const clearFilters = () => { setRoleFilter([]); setTeamFilter([]); setStatusFilter([]); setSearch(''); };

  // Selection works over the currently-visible (filtered) rows.
  const visibleEmails = visibleUsers.map(u => u.email);
  // E1: when filters/search change, drop any selection they now hide, so a bulk
  // action can never act on rows the user can't see.
  useEffect(() => {
    const vis = new Set(visibleEmails);
    setSelected(prev => {
      let changed = false;
      const next = new Set<string>();
      prev.forEach(e => (vis.has(e) ? next.add(e) : (changed = true)));
      return changed ? next : prev;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, roleFilter, teamFilter, search]);
  const selectedCount = selected.size;
  // Teams whose owner is among the selected users — drives the bulk owner picker.
  const selectedNames = new Set(users.filter(u => selected.has(u.email)).map(u => u.name));
  const selectedOwnerTeams = teams.filter(t => t.owner && selectedNames.has(t.owner));
  // Bulk status changes never touch Invited rows (they have no status until they
  // accept), so the status path's owner-transfer is scoped to non-invited owners.
  const statusActionableNames = new Set(users.filter(u => selected.has(u.email) && u.status !== 'Invited').map(u => u.name));
  const statusOwnerTeams = teams.filter(t => t.owner && statusActionableNames.has(t.owner));
  const isAdminName = (n: string) => users.find(u => u.name === n)?.roleId === 'role-admin';
  // Candidate new owners for a team = members NOT in the bulk selection.
  const bulkCandidates = (t: AdminTeam) => t.members.filter(m => !selectedNames.has(m));
  const chosenBulkOwner = (t: AdminTeam) => {
    const cands = bulkCandidates(t);
    return bulkTransfer[t.id] ?? cands.find(isAdminName) ?? cands[0] ?? '';
  };
  const applyTransfersForTeams = (ownerTeams: AdminTeam[]) => {
    ownerTeams.forEach(t => {
      const next = chosenBulkOwner(t);
      updateTeam(t.id, { owner: next || undefined });
      logEvent({ action: 'Update', description: `Transferred ownership of "${t.name}" to ${next || 'Unassigned'}`, module: 'Admin', entity: 'Team' });
    });
  };
  const renderTransferPicker = (ownerTeams: AdminTeam[]) => ownerTeams.length === 0 ? null : (
    <div className="mt-3 rounded-lg border border-canvas-border bg-canvas p-2.5 space-y-2">
      <div className="text-[0.625rem] font-semibold text-ink-500 uppercase tracking-wide">Reassign ownership</div>
      {ownerTeams.map(t => {
        const cands = bulkCandidates(t);
        return (
          <div key={t.id} className="flex items-center gap-2">
            <span className="text-[0.75rem] text-ink-700 flex-1 min-w-0 truncate">{t.name}</span>
            <AdminSelect
              size="sm"
              align="end"
              className="shrink-0 w-[11rem]"
              ariaLabel={`Reassign ${t.name} to`}
              value={chosenBulkOwner(t)}
              onChange={v => setBulkTransfer(p => ({ ...p, [t.id]: v }))}
              options={cands.map(c => ({ value: c, label: c, hint: isAdminName(c) ? 'Admin' : undefined }))}
            />
          </div>
        );
      })}
    </div>
  );
  const allVisibleSelected = visibleEmails.length > 0 && visibleEmails.every(e => selected.has(e));
  const selectAllVisible = () => setSelected(new Set(visibleEmails));
  const teamNames = teams.map(t => t.name);

  const bulkAssignTeam = (t: string) => {
    selected.forEach(email => updateUser(email, { team: t }));
    logEvent({ action: 'Update', description: `${t === '—' ? 'Unassigned' : `Assigned to "${t}"`} ${selectedCount} user${selectedCount !== 1 ? 's' : ''}`, module: 'Admin', entity: 'User' });
    addToast({ message: `${selectedCount} user${selectedCount !== 1 ? 's' : ''} ${t === '—' ? 'unassigned' : `moved to ${t}`}`, type: 'success' });
    clearSelection();
  };
  const bulkSetStatus = (s: UserStatus) => {
    // Status doesn't apply to Invited users — they have none until they accept,
    // and the single-user Manage panel offers Resend/Revoke for them, not a
    // status toggle. Skip them here so bulk can't bypass invite acceptance.
    const emails = users.filter(u => selected.has(u.email) && u.status !== 'Invited').map(u => u.email);
    const skipped = selectedCount - emails.length;
    if (emails.length === 0) {
      addToast({ message: 'Status doesn’t apply to invited users — they have no status until they accept.', type: 'error' });
      return;
    }
    if (s !== 'Active') {
      if (emails.some(isSelfEmail)) { addToast({ message: "You can't change your own status here", type: 'error' }); return; }
      if (wouldStripLastAdmin(emails)) { addToast({ message: 'There must be at least one active administrator', type: 'error' }); return; }
    }
    emails.forEach(email => updateUser(email, { status: s }));
    logEvent({ action: 'Update', description: `Set status "${s}" for ${emails.length} user${emails.length !== 1 ? 's' : ''}`, module: 'Admin', entity: 'User' });
    addToast({ message: `${emails.length} user${emails.length !== 1 ? 's' : ''} set to ${s}${skipped > 0 ? ` · ${skipped} invited skipped` : ''}`, type: 'success' });
    clearSelection();
  };
  const bulkRemove = () => {
    const emails = [...selected];
    if (emails.some(isSelfEmail)) { addToast({ message: "You can't remove your own account", type: 'error' }); setConfirmBulkRemove(false); return; }
    if (wouldStripLastAdmin(emails)) { addToast({ message: 'There must be at least one active administrator', type: 'error' }); setConfirmBulkRemove(false); return; }
    // A team must always keep an owner: block a removal that would empty any team
    // (every member of it is in the selection).
    const orphaned = teams.filter(t => t.members.length > 0 && t.members.every(m => selectedNames.has(m)));
    if (orphaned.length > 0) {
      const names = orphaned.map(t => `"${t.name}"`).join(', ');
      addToast({ message: `Can't remove — this would leave ${orphaned.length === 1 ? 'team' : 'teams'} ${names} with no members. A team must keep an owner.`, type: 'error' });
      setConfirmBulkRemove(false); return;
    }
    const n = selectedCount;
    selected.forEach(email => removeUser(email));
    logEvent({ action: 'Delete', description: `Removed ${n} user${n !== 1 ? 's' : ''}`, module: 'Admin', entity: 'User' });
    addToast({ message: `${n} user${n !== 1 ? 's' : ''} removed`, type: 'success' });
    setConfirmBulkRemove(false);
    clearSelection();
  };

  const columns: Column<UserRow>[] = [
    {
      key: 'select', label: '', sortable: false, width: '40px',
      render: (item) => (
        <div onClick={e => e.stopPropagation()} className="flex items-center justify-center">
          <Checkbox checked={selected.has(item.email)} onChange={() => toggleSelect(item.email)} ariaLabel="Select row" />
        </div>
      ),
    },
    {
      key: 'name', label: 'Name', sortable: true,
      render: (item) => (
        <div className="flex items-center gap-2.5">
          <InitialsAvatar name={item.name} size={26} />
          <div className="min-w-0 leading-tight">
            <div className="text-[0.8125rem] font-semibold text-ink-900 tracking-[-0.01em] truncate">{item.name}</div>
            <div className="text-[0.6875rem] text-ink-400 mt-0.5 truncate">{item.email}</div>
          </div>
        </div>
      ),
    },
    {
      key: 'roleName', label: 'Role', sortable: true,
      render: (item) => (
        <InlineCellSelect
          current={item.roleId}
          options={roles.map(r => ({ value: r.id, label: r.name }))}
          onPick={(roleId) => { if (roleId === item.roleId) return; requestChange('Change role?', `Change ${item.name}'s role to "${roleName(roleId)}"? This changes what they can access.`, () => applyChange(item, { roleId }, `Changed ${item.name}'s role to "${roleName(roleId)}"`, 'Role updated')); }}
          trigger={(open) => (
            <span className={`inline-flex items-center gap-1.5 pl-2.5 pr-1.5 h-7 rounded-md border text-[0.8125rem] font-medium transition-colors ${open ? 'border-brand-400 bg-brand-50/50 text-brand-700' : 'border-canvas-border text-ink-700 hover:border-ink-300/70 hover:bg-canvas'}`}>
              {item.roleName}
              <ChevronDown size={12} className={`transition-transform ${open ? 'rotate-180 text-brand-600' : 'text-ink-400'}`} />
            </span>
          )}
        />
      ),
    },
    {
      key: 'team', label: 'Team', sortable: true,
      render: (item) => {
        const isUnassigned = item.team === '—';
        return (
          <InlineCellSelect
            current={item.team}
            options={teamNames.map(t => ({ value: t, label: t }))}
            onPick={(t) => { if (t === item.team) return; requestChange('Move team?', `Move ${item.name} to ${t}?`, () => applyChange(item, { team: t }, `Moved ${item.name} to ${t}`, `Moved to ${t}`)); }}
            footer={!isUnassigned ? (close) => (
              <>
                <div className="h-px bg-canvas-border my-1 mx-1.5" />
                <button
                  onClick={e => { e.stopPropagation(); close(); requestChange('Remove from team?', `Remove ${item.name} from their team? They'll be unassigned.`, () => applyChange(item, { team: '—' }, `Removed ${item.name} from team`, 'Removed from team')); }}
                  className="no-focus-ring flex w-full items-center gap-2 px-2.5 h-8 rounded-md text-[0.8125rem] font-medium text-risk-700 text-left hover:bg-risk-50 transition-colors cursor-pointer"
                >
                  <X size={14} className="shrink-0" /> Remove from team
                </button>
              </>
            ) : undefined}
            trigger={(open) => (
              <span className={`inline-flex items-center gap-1.5 pl-2.5 pr-1.5 h-7 rounded-md border text-[0.8125rem] font-medium transition-colors ${
                open ? 'border-brand-400 bg-brand-50/50 text-brand-700'
                : isUnassigned ? 'border-dashed border-canvas-border text-ink-400 hover:border-ink-300/70 hover:bg-canvas'
                : 'border-canvas-border text-ink-700 hover:border-ink-300/70 hover:bg-canvas'
              }`}>
                {isUnassigned ? 'Assign team' : item.team}
                <ChevronDown size={12} className={`transition-transform ${open ? 'rotate-180 text-brand-600' : 'text-ink-400'}`} />
              </span>
            )}
          />
        );
      },
    },
    {
      // Status is read-only here — a display badge, matching every other registry
      // on the platform. Status is changed deliberately in the Manage modal (one
      // user) or the bulk bar (many), never inline on the label.
      key: 'status', label: 'Status', sortable: true,
      render: (item) => <StatusBadge status={STATUS_MAP[item.status] || 'draft'} />,
    },
    { key: 'lastLogin', label: 'Last Login', sortable: true, render: (item) => <span className="text-[0.75rem] text-ink-500 tabular-nums">{item.lastLogin}</span> },
    {
      // Invited (pending) rows get invite-specific actions — Resend / Revoke —
      // instead of Manage; everyone else gets Manage.
      key: 'action', label: '', sortable: false, align: 'right', width: '184px',
      render: (item) => (
        <RowActions>
          {item.status === 'Invited' ? (
            <>
              <button className={BTN_ROW} onClick={e => { e.stopPropagation(); setInviteAction({ kind: 'resend', user: item }); }}><Send size={12} />Resend</button>
              <button
                onClick={e => { e.stopPropagation(); setInviteAction({ kind: 'revoke', user: item }); }}
                className="inline-flex items-center gap-1.5 px-2.5 h-7 rounded-md border border-canvas-border bg-canvas-elevated text-[0.75rem] font-medium text-risk-700 hover:bg-risk-50 hover:border-risk-200 transition-colors cursor-pointer"
              >
                <X size={12} />Revoke
              </button>
            </>
          ) : (
            <button className={BTN_ROW} onClick={e => { e.stopPropagation(); setManageUser(item); }}><Pencil size={12} />Manage</button>
          )}
        </RowActions>
      ),
    },
  ];

  return (
    <motion.div
      initial={prefersReduced ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      // On exit, drop out of flow (absolute) so the incoming table can occupy the
      // same spot — the two crossfade in place with no blank beat and no double-height.
      exit={prefersReduced ? undefined : { opacity: 0, position: 'absolute', top: 0, left: 0, right: 0 }}
      transition={{ duration: prefersReduced ? 0 : 0.2, ease: [0.4, 0, 0.2, 1] }}
    >
      {/* KPI band — pure metric cards (no onSelect → not clickable filters).
          Search + Status/Role/Team filters live inside the table card below. */}
      {users.length > 0 && <AdminKpiRow stats={stats} />}

      {/* Bulk action bar — floating brand-900 pill, shown only while a selection
          is active. Acts on every selected user at once. */}
      <AnimatePresence>
        {selectedCount > 0 && (
          <BulkBar count={selectedCount} total={visibleUsers.length} allSelected={allVisibleSelected} onSelectAll={selectAllVisible} onClear={clearSelection}>
            <InlineCellSelect
              current="" menuWidth="w-48" direction="up"
              options={teamNames.map(t => ({ value: t, label: t }))}
              onPick={(t) => bulkAssignTeam(t)}
              trigger={(open) => (
                <span className={`${BULK_ACTION} ${open ? 'bg-white/15' : ''}`}>
                  <Users size={14} /> Assign team <ChevronDown size={13} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
                </span>
              )}
            />
            <InlineCellSelect
              current="" menuWidth="w-44" direction="up"
              options={USER_STATUSES.map(s => ({ value: s, label: s, node: <StatusBadge status={STATUS_MAP[s]} /> }))}
              onPick={(s) => {
                const next = s as UserStatus;
                // Gate access-revoking states behind the transfer confirm when any
                // non-invited selected user owns a team; otherwise apply immediately.
                if ((next === 'Suspended' || next === 'Locked') && statusOwnerTeams.length > 0) setPendingBulkStatus(next);
                else bulkSetStatus(next);
              }}
              trigger={(open) => (
                <span className={`${BULK_ACTION} ${open ? 'bg-white/15' : ''}`}>
                  <Check size={14} /> Set status <ChevronDown size={13} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
                </span>
              )}
            />
            <button onClick={() => setConfirmBulkRemove(true)} className={BULK_ACTION_RISK}>
              <Trash2 size={14} /> Remove
            </button>
          </BulkBar>
        )}
      </AnimatePresence>

      <SmartTable
        columns={columns}
        data={visibleUsers}
        keyField="email"
        searchable={false}
        paginated
        pageSize={10}
        hideResultCount
        stickyHeader
        stickyHeaderTop="top-0"
        animateRows={false}
        noRowHover
        isRowSelected={(item) => selected.has(item.email)}
        onRowClick={(item) => setManageUser(item)}
        headerExtra={
          <div className="flex flex-wrap items-center gap-2 w-full">
            <MemberSearch value={search} onChange={setSearch} placeholder="Search by name or email..." className="w-full sm:w-[240px]" />
            <div className="ml-auto flex items-center gap-2">
              {hasFilter && (
                <button type="button" onClick={clearFilters} className="text-[0.8125rem] font-medium text-brand-700 hover:text-brand-600 transition-colors cursor-pointer">Clear all</button>
              )}
              <ColumnFilter
                variant="button"
                label="Status"
                options={statusOptions}
                value={statusFilter}
                onChange={setStatusFilter}
                align="end"
                renderOption={(opt) => (
                  <span className="flex items-center gap-2 min-w-0">
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${STATUS_PILL_TONE[opt as UserStatus]?.dot ?? 'bg-ink-300'}`} aria-hidden />
                    <span className="truncate">{opt}</span>
                  </span>
                )}
              />
              <ColumnFilter variant="button" label="Role" options={roleOptions} value={roleFilter} onChange={setRoleFilter} align="end" selectIndicator="checkbox" />
              <ColumnFilter variant="button" label="Team" options={teamOptions} value={teamFilter} onChange={setTeamFilter} align="end" selectIndicator="checkbox" />
            </div>
          </div>
        }
        emptyContent={
          <EmptyState
            icon={Users}
            size="compact"
            title={hasFilter ? 'No users match your filters' : 'No users yet'}
            body={hasFilter ? 'Try a different search, or clear the active filters.' : 'Invite a user to get started.'}
            action={hasFilter
              ? <button className={BTN_CTA_OUTLINE} onClick={clearFilters}>Clear filters</button>
              : <button className={BTN_CTA_PRIMARY} onClick={onInvite}><UserPlus size={14} />Invite User</button>}
          />
        }
      />

      <AnimatePresence>
        {manageUser && <UserManageModal key="user-manage" user={manageUser} onClose={() => setManageUser(null)} onManageRole={onManageRole} />}
      </AnimatePresence>

      <ConfirmationModal
        open={confirmBulkRemove}
        title={`Remove ${selectedCount} user${selectedCount !== 1 ? 's' : ''}?`}
        description={<>
          This will remove the {selectedCount} selected user{selectedCount !== 1 ? 's' : ''}. This action cannot be undone.
          {selectedOwnerTeams.length > 0 && (
            <>
              <span className="mt-2 block text-risk-700">⚠ {selectedOwnerTeams.length === 1 ? 'A selected user owns a team' : 'Selected users own teams'}. Choose who inherits {selectedOwnerTeams.length === 1 ? 'it' : 'each'}:</span>
              {renderTransferPicker(selectedOwnerTeams)}
            </>
          )}
        </>}
        confirmLabel="Remove Users"
        tone="destructive"
        onConfirm={() => { applyTransfersForTeams(selectedOwnerTeams); bulkRemove(); }}
        onClose={() => setConfirmBulkRemove(false)}
      />

      <ConfirmationModal
        open={!!inviteAction}
        title={inviteAction?.kind === 'revoke'
          ? `Revoke invitation for ${inviteAction.user.name}?`
          : `Resend invitation to ${inviteAction?.user.name ?? ''}?`}
        description={inviteAction?.kind === 'revoke'
          ? <>This removes the pending invitation for <span className="font-semibold">{inviteAction.user.name}</span> ({inviteAction.user.email}). They’ll need a new invite to join.</>
          : <>This re-sends the invitation email to <span className="font-semibold">{inviteAction?.user.email}</span>.</>}
        confirmLabel={inviteAction?.kind === 'revoke' ? 'Revoke Invitation' : 'Resend Invitation'}
        tone={inviteAction?.kind === 'revoke' ? 'destructive' : 'primary'}
        onConfirm={() => {
          if (inviteAction?.kind === 'revoke') revokeInvite(inviteAction.user);
          else if (inviteAction) resendInvite(inviteAction.user);
          setInviteAction(null);
        }}
        onClose={() => setInviteAction(null)}
      />

      <ConfirmationModal
        open={!!pendingChange}
        tone="primary"
        title={pendingChange?.title ?? ''}
        description={pendingChange?.body}
        confirmLabel="Apply"
        cancelLabel="Cancel"
        onConfirm={() => { pendingChange?.run(); setPendingChange(null); }}
        onClose={() => setPendingChange(null)}
      />

      <ConfirmationModal
        open={pendingBulkStatus !== null}
        title={`${pendingBulkStatus === 'Locked' ? 'Lock' : 'Suspend'} ${statusActionableNames.size} user${statusActionableNames.size !== 1 ? 's' : ''}?`}
        description={<>
          {statusOwnerTeams.length === 1 ? 'A selected user owns a team' : 'Selected users own teams'}. {pendingBulkStatus === 'Locked' ? 'Locking' : 'Suspending'} them hands it off — choose who inherits {statusOwnerTeams.length === 1 ? 'it' : 'each'}:
          {renderTransferPicker(statusOwnerTeams)}
        </>}
        confirmLabel={pendingBulkStatus === 'Locked' ? 'Lock & Transfer' : 'Suspend & Transfer'}
        tone="destructive"
        onConfirm={() => { applyTransfersForTeams(statusOwnerTeams); if (pendingBulkStatus) bulkSetStatus(pendingBulkStatus); setPendingBulkStatus(null); }}
        onClose={() => setPendingBulkStatus(null)}
      />

    </motion.div>
  );
}

/* ════════════════════════════════════════════════════════════════════════
 * Teams section
 * ════════════════════════════════════════════════════════════════════════ */

type TeamRow = { id: string; name: string; count: number; members: string[]; team: AdminTeam } & Record<string, unknown>;

/* ── Inline rename — click the pencil to edit a name in place (Enter / blur
      commits, Esc cancels). The low-click parallel to People's inline edits. ── */
function InlineRename({ value, onCommit }: { value: string; onCommit: (next: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);
  const cancelRef = useRef(false);

  useEffect(() => {
    if (editing) requestAnimationFrame(() => inputRef.current?.select());
  }, [editing]);

  const startEditing = () => { setDraft(value); setEditing(true); };

  const commit = () => {
    if (cancelRef.current) { cancelRef.current = false; setEditing(false); return; }
    const v = draft.trim();
    if (v && v !== value) onCommit(v);
    setEditing(false);
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onClick={e => e.stopPropagation()}
        onKeyDown={e => {
          if (e.key === 'Enter') { e.preventDefault(); commit(); }
          else if (e.key === 'Escape') { cancelRef.current = true; inputRef.current?.blur(); }
        }}
        onBlur={commit}
        className="no-focus-ring w-full max-w-[15rem] px-2 h-7 -ml-2 rounded-md border border-brand-600 bg-canvas-elevated text-[0.8125rem] font-semibold text-ink-800 outline-none"
      />
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 group/rename min-w-0">
      <span className="truncate text-[0.8125rem] font-semibold text-ink-800">{value}</span>
      <button
        onClick={e => { e.stopPropagation(); startEditing(); }}
        className="no-focus-ring opacity-0 group-hover/rename:opacity-100 text-ink-400 hover:text-brand-700 transition-opacity cursor-pointer shrink-0"
        aria-label="Rename team"
      >
        <Pencil size={12} />
      </button>
    </span>
  );
}

function TeamsSection({ onCreateTeam }: { onCreateTeam: () => void }) {
  const prefersReduced = useReducedMotion();
  const { teams, users, updateTeam, removeTeam } = useAdminData();
  const logEvent = useAuditLog();
  const { addToast } = useToast();
  const [editTeam, setEditTeam] = useState<AdminTeam | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmBulkRemove, setConfirmBulkRemove] = useState(false);
  const [search, setSearch] = useState('');
  const [ownerFilter, setOwnerFilter] = useState<string[]>([]);

  const renameTeam = (t: AdminTeam, name: string) => {
    const trimmed = name.trim();
    if (!trimmed || trimmed === t.name) return;
    // Reject a rename that collides with another team (A5).
    if (teams.some(o => o.id !== t.id && o.name.trim().toLowerCase() === trimmed.toLowerCase())) {
      addToast({ message: 'A team with this name already exists', type: 'error' }); return;
    }
    updateTeam(t.id, { name: trimmed });
    logEvent({ action: 'Update', description: `Renamed team "${t.name}" to "${trimmed}"`, module: 'Admin', entity: 'Team' });
    addToast({ message: 'Team renamed', type: 'success' });
  };

  const toggleSelect = (id: string) => setSelected(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const clearSelection = () => setSelected(new Set());
  const selectedCount = selected.size;
  const bulkRemove = () => {
    const n = selectedCount;
    selected.forEach(id => removeTeam(id));
    logEvent({ action: 'Delete', description: `Deleted ${n} team${n !== 1 ? 's' : ''}`, module: 'Admin', entity: 'Team' });
    addToast({ message: `${n} team${n !== 1 ? 's' : ''} deleted`, type: 'success' });
    setConfirmBulkRemove(false);
    clearSelection();
  };

  // Owner filter options — every distinct owner plus an "Unassigned" bucket for
  // ownerless teams, sorted with Unassigned last.
  const OWNER_UNASSIGNED = 'Unassigned';
  const ownerOptions = [...new Set(teams.map(t => t.owner ?? OWNER_UNASSIGNED))]
    .sort((a, b) => (a === OWNER_UNASSIGNED ? 1 : b === OWNER_UNASSIGNED ? -1 : a.localeCompare(b)));

  const tq = search.trim().toLowerCase();
  const hasFilter = tq.length > 0 || ownerFilter.length > 0;
  const clearFilters = () => { setSearch(''); setOwnerFilter([]); };

  // KPI band — pure metric cards, matching the People tab skeleton. Lead with the
  // actionable gap (people on no team) over vanity size stats.
  const inTeamNames = new Set(teams.flatMap(t => t.members));
  const totalMemberships = teams.reduce((s, t) => s + t.members.length, 0);
  const noTeamCount = users.filter(u => !inTeamNames.has(u.name)).length;
  const teamStats: Stat[] = [
    { key: 'total', label: 'Total Teams', value: teams.length, icon: Users },
    { key: 'in', label: 'In Teams', value: inTeamNames.size, icon: UserCheck },
    { key: 'noteam', label: 'No Team', value: noTeamCount, icon: UserMinus, tone: noTeamCount > 0 ? 'attention' : undefined },
    { key: 'avg', label: 'Avg Size', value: teams.length ? (totalMemberships / teams.length).toFixed(1) : '0', icon: Gauge },
  ];
  const teamTableData: TeamRow[] = teams
    .filter(t => !tq || t.name.toLowerCase().includes(tq) || t.members.some(m => m.toLowerCase().includes(tq)))
    .filter(t => !ownerFilter.length || ownerFilter.includes(t.owner ?? OWNER_UNASSIGNED))
    .map(t => ({ id: t.id, name: t.name, count: t.members.length, members: t.members, team: t }));

  // Selection is scoped to the currently-visible (filtered) rows — matching the
  // People tab — so a bulk action can never touch a team the search/owner filter
  // has hidden. Select-all selects only what's on screen, and when the filters
  // change we drop any now-hidden ids from the selection.
  const visibleTeamIds = teamTableData.map(t => t.id);
  const allSelected = visibleTeamIds.length > 0 && visibleTeamIds.every(id => selected.has(id));
  const selectAll = () => setSelected(new Set(visibleTeamIds));
  useEffect(() => {
    const vis = new Set(visibleTeamIds);
    setSelected(prev => {
      let changed = false;
      const next = new Set<string>();
      prev.forEach(id => (vis.has(id) ? next.add(id) : (changed = true)));
      return changed ? next : prev;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, ownerFilter]);

  const columns: Column<TeamRow>[] = [
    {
      key: 'select', label: '', sortable: false, width: '40px',
      render: (t) => (
        <div onClick={e => e.stopPropagation()} className="flex items-center justify-center">
          <Checkbox checked={selected.has(t.id)} onChange={() => toggleSelect(t.id)} ariaLabel="Select team" />
        </div>
      ),
    },
    {
      key: 'name', label: 'Team', sortable: true,
      render: (t) => (
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-lg bg-brand-50 flex items-center justify-center shrink-0">
            <Users size={15} className="text-brand-700" />
          </div>
          <InlineRename value={t.name} onCommit={(name) => renameTeam(t.team, name)} />
        </div>
      ),
    },
    {
      key: 'owner', label: 'Owner', sortable: false, width: '26%',
      render: (t) => t.team.owner ? (
        <div className="flex items-center gap-2 min-w-0">
          <InitialsAvatar name={t.team.owner} size={26} />
          <span className="text-[0.8125rem] text-ink-800 truncate">{t.team.owner}</span>
        </div>
      ) : <span className="text-[0.75rem] text-ink-400">Unassigned</span>,
    },
    {
      key: 'count', label: 'Members', sortable: true, width: '12%',
      render: (t) => <span className={`text-[0.8125rem] tabular-nums ${t.count === 0 ? 'text-ink-400' : 'font-medium text-ink-800'}`}>{t.count}</span>,
    },
    {
      key: 'avatars', label: '', sortable: false,
      render: (t) => (
        t.members.length === 0
          ? <span className="text-[0.75rem] text-ink-400">No members yet</span>
          : (
            <div className="flex items-center -space-x-2">
              {t.members.slice(0, 5).map((m, i) => (
                <div
                  key={i}
                  title={m}
                  className="relative rounded-full ring-2 ring-canvas-elevated transition-transform duration-150 hover:z-10 hover:-translate-y-0.5"
                >
                  <InitialsAvatar name={m} size={26} />
                </div>
              ))}
              {t.members.length > 5 && (
                <div className="relative w-[26px] h-[26px] rounded-full flex items-center justify-center text-[0.625rem] font-semibold text-ink-500 bg-canvas ring-2 ring-canvas-elevated tabular-nums">
                  +{t.members.length - 5}
                </div>
              )}
            </div>
          )
      ),
    },
    {
      key: 'action', label: '', sortable: false, align: 'right', width: '120px',
      render: (t) => (
        <RowActions>
          <button className={BTN_ROW} onClick={(e) => { e.stopPropagation(); setEditTeam(t.team); }}><Pencil size={12} />Manage</button>
        </RowActions>
      ),
    },
  ];

  return (
    <motion.div
      initial={prefersReduced ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      // On exit, drop out of flow (absolute) so the incoming table can occupy the
      // same spot — the two crossfade in place with no blank beat and no double-height.
      exit={prefersReduced ? undefined : { opacity: 0, position: 'absolute', top: 0, left: 0, right: 0 }}
      transition={{ duration: prefersReduced ? 0 : 0.2, ease: [0.4, 0, 0.2, 1] }}
    >
      {/* KPI band — pure metric cards (no onSelect → not clickable filters).
          Search + Owner filter live inside the table card below. */}
      {teams.length > 0 && <AdminKpiRow stats={teamStats} />}

      <AnimatePresence>
        {selectedCount > 0 && (
          <BulkBar count={selectedCount} total={visibleTeamIds.length} allSelected={allSelected} onSelectAll={selectAll} onClear={clearSelection}>
            <button onClick={() => setConfirmBulkRemove(true)} className={BULK_ACTION_RISK}>
              <Trash2 size={14} /> Delete
            </button>
          </BulkBar>
        )}
      </AnimatePresence>

      <SmartTable
        columns={columns}
        data={teamTableData}
        keyField="id"
        searchable={false}
        paginated
        pageSize={10}
        hideResultCount
        stickyHeader
        stickyHeaderTop="top-0"
        animateRows={false}
        noRowHover
        isRowSelected={(t) => selected.has(t.id)}
        onRowClick={(t) => setEditTeam(t.team)}
        headerExtra={
          <div className="flex flex-wrap items-center gap-2 w-full">
            <MemberSearch value={search} onChange={setSearch} placeholder="Search teams or members..." className="w-full sm:w-[260px]" />
            <div className="ml-auto flex items-center gap-2">
              {hasFilter && (
                <button type="button" onClick={clearFilters} className="text-[0.8125rem] font-medium text-brand-700 hover:text-brand-600 transition-colors cursor-pointer">Clear all</button>
              )}
              <ColumnFilter
                variant="button" label="Owner" options={ownerOptions} value={ownerFilter} onChange={setOwnerFilter} align="end"
                selectIndicator="checkbox" searchable
                renderOption={(name) => name === OWNER_UNASSIGNED
                  ? <span className="text-ink-400">Unassigned</span>
                  : <span className="truncate">{name}</span>}
              />
            </div>
          </div>
        }
        emptyContent={
          <EmptyState
            icon={Users}
            size="compact"
            title={hasFilter ? 'No teams match your filters' : 'No teams yet'}
            body={hasFilter ? 'Try a different search, or clear the active filters.' : 'Create a team to group members for shared access.'}
            action={hasFilter
              ? <button className={BTN_CTA_OUTLINE} onClick={clearFilters}>Clear filters</button>
              : <button className={BTN_CTA_PRIMARY} onClick={onCreateTeam}><Plus size={14} />Create Team</button>}
          />
        }
      />

      <AnimatePresence>
        {editTeam && <EditTeamModal key="team-edit" team={editTeam} onClose={() => setEditTeam(null)} />}
      </AnimatePresence>

      <ConfirmationModal
        open={confirmBulkRemove}
        title={`Delete ${selectedCount} team${selectedCount !== 1 ? 's' : ''}?`}
        description={<>This will delete the {selectedCount} selected team{selectedCount !== 1 ? 's' : ''} and unassign their members. This action cannot be undone.</>}
        confirmLabel="Delete Teams"
        tone="destructive"
        onConfirm={bulkRemove}
        onClose={() => setConfirmBulkRemove(false)}
      />
    </motion.div>
  );
}

/* ════════════════════════════════════════════════════════════════════════
 * Audit Log section
 * ════════════════════════════════════════════════════════════════════════ */

const AUDIT_TODAY = new Date(new Date().toISOString().slice(0, 10));

const logColumns: Column<AuditLog & Record<string, unknown>>[] = [
  {
    key: 'timestamp', label: 'Timestamp', sortable: true, width: '15%',
    render: (item) => {
      const [date, time] = (item.timestamp as string).split(' ');
      return (
        <div className="font-mono tabular-nums leading-tight">
          <div className="text-[0.75rem] text-ink-700">{date}</div>
          <div className="text-[0.6875rem] text-ink-400 mt-1">{time}</div>
        </div>
      );
    },
  },
  {
    key: 'user', label: 'Performed By', sortable: true, width: '17%',
    render: (item) => {
      const name = item.user as string;
      const unknown = name === 'Unknown';
      return (
        <div className="flex items-center gap-2.5 min-w-0">
          <InitialsAvatar name={unknown ? 'U' : name} size={26} />
          <span className={`text-[0.8125rem] truncate ${unknown ? 'italic text-ink-400' : 'font-semibold text-ink-900'}`}>{name}</span>
        </div>
      );
    },
  },
  { key: 'action', label: 'Action', sortable: true, width: '9%', render: (item) => <ActionBadge action={item.action as string} /> },
  {
    key: 'description', label: 'Activity', sortable: false,
    render: (item) => (
      <div className="min-w-0">
        <div className="text-[0.8125rem] font-medium text-ink-900 leading-snug truncate">{item.description as string}</div>
        <div className="text-[0.6875rem] text-ink-400 mt-1 font-medium uppercase tracking-[0.04em] truncate">
          {item.module as string} · {item.entity as string}
        </div>
      </div>
    ),
  },
  { key: 'status', label: 'Result', sortable: true, width: '10%', align: 'right', render: (item) => <ResultBadge result={item.status as string} /> },
];

function AuditLogSection() {
  const prefersReduced = useReducedMotion();
  const { logs } = useAdminData();
  const { can } = useCurrentUser();
  const { addToast } = useToast();
  const logEvent = useAuditLog();
  const tableData = logs.map(l => ({ ...l } as AuditLog & Record<string, unknown>));
  const [searchQuery, setSearchQuery] = useState('');
  const [actionFilter, setActionFilter] = useState<string[]>([]);
  const [resultFilter, setResultFilter] = useState<string[]>([]);
  const [userFilter, setUserFilter] = useState<string[]>([]);
  const [dateFilter, setDateFilter] = useState<DateFilter>(DEFAULT_DATE_FILTER);
  const [dateOpen, setDateOpen] = useState(false);

  const uniqueUsers = [...new Set(logs.map(l => l.user))];
  const hasAnyFilter = searchQuery.length > 0 || actionFilter.length > 0 || resultFilter.length > 0 || userFilter.length > 0 || isDateFilterActive(dateFilter);

  const clearAll = () => {
    setSearchQuery(''); setActionFilter([]); setResultFilter([]); setUserFilter([]); setDateFilter(DEFAULT_DATE_FILTER);
  };

  const filtered = tableData.filter(l => {
    if (actionFilter.length && !actionFilter.includes(l.action as string)) return false;
    if (resultFilter.length && !resultFilter.includes(l.status as string)) return false;
    if (userFilter.length && !userFilter.includes(l.user as string)) return false;
    if (!dateInFilter(l.timestamp as string, dateFilter, AUDIT_TODAY)) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const hit = ['user', 'description', 'module', 'entity'].some(k => String(l[k] ?? '').toLowerCase().includes(q));
      if (!hit) return false;
    }
    return true;
  });

  // Export the rows the user is actually looking at — the active filters apply,
  // so a filtered view exports exactly what's on screen (N5).
  const exportCsv = () => {
    const headers = ['Timestamp', 'Performed By', 'Action', 'Activity', 'Module', 'Entity', 'Result'];
    // Quote-escape, and neutralise CSV/formula injection: a leading =,+,-,@ (or
    // tab/CR) makes spreadsheets execute the cell, so prefix those with a quote.
    const esc = (v: unknown) => {
      let s = String(v);
      if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
      return `"${s.replace(/"/g, '""')}"`;
    };
    const rows = filtered.map(l => [l.timestamp, l.user, l.action, l.description, l.module, l.entity, l.status].map(esc).join(','));
    const csv = [headers.map(esc).join(','), ...rows].join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    const scope = hasAnyFilter ? 'filtered' : 'all';
    logEvent({ action: 'Export', description: `Exported audit log as CSV (${filtered.length} ${scope} events)`, module: 'Admin', entity: 'Audit Log' });
    addToast({ message: `Exported ${filtered.length} ${hasAnyFilter ? 'filtered ' : ''}audit event${filtered.length !== 1 ? 's' : ''} as CSV`, type: 'success' });
  };

  return (
    <motion.div
      initial={prefersReduced ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: prefersReduced ? 0 : 0.2, ease: [0.2, 0, 0, 1] }}
    >
      {/* Search + filters now live inside the table card (SmartTable headerExtra). */}
      <SmartTable
        columns={logColumns}
        data={filtered}
        keyField="id"
        searchable={false}
        paginated
        pageSize={10}
        hideResultCount
        stickyHeader
        stickyHeaderTop="top-0"
        animateRows={false}
        noRowHover
        headerExtra={
          <div className="flex flex-wrap items-center gap-2 w-full">
            <MemberSearch value={searchQuery} onChange={setSearchQuery} placeholder="Search logs..." className="w-full sm:w-[240px]" />
            <div className="ml-auto flex items-center gap-2">
              {hasAnyFilter && (
                <button type="button" onClick={clearAll} className="text-[0.8125rem] font-medium text-brand-700 hover:text-brand-600 transition-colors cursor-pointer">Clear all</button>
              )}
              <ColumnFilter
                variant="button" label="User" options={uniqueUsers} value={userFilter} onChange={setUserFilter} align="end"
                selectIndicator="checkbox"
              />
              <ColumnFilter
                variant="button" label="Action" options={['Create', 'Update', 'Delete', 'Login', 'Export']} value={actionFilter} onChange={setActionFilter} align="end"
                renderOption={(opt) => (
                  <span className="flex items-center gap-2 min-w-0">
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${ACTION_DOT[opt] ?? 'bg-ink-300'}`} aria-hidden />
                    <span className="truncate">{opt}</span>
                  </span>
                )}
              />
              <ColumnFilter
                variant="button" label="Result" options={['Success', 'Failed']} value={resultFilter} onChange={setResultFilter} align="end"
                renderOption={(opt) => (
                  <span className="flex items-center gap-2 min-w-0">
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${RESULT_DOT[opt] ?? 'bg-ink-300'}`} aria-hidden />
                    <span className="truncate">{opt}</span>
                  </span>
                )}
              />
              <DateFilterPicker
                filter={dateFilter}
                open={dateOpen}
                onToggle={() => setDateOpen(o => !o)}
                onClose={() => setDateOpen(false)}
                onApply={(next) => { setDateFilter(next); setDateOpen(false); }}
                today={AUDIT_TODAY}
                triggerHeight="h-8"
              />
              {can('ad_logs_export') && (
                <>
                  <span className="w-px h-5 bg-canvas-border" />
                  <button
                    onClick={exportCsv}
                    disabled={filtered.length === 0}
                    title={filtered.length === 0 ? 'Nothing to export' : hasAnyFilter ? `Export ${filtered.length} filtered events` : 'Export all events'}
                    className="group inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-canvas-border bg-canvas-elevated text-ink-700 text-[12px] font-medium hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700 active:scale-[0.97] transition-[background-color,border-color,color,transform] duration-150 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-canvas-elevated disabled:hover:border-canvas-border disabled:hover:text-ink-700"
                  >
                    <Download size={13} className="transition-transform duration-200 group-hover:translate-y-0.5 group-active:translate-y-1" />
                    Export CSV
                  </button>
                </>
              )}
            </div>
          </div>
        }
        emptyContent={
          <EmptyState
            icon={ScrollText}
            size="compact"
            title={hasAnyFilter ? 'No audit logs match your filters' : 'No audit activity yet'}
            body={hasAnyFilter ? 'Try a different search, or clear the active filters.' : 'Activity across the platform will appear here.'}
            action={hasAnyFilter ? <button className={BTN_CTA_OUTLINE} onClick={clearAll}>Clear filters</button> : undefined}
          />
        }
      />
    </motion.div>
  );
}

/* ════════════════════════════════════════════════════════════════════════
 * Members switch — People · Teams view toggle
 * ════════════════════════════════════════════════════════════════════════ */

/* A single segmented control (white active pill on a light track, icon + label
   + count) that toggles the Members tab between the People and Teams screens.
   The screens themselves are unchanged; this only picks which one renders. */
function MembersSwitch({ view, onSelect, counts }: { view: MembersView; onSelect: (v: MembersView) => void; counts: { people: number; teams: number } }) {
  const tabs: { id: MembersView; label: string; icon: typeof User; count: number }[] = [
    { id: 'people', label: 'People', icon: User, count: counts.people },
    { id: 'teams', label: 'Teams', icon: Users, count: counts.teams },
  ];
  return (
    <div className="inline-flex items-center gap-1 p-1 rounded-lg border border-canvas-border bg-canvas">
      {tabs.map(t => {
        const on = view === t.id;
        const Icon = t.icon;
        return (
          <button
            key={t.id}
            onClick={() => onSelect(t.id)}
            aria-pressed={on}
            className={`inline-flex items-center gap-2 px-3.5 h-8 rounded-md text-[0.8125rem] font-medium transition-colors cursor-pointer ${
              on ? 'bg-canvas-elevated text-brand-700 shadow-[0_1px_2px_rgb(15_8_30_/_0.08)] border border-canvas-border' : 'text-ink-500 hover:text-ink-800'
            }`}
          >
            <Icon size={14} className={on ? 'text-brand-600' : 'text-ink-400'} />
            {t.label}
            <span className={`tabular-nums text-[0.75rem] font-semibold ${on ? 'text-brand-600' : 'text-ink-400'}`}>{t.count}</span>
          </button>
        );
      })}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════
 * Page shell
 * ════════════════════════════════════════════════════════════════════════ */

export default function AdminView({ activeTab }: Props) {
  // Map sidebar view ids onto the flat three-tab shell. People & Teams both land
  // on the Members tab; a 'teams' deep-link opens Members on the Teams view.
  const initialSection: SectionId = activeTab === 'logs' ? 'logs' : activeTab === 'roles' ? 'roles' : 'members';
  const initialMembersView: MembersView = activeTab === 'teams' ? 'teams' : 'people';

  const { users, teams } = useAdminData();
  const prefersReduced = useReducedMotion();

  const [section, setSection] = useState<SectionId>(initialSection);
  const [membersView, setMembersView] = useState<MembersView>(initialMembersView);
  // When a user's Manage panel jumps to the role editor, focus that role. The
  // nonce forces RolesWorkspace to remount so it re-selects, even for the same id.
  const [roleFocusId, setRoleFocusId] = useState<string | undefined>(undefined);
  const [roleFocusNonce, setRoleFocusNonce] = useState(0);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [createTeamOpen, setCreateTeamOpen] = useState(false);
  const [createRoleOpen, setCreateRoleOpen] = useState(false);
  const [createRoleSeed, setCreateRoleSeed] = useState<RoleSeed | null>(null);

  const openCreateRole = (seed?: RoleSeed) => { setCreateRoleSeed(seed ?? null); setCreateRoleOpen(true); };

  // Jump from a user's Manage panel to that role's permission editor. The nonce
  // forces RolesWorkspace to remount so it re-selects, even for the same id.
  const goManageRole = (roleId: string) => {
    setRoleFocusId(roleId);
    setRoleFocusNonce(n => n + 1);
    setSection('roles');
  };

  const sections: SectionDef[] = [
    { id: 'members', label: 'Members', icon: Users },
    { id: 'roles', label: 'Roles & Permissions', icon: Shield },
    { id: 'logs', label: 'Audit Log', icon: ScrollText },
  ];

  // Audit-log CSV export now lives inside AuditLogSection (it owns the filter
  // state, so it exports exactly the filtered view — see N5).

  return (
    <div className="h-full flex flex-col overflow-hidden bg-canvas">
      {/* Header strip — matches Knowledge Hub: a single full-bleed
          bg-canvas-elevated panel (extends past the page insets via negative
          margins) with ambient FloatingLines texture behind a serif display
          title, and the section tabs sitting on the strip's bottom hairline. */}
      <div className="px-6 lg:px-12 xl:px-[124px] pt-8 shrink-0">
        <div className="bg-canvas-elevated -mx-6 lg:-mx-12 xl:-mx-[124px] px-6 lg:px-12 xl:px-[124px] -mt-8 pt-8 border-b border-canvas-border relative overflow-hidden">
          {/* Ambient FloatingLines — top + bottom waves only, low opacity, so
              the lines read as brand texture behind the type, never a competing
              element. Content sits in normal flow above the absolute canvas. */}
          <FloatingLines
            enabledWaves={['top', 'bottom']}
            lineCount={3}
            lineDistance={10}
            bendRadius={5}
            bendStrength={-0.3}
            interactive
            parallax
            color="#6a12cd"
            opacity={0.05}
          />
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="mb-6"
          >
            <h1 className="font-display text-[2.125rem] font-[420] tracking-tight text-ink-900 leading-[1.15]">Administration</h1>
            <p className="mt-2 text-[0.9375rem] text-ink-500 leading-relaxed max-w-2xl">Control who has access, what they can do, and what they've done.</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
            className="-mb-px"
          >
            <SectionTabs sections={sections} current={section} onSelect={setSection} />
          </motion.div>
        </div>
      </div>

      {/* Content — header strip is fixed above; this region scrolls (except the
          Roles two-pane, which manages its own internal scroll). The top inset
          lives on the inner content, not this scroll container, so a pinned
          toolbar's sticky `top-0` reaches the true top and rows can't leak
          through the padding above it. */}
      <div className={`px-6 lg:px-12 xl:px-[124px] pb-8 flex-1 min-h-0 ${section === 'roles' ? 'overflow-hidden' : 'overflow-y-auto'}`}>
        <AnimatePresence mode="wait" initial={false}>
        {section === 'members' ? (
          <motion.div
            key="members"
            className="pt-4"
            initial={prefersReduced ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={prefersReduced ? undefined : { opacity: 0 }}
            transition={{ duration: prefersReduced ? 0 : 0.18, ease: [0.4, 0, 0.2, 1] }}
          >
            <div className="mb-4 flex items-center justify-between gap-3 flex-wrap">
              <MembersSwitch view={membersView} onSelect={setMembersView} counts={{ people: users.length, teams: teams.length }} />
              {membersView === 'people'
                ? <button className={BTN_CTA_PRIMARY} onClick={() => setInviteOpen(true)}><UserPlus size={14} />Invite User</button>
                : <button className={BTN_CTA_PRIMARY} onClick={() => setCreateTeamOpen(true)}><Plus size={14} />Create Team</button>}
            </div>
            {/* True overlapping crossfade: default (sync) mode mounts the incoming
                table while the outgoing one is still present, and each section's
                `exit` sets `position:absolute` so the outgoing table dissolves on top
                without pushing layout (no double-height) and without a blank beat.
                The incoming table (in flow) defines the height. Row stagger is off
                (animateRows={false}) so each reads as one calm block, not cascading
                rows — that cascade + the blank gap were the eye-catching parts. */}
            <div className="relative">
              <AnimatePresence initial={false}>
                {membersView === 'people'
                  ? <PeopleSection key="people" onManageRole={goManageRole} onInvite={() => setInviteOpen(true)} />
                  : <TeamsSection key="teams" onCreateTeam={() => setCreateTeamOpen(true)} />}
              </AnimatePresence>
            </div>
          </motion.div>
        ) : section === 'roles' ? (
          // No KPI band here: Total/System/Custom/Assigned were vanity counts
          // (derivable from, or duplicated by, the role list + People tab). The
          // role list is self-evident, so the two-pane workspace fills the tab.
          <motion.div
            key="roles"
            className="pt-4 h-full min-h-0"
            initial={prefersReduced ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={prefersReduced ? undefined : { opacity: 0 }}
            transition={{ duration: prefersReduced ? 0 : 0.18, ease: [0.4, 0, 0.2, 1] }}
          >
            <RolesWorkspace key={`roles-${roleFocusNonce}`} initialRoleId={roleFocusId} onCreateRole={openCreateRole} />
          </motion.div>
        ) : (
          <motion.div
            key="logs"
            className="pt-4"
            initial={prefersReduced ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={prefersReduced ? undefined : { opacity: 0 }}
            transition={{ duration: prefersReduced ? 0 : 0.18, ease: [0.4, 0, 0.2, 1] }}
          >
            <AuditLogSection key="logs" />
          </motion.div>
        )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {inviteOpen && <InviteUserModal key="invite" onClose={() => setInviteOpen(false)} />}
        {createTeamOpen && <CreateTeamModal key="createteam" onClose={() => setCreateTeamOpen(false)} />}
        {createRoleOpen && <CreateRoleModal key="createrole" seed={createRoleSeed} onClose={() => { setCreateRoleOpen(false); setCreateRoleSeed(null); }} />}
      </AnimatePresence>
    </div>
  );
}
