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
  ChevronDown, Pencil, Trash2, X, Check, Crown, Send,
} from 'lucide-react';
import { PERMISSION_GROUPS } from '../../data/rbac';
import { useCurrentUser } from '../../context/CurrentUserContext';
import { useAdminData, useAuditLog, type AuditLog, type AdminTeam, type AdminUser, type UserStatus } from '../../context/AdminDataContext';
import SmartTable, { type Column } from '../shared/SmartTable';
import ColumnFilter from '../shared/ColumnFilter';
import FloatingLines from '../shared/FloatingLines';
import { StatusBadge, ActionBadge, ResultBadge } from '../shared/StatusBadge';
import Modal from '../shared/Modal';
import Toggle from '../shared/Toggle';
import Checkbox from '../shared/Checkbox';
import ConfirmationModal from '../shared/ConfirmationModal';
import EmptyState from '../shared/EmptyState';
import { useToast } from '../shared/Toast';
import { RolesWorkspace, CreateRoleModal, type RoleSeed } from './RolesWorkspace';
import {
  FIELD_LABEL, FIELD_INPUT, FIELD_SELECT, BTN_CANCEL, BTN_PRIMARY,
  BTN_CTA_PRIMARY, BTN_CTA_OUTLINE, BTN_ROW, type Stat,
} from './adminTokens';
import { InitialsAvatar, MemberSearch, RowActions } from './AdminPrimitives';

interface Props {
  activeTab?: string;
}

/** Four equal, flat tabs — every one shares the same skeleton: KPI band →
 *  toolbar (search left · filters/CTA right) → content. */
type SectionId = 'people' | 'teams' | 'roles' | 'logs';

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

/* Status-filter chip dots — a semantic colour per status so the People filter
   bar reads as a colour-coded status board (All = neutral). */
const CHIP_DOT: Record<string, string> = {
  total: 'bg-ink-300', active: 'bg-compliant', invited: 'bg-brand-500', suspended: 'bg-high',
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
                className={`no-focus-ring flex w-full items-center justify-between gap-2 px-2.5 h-8 rounded-lg text-[0.8125rem] text-left cursor-pointer transition-colors ${sel ? 'bg-brand-50 text-brand-700 font-semibold' : 'text-ink-700 hover:bg-canvas'}`}
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
      <button onClick={onClear} aria-label="Clear selection" className="mx-1 inline-flex items-center justify-center w-8 h-8 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors cursor-pointer">
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
  const { updateUser, removeUser, updateTeam, teams, users } = useAdminData();
  const { roles } = useCurrentUser();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmSuspend, setConfirmSuspend] = useState(false);
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [roleId, setRoleId] = useState(user.roleId);
  const [team, setTeam] = useState(user.team);
  const [status, setStatus] = useState<UserStatus>(user.status);
  // Per-team chosen new owner for the transfer picker (team.id \u2192 member name; '' = Unassigned).
  const [transfer, setTransfer] = useState<Record<string, string>>({});

  const teamOptions = [...new Set([...teams.map(t => t.name), user.team, '\u2014'])];
  // Teams this person currently owns \u2014 drives the transfer-ownership warnings.
  const ownedTeams = teams.filter(t => t.owner === user.name);
  const isAdminName = (n: string) => users.find(u => u.name === n)?.roleId === 'role-admin';
  // Default new owner per team: a System Admin member (excl. this user), else Unassigned.
  const defaultNewOwner = (t: AdminTeam) => t.members.filter(m => m !== user.name).find(isAdminName) ?? '';
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
            <div className="relative shrink-0">
              <select
                value={chosenOwner(t)}
                onChange={e => setTransfer(p => ({ ...p, [t.id]: e.target.value }))}
                className="no-focus-ring appearance-none h-8 pl-2.5 pr-7 rounded-md border border-canvas-border bg-canvas-elevated text-[0.75rem] text-ink-800 outline-none focus:border-brand-600 cursor-pointer max-w-[11rem] truncate"
              >
                <option value="">Unassigned</option>
                {cands.map(c => <option key={c} value={c}>{c}{isAdminName(c) ? ' \u00b7 Admin' : ''}</option>)}
              </select>
              <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none" />
            </div>
          </div>
        );
      })}
    </div>
  );

  const doSave = () => {
    updateUser(user.email, { name, email, roleId, team, status });
    logEvent({ action: 'Update', description: `Updated user "${name}" (status: ${status})`, module: 'Admin', entity: 'User' });
    onClose();
    addToast({ message: 'User updated', type: 'success' });
  };
  const save = () => {
    // Suspending/locking a team owner hands their ownership off \u2014 confirm first.
    const restricting = (status === 'Suspended' || status === 'Locked') && user.status !== status;
    if (restricting && ownedTeams.length > 0) { setConfirmSuspend(true); return; }
    doSave();
  };
  const remove = () => {
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
            <button onClick={() => setConfirmDelete(true)} className="mr-auto inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-[0.8125rem] font-medium text-risk-700 hover:bg-risk-50 transition-colors cursor-pointer">
              <Trash2 size={14} /> Remove User
            </button>
            <button className={BTN_CANCEL} onClick={onClose}>Cancel</button>
            <button className={BTN_PRIMARY} onClick={save}>Save Changes</button>
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
                <div className="relative">
                  <select value={roleId} onChange={e => setRoleId(e.target.value)} className={FIELD_SELECT}>
                    {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                  <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none" />
                </div>
              </div>
              <div>
                <label className={FIELD_LABEL}>Team</label>
                <div className="relative">
                  <select value={team} onChange={e => setTeam(e.target.value)} className={FIELD_SELECT}>
                    {teamOptions.map(t => <option key={t}>{t}</option>)}
                  </select>
                  <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none" />
                </div>
              </div>
            </div>
            <div className="mt-4">
              <label className={FIELD_LABEL}>Status</label>
              <div className="flex items-center gap-2 flex-wrap">
                {(['Active', 'Suspended', 'Locked', 'Inactive'] as UserStatus[]).map(s => {
                  const sel = status === s;
                  const tone = STATUS_PILL_TONE[s];
                  return (
                    <button
                      key={s}
                      onClick={() => setStatus(s)}
                      aria-pressed={sel}
                      className={`inline-flex items-center gap-1.5 px-3 h-8 rounded-lg border text-[0.75rem] font-medium transition-colors cursor-pointer ${
                        sel ? `${tone.on} border-transparent` : 'border-canvas-border text-ink-600 hover:bg-canvas'
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${sel ? tone.dot : 'bg-ink-300'}`} />
                      {s}
                    </button>
                  );
                })}
              </div>
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

                {/* Granted permissions — active ones only, grouped, scrollable so
                    the modal stays bounded. Shows the user exactly what the role
                    allows without opening the role editor. */}
                {enabledCount === 0 ? (
                  <p className="mt-3 text-[0.75rem] text-ink-400">No permissions granted by this role.</p>
                ) : (
                  <div className="mt-3 rounded-xl border border-canvas-border max-h-[200px] overflow-y-auto divide-y divide-canvas-border">
                    {PERMISSION_GROUPS.map(group => {
                      const on = group.perms.filter(p => enabled.has(p.key));
                      if (on.length === 0) return null;
                      return (
                        <div key={group.group} className="px-3.5 py-2.5">
                          <div className="flex items-center justify-between gap-2 mb-1.5">
                            <span className="text-[0.6875rem] font-semibold text-ink-500 uppercase tracking-wide">{group.group}</span>
                            <span className="text-[0.625rem] text-ink-400 tabular-nums shrink-0">{on.length}/{group.perms.length}</span>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {on.map(p => (
                              <span key={p.key} className="inline-flex items-center gap-1 px-2 h-6 rounded-md bg-brand-50 text-brand-700 text-[0.6875rem] font-medium">
                                <Check size={11} className="shrink-0" />{p.name}
                              </span>
                            ))}
                          </div>
                        </div>
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
        onConfirm={() => { applyTransfers(); remove(); }}
        onClose={() => setConfirmDelete(false)}
      />

      <ConfirmationModal
        open={confirmSuspend}
        title={`${status === 'Locked' ? 'Lock' : 'Suspend'} a team owner?`}
        description={<>
          <span className="font-semibold">{user.name}</span> owns {ownedTeams.length === 1 ? 'a team' : 'teams'}. {status === 'Locked' ? 'Locking' : 'Suspending'} them hands it off — choose who inherits {ownedTeams.length === 1 ? 'it' : 'each'}:
          {transferPicker}
        </>}
        confirmLabel={status === 'Locked' ? 'Lock & transfer' : 'Suspend & transfer'}
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
  const { inviteUser, defaultRoleId, teams } = useAdminData();
  const { roles } = useCurrentUser();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [team, setTeam] = useState('');
  const [selectedRoleId, setSelectedRoleId] = useState(() => roles.find(r => r.id === defaultRoleId)?.id ?? roles[0]?.id ?? '');
  const [previewRole, setPreviewRole] = useState<string | null>(null);

  const invite = () => {
    if (!fullName.trim() || !email.trim()) { addToast({ message: 'Name and email are required', type: 'error' }); return; }
    const initials = fullName.trim().split(/\s+/).map(p => p[0]).join('').slice(0, 2).toUpperCase();
    const roleLabel = roles.find(r => r.id === selectedRoleId)?.name ?? selectedRoleId;
    inviteUser({ name: fullName.trim(), initials, email: email.trim(), roleId: selectedRoleId, team: team || '—', status: 'Invited', lastLogin: 'Never' });
    logEvent({ action: 'Create', description: `Invited user "${fullName.trim()}" with role "${roleLabel}"`, module: 'Admin', entity: 'User' });
    onClose();
    addToast({ message: 'Invitation sent', type: 'success' });
  };

  return (
    <Modal
      title="Invite User"
      subtitle="Add a new member and assign their initial role."
      width="max-w-[600px]"
      onClose={onClose}
      footer={
        <>
          <button className={BTN_CANCEL} onClick={onClose}>Cancel</button>
          <button className={BTN_PRIMARY} onClick={invite}>Send Invite</button>
        </>
      }
    >
      <div className="space-y-6">
        {/* Profile */}
        <section>
          <h3 className="text-[0.6875rem] font-semibold text-ink-500 uppercase tracking-[0.14em] mb-3">Profile</h3>
          <div className="space-y-4">
            <div>
              <label className={FIELD_LABEL}>Full Name <span className="text-risk-700">*</span></label>
              <input value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Enter full name" className={FIELD_INPUT} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={FIELD_LABEL}>Email <span className="text-risk-700">*</span></label>
                <input value={email} onChange={e => setEmail(e.target.value)} placeholder="Enter email address" className={FIELD_INPUT} />
              </div>
              <div>
                <label className={FIELD_LABEL}>Team</label>
                <div className="relative">
                  <select className={FIELD_SELECT} value={team} onChange={e => setTeam(e.target.value)}>
                    <option value="">Unassigned</option>
                    {teams.map(t => <option key={t.id}>{t.name}</option>)}
                  </select>
                  <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none" />
                </div>
              </div>
            </div>
          </div>
        </section>

        <section>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[0.6875rem] font-semibold text-ink-500 uppercase tracking-[0.14em]">Initial Role</h3>
            <span className="text-[0.6875rem] text-ink-400">One role per user</span>
          </div>

          <div className="space-y-2.5">
            {roles.map(role => {
              const isSelected = selectedRoleId === role.id;
              const isPreview = previewRole === role.name;
              const isDefault = role.id === defaultRoleId;
              const enabled = new Set(role.permissions);
              return (
                <div
                  key={role.id}
                  onClick={() => setSelectedRoleId(role.id)}
                  className={`rounded-lg border cursor-pointer transition-colors ${isSelected ? 'border-brand-600 bg-brand-50/40' : 'border-canvas-border hover:bg-canvas'}`}
                >
                  <div className="flex items-center gap-3 px-4 py-3">
                    <span className={`w-[18px] h-[18px] rounded-full border-2 flex items-center justify-center shrink-0 ${isSelected ? 'border-brand-600' : 'border-canvas-border'}`}>
                      {isSelected && <span className="w-2 h-2 rounded-full bg-brand-600" />}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-[0.8125rem] font-semibold text-ink-800 flex items-center gap-2">
                        {role.name}
                        {isDefault && <span className="px-1.5 py-0.5 rounded-full bg-brand-50 text-brand-700 text-[0.625rem] font-semibold">Default</span>}
                      </div>
                      <div className="text-[0.75rem] text-ink-500">{role.description ?? `${role.type} role`}</div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-[0.75rem] text-ink-500 tabular-nums">{role.permissions.length} permissions</span>
                      <button
                        onClick={e => { e.stopPropagation(); setPreviewRole(isPreview ? null : role.name); }}
                        className="text-[0.75rem] font-medium text-ink-600 hover:text-brand-700 cursor-pointer"
                      >
                        {isPreview ? 'Hide' : 'Details'}
                      </button>
                    </div>
                  </div>
                  {isPreview && (
                    <div className="px-4 pb-3 border-t border-canvas-border mt-1 pt-2 max-h-[220px] overflow-y-auto">
                      {PERMISSION_GROUPS.map((group, gi) => (
                        <div key={group.group}>
                          <div className={`py-2 ${gi > 0 ? 'border-t border-canvas-border mt-1' : ''}`}>
                            <span className="text-[0.8125rem] font-semibold text-ink-800">{group.group}</span>
                          </div>
                          {group.perms.map(p => (
                            <div key={p.key} className="flex items-center justify-between py-2 pl-3 border-t border-canvas-border/60">
                              <div>
                                <div className="text-[0.75rem] font-medium text-ink-800">{p.name}</div>
                                <div className="text-[0.75rem] text-ink-500">{p.desc}</div>
                              </div>
                              <Toggle checked={enabled.has(p.key)} disabled />
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </Modal>
  );
}

/* ── Create team ── */
function CreateTeamModal({ onClose }: { onClose: () => void }) {
  const { addToast } = useToast();
  const logEvent = useAuditLog();
  const { addTeam, users } = useAdminData();
  const { currentUser } = useCurrentUser();
  const creatorName = currentUser?.name ?? '';
  const [teamName, setTeamName] = useState('');
  const [memberSearch, setMemberSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  // Owner defaults to the creator; pick a member via "Make owner" to reassign
  // (tracked by email). Null means "still the creator".
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

  // Effective owner: the chosen member if any, else the creator.
  const ownerName = users.find(m => m.email === ownerEmail)?.name ?? creatorName;

  const create = () => {
    if (!teamName.trim()) { addToast({ message: 'Team name is required', type: 'error' }); return; }
    const members = users.filter(m => selected.has(m.email)).map(m => m.name);
    const finalOwner = ownerName || members[0];
    addTeam(teamName.trim(), members, finalOwner);
    logEvent({ action: 'Create', description: `Created team "${teamName.trim()}" with ${members.length} member${members.length !== 1 ? 's' : ''}${finalOwner ? `, owner ${finalOwner}` : ''}`, module: 'Admin', entity: 'Team' });
    onClose();
    addToast({ message: 'Team created', type: 'success' });
  };

  return (
    <Modal
      title="Create Team"
      subtitle="Group members for shared access and assignments."
      onClose={onClose}
      footer={
        <>
          <span className="mr-auto text-[0.75rem] text-ink-500 tabular-nums">{selected.size} member{selected.size !== 1 ? 's' : ''} selected</span>
          <button className={BTN_CANCEL} onClick={onClose}>Cancel</button>
          <button className={BTN_PRIMARY} onClick={create}>Create Team</button>
        </>
      }
    >
      <div className="space-y-6">
        <section>
          <h3 className="text-[0.6875rem] font-semibold text-ink-500 uppercase tracking-[0.14em] mb-3">Details</h3>
          <label className={FIELD_LABEL}>Team Name <span className="text-risk-700">*</span></label>
          <input value={teamName} onChange={e => setTeamName(e.target.value)} placeholder="Enter a unique team name" className={FIELD_INPUT} />
        </section>

        <section>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-[0.6875rem] font-semibold text-ink-500 uppercase tracking-[0.14em]">Add Members</h3>
            {selected.size > 0 && (
              <span className="text-[0.6875rem] text-ink-400 tabular-nums">{selected.size} selected</span>
            )}
          </div>
          {/* Owner defaults to you (the creator) until you make a member owner. */}
          {ownerName && (
            <p className="mb-3 flex items-center gap-1.5 text-[0.75rem] text-ink-500">
              <Crown size={12} className="text-brand-600 shrink-0" />
              Owner: <span className="font-medium text-ink-700">{ownerName}{!ownerEmail && ' (you)'}</span>
            </p>
          )}

          <MemberSearch value={memberSearch} onChange={setMemberSearch} placeholder="Search by name or email" />

          <div className="mt-3 border border-canvas-border rounded-lg overflow-hidden max-h-[300px] overflow-y-auto">
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
                  {isChecked && (ownerEmail === m.email
                    ? <OwnerBadge />
                    : <button onClick={e => { e.stopPropagation(); setOwnerEmail(m.email); }} className="text-[0.6875rem] font-medium text-ink-400 hover:text-brand-700 transition-colors cursor-pointer shrink-0">Make owner</button>
                  )}
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
  const { users, updateTeam, removeTeam } = useAdminData();
  const [teamName, setTeamName] = useState(team.name);
  const [memberSearch, setMemberSearch] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [members, setMembers] = useState<Set<string>>(new Set(team.members));
  const [owner, setOwner] = useState<string>(team.owner ?? '');

  const filtered = users.map(u => u.name).filter(name => !memberSearch || name.toLowerCase().includes(memberSearch.toLowerCase()));

  // Strict reassignment: when the owner is removed, ownership transfers ONLY to a
  // System Admin member — never auto-promote a non-admin. (Manual "Make owner"
  // below stays a deliberate admin choice and can still pick any member.)
  const firstAdminMember = (names: Iterable<string>) =>
    [...names].find(n => users.find(u => u.name === n)?.roleId === 'role-admin');

  const toggle = (name: string) => setMembers(prev => {
    const n = new Set(prev);
    if (n.has(name)) { n.delete(name); if (owner === name) setOwner(firstAdminMember(n) ?? ''); }
    else n.add(name);
    return n;
  });

  const save = () => {
    const finalOwner = members.has(owner) ? owner : (firstAdminMember(members) ?? undefined);
    updateTeam(team.id, { name: teamName.trim() || team.name, members: [...members], owner: finalOwner });
    logEvent({ action: 'Update', description: `Updated team "${teamName.trim() || team.name}" (${members.size} members${finalOwner ? `, owner ${finalOwner}` : ''})`, module: 'Admin', entity: 'Team' });
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
            <button onClick={() => setConfirmDelete(true)} className="mr-auto inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-[0.8125rem] font-medium text-risk-700 hover:bg-risk-50 transition-colors cursor-pointer">
              <Trash2 size={14} /> Delete Team
            </button>
            <button className={BTN_CANCEL} onClick={onClose}>Cancel</button>
            <button className={BTN_PRIMARY} onClick={save}>Save Changes</button>
          </>
        }
      >
        <div className="space-y-6">
          {/* Details */}
          <section>
            <h3 className="text-[0.6875rem] font-semibold text-ink-500 uppercase tracking-[0.14em] mb-3">Details</h3>
            <label className={FIELD_LABEL}>Team Name</label>
            <input value={teamName} onChange={e => setTeamName(e.target.value)} className={FIELD_INPUT} />
          </section>

          {/* Members */}
          <section>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-[0.6875rem] font-semibold text-ink-500 uppercase tracking-[0.14em]">Members</h3>
              <span className="text-[0.6875rem] text-ink-400 tabular-nums">{members.size} selected</span>
            </div>
            {/* Current owner (or Unassigned). Removing the owner transfers it to a
                System Admin member, else leaves it Unassigned. */}
            <p className="mb-3 flex items-center gap-1.5 text-[0.75rem]">
              <Crown size={12} className={`shrink-0 ${owner ? 'text-brand-600' : 'text-ink-300'}`} />
              <span className="text-ink-500">Owner:</span>
              {owner
                ? <span className="font-medium text-ink-700">{owner}</span>
                : <span className="text-ink-400">Unassigned</span>}
            </p>

            <MemberSearch value={memberSearch} onChange={setMemberSearch} placeholder="Search members to add or remove" />

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
                    {isIn && (owner === name
                      ? <OwnerBadge />
                      : <button onClick={e => { e.stopPropagation(); setOwner(name); }} className="text-[0.6875rem] font-medium text-ink-400 hover:text-brand-700 transition-colors cursor-pointer shrink-0">Make owner</button>
                    )}
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
        description={<>This will delete <span className="font-semibold">{team.name}</span> and unassign its members.</>}
        confirmLabel="Delete Team"
        tone="destructive"
        onConfirm={remove}
        onClose={() => setConfirmDelete(false)}
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
  const { roles } = useCurrentUser();
  const logEvent = useAuditLog();
  const { addToast } = useToast();
  const roleName = (roleId: string) => roles.find(r => r.id === roleId)?.name ?? '—';
  const tableData: UserRow[] = users.map(u => ({ ...u, roleName: roleName(u.roleId) }));

  const [manageUser, setManageUser] = useState<AdminUser | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmBulkRemove, setConfirmBulkRemove] = useState(false);
  // Bulk suspend/lock of owners is gated by a confirm (with the owner picker).
  const [pendingBulkStatus, setPendingBulkStatus] = useState<UserStatus | null>(null);
  // Per-team chosen new owner for the bulk transfer picker (team.id → name; '' = Unassigned).
  const [bulkTransfer, setBulkTransfer] = useState<Record<string, string>>({});
  const [statusFilter, setStatusFilter] = useState<UserStatus | null>(null);
  const [roleFilter, setRoleFilter] = useState<string[]>([]);
  const [teamFilter, setTeamFilter] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  // Pending-invitation row actions (Resend / Revoke) are gated by a confirm.
  const [inviteAction, setInviteAction] = useState<{ kind: 'resend' | 'revoke'; user: UserRow } | null>(null);

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
  // Status filter chips — counts only (no icons; the chips render label + count).
  const stats: Stat[] = [
    { key: 'total', label: 'Total Users', value: users.length },
    { key: 'active', label: 'Active', value: counts.active },
    { key: 'invited', label: 'Invited', value: counts.invited },
    { key: 'suspended', label: 'Suspended', value: counts.suspended },
  ];
  const STATUS_BY_KEY: Record<string, UserStatus | null> = { total: null, active: 'Active', invited: 'Invited', suspended: 'Suspended' };

  const q = search.trim().toLowerCase();
  const visibleUsers = tableData.filter(u => {
    if (statusFilter && u.status !== statusFilter) return false;
    if (roleFilter.length && !roleFilter.includes(u.roleName)) return false;
    if (teamFilter.length && !teamFilter.includes(u.team)) return false;
    if (q && ![u.name, u.email, u.roleName, u.team].some(v => String(v ?? '').toLowerCase().includes(q))) return false;
    return true;
  });

  const roleOptions = [...new Set(tableData.map(u => u.roleName))].sort();
  const teamOptions = [...new Set(tableData.map(u => u.team))].sort((a, b) => (a === '—' ? 1 : b === '—' ? -1 : a.localeCompare(b)));
  const hasFilter = roleFilter.length > 0 || teamFilter.length > 0 || !!statusFilter || q.length > 0;
  const clearFilters = () => { setRoleFilter([]); setTeamFilter([]); setStatusFilter(null); setSearch(''); };

  // Selection works over the currently-visible (filtered) rows.
  const visibleEmails = visibleUsers.map(u => u.email);
  const selectedCount = selected.size;
  // Teams whose owner is among the selected users — drives the bulk owner picker.
  const selectedNames = new Set(users.filter(u => selected.has(u.email)).map(u => u.name));
  const selectedOwnerTeams = teams.filter(t => t.owner && selectedNames.has(t.owner));
  const isAdminName = (n: string) => users.find(u => u.name === n)?.roleId === 'role-admin';
  // Candidate new owners for a team = members NOT in the bulk selection.
  const bulkCandidates = (t: AdminTeam) => t.members.filter(m => !selectedNames.has(m));
  const chosenBulkOwner = (t: AdminTeam) => bulkTransfer[t.id] ?? (bulkCandidates(t).find(isAdminName) ?? '');
  const applyBulkTransfers = () => {
    selectedOwnerTeams.forEach(t => {
      const next = chosenBulkOwner(t);
      updateTeam(t.id, { owner: next || undefined });
      logEvent({ action: 'Update', description: `Transferred ownership of "${t.name}" to ${next || 'Unassigned'}`, module: 'Admin', entity: 'Team' });
    });
  };
  const bulkTransferPicker = selectedOwnerTeams.length === 0 ? null : (
    <div className="mt-3 rounded-lg border border-canvas-border bg-canvas p-2.5 space-y-2">
      <div className="text-[0.625rem] font-semibold text-ink-500 uppercase tracking-wide">Reassign ownership</div>
      {selectedOwnerTeams.map(t => {
        const cands = bulkCandidates(t);
        return (
          <div key={t.id} className="flex items-center gap-2">
            <span className="text-[0.75rem] text-ink-700 flex-1 min-w-0 truncate">{t.name}</span>
            <div className="relative shrink-0">
              <select
                value={chosenBulkOwner(t)}
                onChange={e => setBulkTransfer(p => ({ ...p, [t.id]: e.target.value }))}
                className="no-focus-ring appearance-none h-8 pl-2.5 pr-7 rounded-md border border-canvas-border bg-canvas-elevated text-[0.75rem] text-ink-800 outline-none focus:border-brand-600 cursor-pointer max-w-[11rem] truncate"
              >
                <option value="">Unassigned</option>
                {cands.map(c => <option key={c} value={c}>{c}{isAdminName(c) ? ' · Admin' : ''}</option>)}
              </select>
              <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none" />
            </div>
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
    selected.forEach(email => updateUser(email, { status: s }));
    logEvent({ action: 'Update', description: `Set status "${s}" for ${selectedCount} user${selectedCount !== 1 ? 's' : ''}`, module: 'Admin', entity: 'User' });
    addToast({ message: `${selectedCount} user${selectedCount !== 1 ? 's' : ''} set to ${s}`, type: 'success' });
    clearSelection();
  };
  const bulkRemove = () => {
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
        <div className="flex items-center gap-3">
          <InitialsAvatar name={item.name} size={36} />
          <div className="min-w-0 leading-tight">
            <div className="text-[0.875rem] font-semibold text-ink-900 truncate">{item.name}</div>
            <div className="text-[0.75rem] text-ink-400 mt-0.5 truncate">{item.email}</div>
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
          onPick={(roleId) => applyChange(item, { roleId }, `Changed ${item.name}'s role to "${roleName(roleId)}"`, 'Role updated')}
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
            onPick={(t) => applyChange(item, { team: t }, `Moved ${item.name} to ${t}`, `Moved to ${t}`)}
            footer={!isUnassigned ? (close) => (
              <>
                <div className="h-px bg-canvas-border my-1 mx-1.5" />
                <button
                  onClick={e => { e.stopPropagation(); applyChange(item, { team: '—' }, `Removed ${item.name} from team`, 'Removed from team'); close(); }}
                  className="no-focus-ring flex w-full items-center gap-2 px-2.5 h-8 rounded-lg text-[0.8125rem] text-risk-700 hover:bg-risk-50 cursor-pointer transition-colors"
                >
                  <X size={13} className="shrink-0" /> Remove from team
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
      transition={{ duration: prefersReduced ? 0 : 0.2, ease: [0.2, 0, 0, 1] }}
    >
      {/* Toolbar — search + status filter chips (left) · filters + primary action
          (right). The chips are counts that double as a one-click status filter
          (All / Active / Invited / Suspended); sitting beside search keeps People
          on a single control row, matching the other tabs. Pinned so it stays
          reachable while the table scrolls under it. */}
      <div className="mb-4 sticky top-0 z-20 bg-canvas pt-1 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <MemberSearch value={search} onChange={setSearch} placeholder="Search by name or email..." className="w-full sm:w-[260px]" />
          {users.length > 0 && stats.map(s => {
            const on = STATUS_BY_KEY[s.key] === statusFilter;
            return (
              <button
                key={s.key}
                onClick={() => setStatusFilter(STATUS_BY_KEY[s.key] ?? null)}
                aria-pressed={on}
                className={`group/chip inline-flex items-center gap-2 pl-2.5 pr-1.5 h-8 rounded-lg border text-[0.8125rem] font-medium transition-all cursor-pointer ${
                  on
                    ? 'border-brand-300 bg-brand-50 text-brand-700 ring-1 ring-brand-200/60'
                    : 'border-canvas-border bg-canvas-elevated text-ink-700 hover:bg-canvas hover:border-ink-300/70'
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${CHIP_DOT[s.key] ?? 'bg-ink-300'}`} aria-hidden="true" />
                {s.key === 'total' ? 'All' : s.label}
                <span className={`min-w-[1.25rem] px-1.5 h-[1.375rem] inline-flex items-center justify-center rounded-md text-[0.75rem] font-semibold tabular-nums transition-colors ${
                  on ? 'bg-brand-100 text-brand-700' : 'bg-canvas text-ink-500 group-hover/chip:bg-canvas-elevated'
                }`}>{s.value}</span>
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
          {hasFilter && (
            <button type="button" onClick={clearFilters} className="mr-0.5 text-[0.8125rem] font-medium text-brand-700 hover:text-brand-600 transition-colors cursor-pointer">Clear all</button>
          )}
          <ColumnFilter variant="button" label="Role" options={roleOptions} value={roleFilter} onChange={setRoleFilter} align="end" />
          <ColumnFilter variant="button" label="Team" options={teamOptions} value={teamFilter} onChange={setTeamFilter} align="end" />
          <span className="hidden sm:block w-px h-5 bg-canvas-border" />
          <button className={BTN_CTA_PRIMARY} onClick={onInvite}><UserPlus size={14} />Invite User</button>
        </div>
      </div>

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
                <span className={BULK_ACTION}>
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
                // selected user owns a team; otherwise apply immediately.
                if ((next === 'Suspended' || next === 'Locked') && selectedOwnerTeams.length > 0) setPendingBulkStatus(next);
                else bulkSetStatus(next);
              }}
              trigger={(open) => (
                <span className={BULK_ACTION}>
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
        stickyHeader
        stickyHeaderTop="top-11"
        noRowHover
        isRowSelected={(item) => selected.has(item.email)}
        onRowClick={(item) => setManageUser(item)}
        emptyContent={
          <EmptyState
            icon={Users}
            size="compact"
            title={hasFilter ? 'No users match your filters' : 'No users yet'}
            body={hasFilter ? 'Try a different search, or clear the active filters.' : 'Invite a member to get started.'}
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
              {bulkTransferPicker}
            </>
          )}
        </>}
        confirmLabel="Remove"
        tone="destructive"
        onConfirm={() => { applyBulkTransfers(); bulkRemove(); }}
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
        open={pendingBulkStatus !== null}
        title={`${pendingBulkStatus === 'Locked' ? 'Lock' : 'Suspend'} ${selectedCount} user${selectedCount !== 1 ? 's' : ''}?`}
        description={<>
          {selectedOwnerTeams.length === 1 ? 'A selected user owns a team' : 'Selected users own teams'}. {pendingBulkStatus === 'Locked' ? 'Locking' : 'Suspending'} them hands it off — choose who inherits {selectedOwnerTeams.length === 1 ? 'it' : 'each'}:
          {bulkTransferPicker}
        </>}
        confirmLabel={pendingBulkStatus === 'Locked' ? 'Lock & transfer' : 'Suspend & transfer'}
        tone="destructive"
        onConfirm={() => { applyBulkTransfers(); if (pendingBulkStatus) bulkSetStatus(pendingBulkStatus); setPendingBulkStatus(null); }}
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
  const { teams, updateTeam, removeTeam } = useAdminData();
  const logEvent = useAuditLog();
  const { addToast } = useToast();
  const [editTeam, setEditTeam] = useState<AdminTeam | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmBulkRemove, setConfirmBulkRemove] = useState(false);
  const [search, setSearch] = useState('');

  const renameTeam = (t: AdminTeam, name: string) => {
    updateTeam(t.id, { name });
    logEvent({ action: 'Update', description: `Renamed team "${t.name}" to "${name}"`, module: 'Admin', entity: 'Team' });
    addToast({ message: 'Team renamed', type: 'success' });
  };

  const toggleSelect = (id: string) => setSelected(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const clearSelection = () => setSelected(new Set());
  const selectedCount = selected.size;
  const allSelected = teams.length > 0 && teams.every(t => selected.has(t.id));
  const selectAll = () => setSelected(new Set(teams.map(t => t.id)));
  const bulkRemove = () => {
    const n = selectedCount;
    selected.forEach(id => removeTeam(id));
    logEvent({ action: 'Delete', description: `Deleted ${n} team${n !== 1 ? 's' : ''}`, module: 'Admin', entity: 'Team' });
    addToast({ message: `${n} team${n !== 1 ? 's' : ''} deleted`, type: 'success' });
    setConfirmBulkRemove(false);
    clearSelection();
  };

  const tq = search.trim().toLowerCase();
  const teamTableData: TeamRow[] = teams
    .filter(t => !tq || t.name.toLowerCase().includes(tq) || t.members.some(m => m.toLowerCase().includes(tq)))
    .map(t => ({ id: t.id, name: t.name, count: t.members.length, members: t.members, team: t }));
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
          <OwnerBadge />
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
            <div className="flex items-center gap-1.5">
              {t.members.slice(0, 6).map((m, i) => <InitialsAvatar key={i} name={m} size={24} />)}
              {t.members.length > 6 && (
                <div className="w-6 h-6 rounded-full flex items-center justify-center text-[0.625rem] font-semibold text-ink-500 bg-canvas border border-canvas-border tabular-nums">+{t.members.length - 6}</div>
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
      initial={prefersReduced ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: prefersReduced ? 0 : 0.2, ease: [0.2, 0, 0, 1] }}
    >
      {/* No KPI band — Teams opens straight into its toolbar + table (same as
          Audit Log). KPIs are kept only on People, where they double as filters. */}
      {/* Toolbar — search left · Create Team right (same skeleton as People/Audit). */}
      <div className="mb-4 sticky top-0 z-20 bg-canvas pt-1 flex items-center justify-between gap-3 flex-wrap">
        <MemberSearch value={search} onChange={setSearch} placeholder="Search teams or members..." className="w-full sm:w-[300px]" />
        <button className={BTN_CTA_PRIMARY} onClick={onCreateTeam}><Plus size={14} />Create Team</button>
      </div>

      <AnimatePresence>
        {selectedCount > 0 && (
          <BulkBar count={selectedCount} total={teams.length} allSelected={allSelected} onSelectAll={selectAll} onClear={clearSelection}>
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
        stickyHeader
        stickyHeaderTop="top-11"
        noRowHover
        isRowSelected={(t) => selected.has(t.id)}
        onRowClick={(t) => setEditTeam(t.team)}
        emptyContent={
          <EmptyState
            icon={Users}
            size="compact"
            title={tq ? 'No teams match your search' : 'No teams yet'}
            body={tq ? 'Try a different search.' : 'Group members for shared access and assignments.'}
            action={tq
              ? <button className={BTN_CTA_OUTLINE} onClick={() => setSearch('')}>Clear search</button>
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
        description={<>This will delete the {selectedCount} selected team{selectedCount !== 1 ? 's' : ''} and unassign their members.</>}
        confirmLabel="Delete"
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
        <div className="flex items-center gap-3 min-w-0">
          <InitialsAvatar name={unknown ? 'U' : name} size={36} />
          <span className={`text-[0.875rem] truncate ${unknown ? 'italic text-ink-400' : 'font-semibold text-ink-900'}`}>{name}</span>
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

function AuditLogSection({ action }: { action?: React.ReactNode }) {
  const prefersReduced = useReducedMotion();
  const { logs } = useAdminData();
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

  return (
    <motion.div
      initial={prefersReduced ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: prefersReduced ? 0 : 0.2, ease: [0.2, 0, 0, 1] }}
    >
      {/* No KPI band: our audit log is a small, static, fully-visible table —
          Total/Today/Failed counts restate what the rows already show. Filter
          via the controls below; revisit a KPI band only if this becomes a
          live, high-volume stream. */}
      <div className="mb-4 sticky top-0 z-20 bg-canvas pt-1 flex items-center justify-between gap-3 flex-wrap">
        <MemberSearch value={searchQuery} onChange={setSearchQuery} placeholder="Search logs..." className="w-full sm:w-[300px]" />
        <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
          {hasAnyFilter && (
            <button type="button" onClick={clearAll} className="mr-0.5 text-[0.8125rem] font-medium text-brand-700 hover:text-brand-600 transition-colors cursor-pointer">Clear all</button>
          )}
          <ColumnFilter
            variant="button" label="User" options={uniqueUsers} value={userFilter} onChange={setUserFilter} align="end"
            renderOption={(name) => (<><InitialsAvatar name={name === 'Unknown' ? 'U' : name} size={20} /><span className="truncate">{name}</span></>)}
          />
          <ColumnFilter variant="button" label="Action" options={['Create', 'Update', 'Delete', 'Login', 'Export']} value={actionFilter} onChange={setActionFilter} align="end" />
          <ColumnFilter variant="button" label="Result" options={['Success', 'Failed']} value={resultFilter} onChange={setResultFilter} align="end" />
          <DateFilterPicker
            filter={dateFilter}
            open={dateOpen}
            onToggle={() => setDateOpen(o => !o)}
            onClose={() => setDateOpen(false)}
            onApply={(next) => { setDateFilter(next); setDateOpen(false); }}
            today={AUDIT_TODAY}
            triggerHeight="h-8"
          />
          {action && (
            <>
              <span className="hidden lg:block w-px h-5 bg-canvas-border" />
              {action}
            </>
          )}
        </div>
      </div>

      <SmartTable
        columns={logColumns}
        data={filtered}
        keyField="timestamp"
        searchable={false}
        paginated
        pageSize={10}
        stickyHeader
        stickyHeaderTop="top-11"
        noRowHover
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
 * Page shell
 * ════════════════════════════════════════════════════════════════════════ */

export default function AdminView({ activeTab }: Props) {
  // Map sidebar view ids onto the flat four-tab shell.
  const initialSection: SectionId = activeTab === 'logs' ? 'logs' : activeTab === 'roles' ? 'roles' : 'people';

  const { can } = useCurrentUser();
  const logEvent = useAuditLog();
  const { logs } = useAdminData();
  const { addToast } = useToast();

  const [section, setSection] = useState<SectionId>(initialSection);
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
    { id: 'people', label: 'People', icon: User },
    { id: 'teams', label: 'Teams', icon: Users },
    { id: 'roles', label: 'Roles & Permissions', icon: Shield },
    { id: 'logs', label: 'Audit Log', icon: ScrollText },
  ];

  const exportLogs = () => {
    const headers = ['Timestamp', 'Performed By', 'Action', 'Activity', 'Module', 'Entity', 'Result'];
    const esc = (v: string) => `"${String(v).replace(/"/g, '""')}"`;
    const rows = logs.map(l => [l.timestamp, l.user, l.action, l.description, l.module, l.entity, l.status].map(esc).join(','));
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
    logEvent({ action: 'Export', description: `Exported audit log as CSV (${logs.length} events)`, module: 'Admin', entity: 'Audit Log' });
    addToast({ message: `Exported ${logs.length} audit events as CSV.`, type: 'success' });
  };

  // Each tab's primary action lives on its own toolbar (right), so every tab
  // reads the same: KPI band → search-left / action-right → content. Export is
  // sized to the h-8 filter chips so the Audit toolbar row stays flush.
  const exportAction = can('ad_logs_export')
    ? <button onClick={exportLogs} className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-canvas-border bg-canvas-elevated text-ink-700 text-[12px] font-medium hover:border-brand-200 hover:bg-canvas transition-colors cursor-pointer"><Download size={13} />Export CSV</button>
    : null;

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
            <p className="mt-2 text-[0.9375rem] text-ink-500 leading-relaxed max-w-2xl">Manage people, teams, roles, and the audit trail.</p>
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
        {section === 'people' ? (
          <div className="pt-4"><PeopleSection key="people" onManageRole={goManageRole} onInvite={() => setInviteOpen(true)} /></div>
        ) : section === 'teams' ? (
          <div className="pt-4"><TeamsSection key="teams" onCreateTeam={() => setCreateTeamOpen(true)} /></div>
        ) : section === 'roles' ? (
          // No KPI band here: Total/System/Custom/Assigned were vanity counts
          // (derivable from, or duplicated by, the role list + People tab). The
          // role list is self-evident, so the two-pane workspace fills the tab.
          <div className="pt-4 h-full min-h-0">
            <RolesWorkspace key={`roles-${roleFocusNonce}`} initialRoleId={roleFocusId} onCreateRole={openCreateRole} />
          </div>
        ) : (
          <div className="pt-4"><AuditLogSection key="logs" action={exportAction} /></div>
        )}
      </div>

      <AnimatePresence>
        {inviteOpen && <InviteUserModal key="invite" onClose={() => setInviteOpen(false)} />}
        {createTeamOpen && <CreateTeamModal key="createteam" onClose={() => setCreateTeamOpen(false)} />}
        {createRoleOpen && <CreateRoleModal key="createrole" seed={createRoleSeed} onClose={() => { setCreateRoleOpen(false); setCreateRoleSeed(null); }} />}
      </AnimatePresence>
    </div>
  );
}
