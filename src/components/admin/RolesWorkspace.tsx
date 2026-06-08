/**
 * Roles — two-pane workspace.
 *
 * Left rail: searchable role list + the org default-role selector.
 * Right pane: the live permission matrix for the selected role (presets,
 * progress, per-permission toggles) with a sticky Save bar.
 *
 * Replaces the old cramped permission modal: editing a role's permissions is
 * now a first-class in-page surface. Writes flow through
 * `updateRolePermissions` / `addRole` (CurrentUserContext) so enforcement stays
 * in sync, and every save/create is recorded in the audit trail.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { Shield, Search, X, ChevronDown, Check, Info, Plus, CopyPlus, Trash2, Users as UsersIcon } from 'lucide-react';
import {
  PERMISSION_GROUPS, ALL_PERMISSION_KEYS, presetKeys,
  type PermissionKey, type Role,
} from '../../data/rbac';
import { useCurrentUser } from '../../context/CurrentUserContext';
import { useAdminData, useAuditLog } from '../../context/AdminDataContext';
import { useToast } from '../shared/Toast';
import Modal from '../shared/Modal';
import Toggle from '../shared/Toggle';
import EmptyState from '../shared/EmptyState';
import ConfirmationModal from '../shared/ConfirmationModal';
import {
  FIELD_LABEL, FIELD_INPUT, FIELD_TEXTAREA, BTN_CANCEL, BTN_PRIMARY, BTN_CTA_PRIMARY, presetChip,
} from './adminTokens';

const TOTAL_PERMS = ALL_PERMISSION_KEYS.length;

export interface RoleSeed { name: string; description: string; permissions: PermissionKey[]; }

/* A toggle helper for permission Sets. */
function toggleKey(prev: Set<string>, key: string): Set<string> {
  const next = new Set(prev);
  if (next.has(key)) next.delete(key); else next.add(key);
  return next;
}

function TypePill({ type }: { type: Role['type'] }) {
  return (
    <span className={`inline-flex items-center px-2 h-5 rounded-full text-[0.6875rem] font-semibold ${
      type === 'System' ? 'bg-evidence-50 text-evidence-700' : 'bg-draft-50 text-draft-700'
    }`}>{type}</span>
  );
}

function ProgressBar({ value, total }: { value: number; total: number }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex-1 h-1.5 rounded-full bg-canvas-border overflow-hidden">
        <div className="h-full rounded-full bg-brand-600 transition-all duration-200" style={{ width: `${(value / total) * 100}%` }} />
      </div>
      <span className="text-[0.75rem] text-ink-500 tabular-nums shrink-0">{value}/{total}</span>
    </div>
  );
}

/* ── Default-role selector — the org's default for newly invited users ── */
function DefaultRoleSelector() {
  const { roles, can } = useCurrentUser();
  const { defaultRoleId, setDefaultRoleId } = useAdminData();
  const { addToast } = useToast();
  const logEvent = useAuditLog();
  const [open, setOpen] = useState(false);
  // The role awaiting confirmation — changing the org default is a deliberate
  // action, so we stage the pick and confirm before committing.
  const [pendingRoleId, setPendingRoleId] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  // Changing the org default is a role-management action — gate it on the same
  // permission as the rest of Roles & Permissions.
  const allowed = can('ad_roles_manage');
  const pendingRole = roles.find(r => r.id === pendingRoleId) ?? null;

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const confirmChange = () => {
    if (!pendingRole) return;
    setDefaultRoleId(pendingRole.id);
    logEvent({ action: 'Update', description: `Set default role for new users to "${pendingRole.name}"`, module: 'Admin', entity: 'Role' });
    addToast({ message: `Default role set to ${pendingRole.name}`, type: 'success' });
    setPendingRoleId(null);
  };

  return (
    <div className="flex items-center justify-between gap-3 px-3.5 py-3 border-t border-canvas-border bg-canvas/60">
      <div className="flex items-center gap-2.5 min-w-0">
        <span className="flex items-center justify-center w-7 h-7 rounded-md bg-brand-50 text-brand-600 shrink-0">
          <UsersIcon size={14} />
        </span>
        <div className="flex flex-col leading-tight min-w-0">
          <span className="text-[0.8125rem] font-semibold text-ink-800 whitespace-nowrap">Default role</span>
          <span className="text-[0.75rem] text-ink-400 whitespace-nowrap">For new users</span>
        </div>
      </div>
      <div className="relative shrink-0" ref={ref}>
        <button
          onClick={() => { if (allowed) setOpen(o => !o); }}
          disabled={!allowed}
          title={allowed ? undefined : 'You need the Manage Roles permission to change this.'}
          className={`no-focus-ring inline-flex items-center justify-between gap-1.5 h-9 w-[8.75rem] pl-3 pr-2.5 rounded-md border bg-canvas-elevated text-[0.8125rem] font-medium transition-all duration-150 ${
            !allowed
              ? 'border-canvas-border text-ink-400 opacity-60 cursor-not-allowed'
              : `cursor-pointer active:scale-[0.97] ${open ? 'border-brand-600 text-brand-700 ring-2 ring-brand-600/10' : 'border-canvas-border text-ink-700 hover:border-brand-200 hover:bg-canvas'}`
          }`}
        >
          <span className="flex-1 min-w-0 text-left truncate">{roles.find(r => r.id === defaultRoleId)?.name ?? 'Select'}</span>
          <ChevronDown size={14} className={`shrink-0 transition-transform duration-200 ${open ? 'rotate-180 text-brand-600' : 'text-ink-400'}`} />
        </button>
        {open && allowed && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.13, ease: [0.2, 0, 0, 1] }}
            className="absolute right-0 bottom-full mb-2 w-52 max-h-[260px] overflow-y-auto origin-bottom-right bg-canvas-elevated border border-canvas-border rounded-xl shadow-[0_10px_30px_-12px_rgba(15,8,30,0.28)] p-1 z-30"
          >
            {roles.map(r => {
              const sel = r.id === defaultRoleId;
              return (
                <button
                  key={r.id}
                  onClick={() => { setOpen(false); if (r.id !== defaultRoleId) setPendingRoleId(r.id); }}
                  className={`no-focus-ring flex w-full items-center justify-between gap-2 px-2.5 h-8 rounded-md text-[0.8125rem] text-left cursor-pointer transition-colors ${
                    sel ? 'bg-brand-50 text-brand-700 font-semibold' : 'text-ink-700 hover:bg-canvas'
                  }`}
                >
                  <span className="truncate">{r.name}</span>
                  {sel && <Check size={14} className="shrink-0 text-brand-600" />}
                </button>
              );
            })}
          </motion.div>
        )}
      </div>

      <ConfirmationModal
        open={!!pendingRole}
        tone="primary"
        title="Change default role?"
        description={<>New users will be assigned the <strong className="font-semibold text-ink-800">{pendingRole?.name}</strong> role when they're invited. Existing users keep their current role.</>}
        confirmLabel="Set as default"
        cancelLabel="Cancel"
        onConfirm={confirmChange}
        onClose={() => setPendingRoleId(null)}
      />
    </div>
  );
}

export function RolesWorkspace({ onCreateRole, initialRoleId }: { onCreateRole: (seed?: RoleSeed) => void; initialRoleId?: string }) {
  const prefersReduced = useReducedMotion();
  const { roles, updateRolePermissions, removeRole, currentUser } = useCurrentUser();
  const { defaultRoleId, users } = useAdminData();
  const { addToast } = useToast();
  const logEvent = useAuditLog();

  // Open focused on `initialRoleId` when valid (e.g. arriving from a user's
  // Manage panel), otherwise the first role. The parent remounts via `key` to
  // re-focus, so this initial state is the single source of selection on mount.
  const startId = (initialRoleId && roles.some(r => r.id === initialRoleId)) ? initialRoleId : (roles[0]?.id ?? '');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string>(startId);
  const [enabled, setEnabled] = useState<Set<string>>(() => new Set(roles.find(r => r.id === startId)?.permissions ?? []));
  const [trackedId, setTrackedId] = useState(selectedId);
  // Permissions default to a read-first "view" (granted, active-only chips);
  // "edit" reveals the full toggle matrix.
  const [permMode, setPermMode] = useState<'view' | 'edit'>('view');
  const [confirmDelete, setConfirmDelete] = useState(false);

  // User counts per role, derived from the live admin user list (the People tab),
  // so inviting, removing, or re-assigning a user's role updates these in sync.
  const userCounts = useMemo(
    () => users.reduce<Record<string, number>>((acc, u) => { acc[u.roleId] = (acc[u.roleId] ?? 0) + 1; return acc; }, {}),
    [users],
  );

  const q = search.trim().toLowerCase();
  const matched = q
    ? roles.filter(r => [r.name, r.createdBy, r.description].some(v => String(v ?? '').toLowerCase().includes(q)))
    : roles;
  // Pin the org default role to the top; everything else keeps its order.
  const visible = [...matched].sort((a, b) => (a.id === defaultRoleId ? -1 : 0) - (b.id === defaultRoleId ? -1 : 0));

  const selected = roles.find(r => r.id === selectedId) ?? null;

  // When the selected role changes, reset the working set to its saved
  // permissions. Render-time adjustment (not an effect) so there's no cascade.
  if (selectedId !== trackedId) {
    setTrackedId(selectedId);
    setEnabled(new Set(selected?.permissions ?? []));
    setPermMode('view');
  }

  const dirty = useMemo(() => {
    if (!selected) return false;
    if (enabled.size !== selected.permissions.length) return true;
    return selected.permissions.some(k => !enabled.has(k));
  }, [enabled, selected]);

  // Which preset (if any) the current selection exactly matches — so the chip
  // highlights when a role is, e.g., precisely "View Only".
  const readonlyActive = useMemo(() => {
    const ro = presetKeys('readonly');
    return enabled.size === ro.length && ro.every(k => enabled.has(k));
  }, [enabled]);

  const applyPreset = (preset: 'none' | 'readonly' | 'full') => setEnabled(new Set(presetKeys(preset)));

  const save = () => {
    if (!selected) return;
    // Self-lockout guard (mirrors People's C1): the Roles & Permissions screen
    // itself is gated on `ad_roles_manage`, so you can't strip that permission
    // from your own role — you'd lose the ability to get back here and undo it.
    if (currentUser && selected.id === currentUser.roleId && !enabled.has('ad_roles_manage')) {
      addToast({ message: "You can't remove your own Manage Roles permission — you'd lose access to this screen.", type: 'error' });
      return;
    }
    updateRolePermissions(selected.id, [...enabled] as PermissionKey[]);
    logEvent({ action: 'Update', description: `Updated permissions for role "${selected.name}" (${enabled.size} enabled)`, module: 'Admin', entity: 'Role' });
    addToast({ message: `${selected.name} permissions updated`, type: 'success' });
  };

  // ── Delete (custom roles only) ── A role can't be deleted while it's a System
  // role, the org default, or still assigned to people — each would orphan
  // access, so we surface the reason on a disabled control instead.
  const assignedCount = selected ? (userCounts[selected.id] ?? 0) : 0;
  const isDefaultRole = !!selected && selected.id === defaultRoleId;
  const deleteBlockedReason = !selected || selected.type !== 'Custom'
    ? null // System roles don't show the delete control at all
    : isDefaultRole
      ? 'This is the default role for new users — pick another default before deleting it.'
      : assignedCount > 0
        ? `${assignedCount} ${assignedCount === 1 ? 'user is' : 'users are'} assigned this role. Reassign them first.`
        : null;
  const doDelete = () => {
    if (!selected) return;
    const { id, name } = selected;
    // Re-focus a surviving role before the list loses this one.
    const remaining = roles.filter(r => r.id !== id);
    setSelectedId(remaining[0]?.id ?? '');
    removeRole(id);
    logEvent({ action: 'Delete', description: `Deleted role "${name}"`, module: 'Admin', entity: 'Role' });
    addToast({ message: `Role "${name}" deleted`, type: 'success' });
    setConfirmDelete(false);
  };

  // ── Keyboard nav + shortcuts (no hints in the UI — discoverable by feel).
  //    Common, safe keys only; we bail on any modifier combo (so browser
  //    shortcuts are never hijacked) and whenever a modal owns the keyboard.
  //    ↑/↓ move between roles (even while filtering), Home/End jump to ends,
  //    "/" focuses search, Enter toggles View/Edit, Esc clears search / exits Edit.
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (document.querySelector('[role="dialog"]')) return; // a modal/dropdown owns input
      const t = e.target as HTMLElement | null;
      const typing = !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);

      const move = (dir: 1 | -1) => {
        if (visible.length === 0) return;
        const idx = visible.findIndex(r => r.id === selectedId);
        const next = idx < 0 ? (dir === 1 ? 0 : visible.length - 1) : Math.min(visible.length - 1, Math.max(0, idx + dir));
        const id = visible[next].id;
        setSelectedId(id);
        requestAnimationFrame(() => listRef.current?.querySelector(`[data-role-id="${id}"]`)?.scrollIntoView({ block: 'nearest' }));
      };

      switch (e.key) {
        case 'ArrowDown': e.preventDefault(); move(1); break;
        case 'ArrowUp':   e.preventDefault(); move(-1); break;
        case 'Home':      if (!typing && visible[0]) { e.preventDefault(); setSelectedId(visible[0].id); } break;
        case 'End':       if (!typing && visible.length) { e.preventDefault(); setSelectedId(visible[visible.length - 1].id); } break;
        case '/':         if (!typing) { e.preventDefault(); searchRef.current?.focus(); } break;
        case 'Enter':     if (!typing && selected) { e.preventDefault(); setPermMode(m => (m === 'view' ? 'edit' : 'view')); } break;
        case 'Escape':
          if (typing) { if (search) setSearch(''); else searchRef.current?.blur(); }
          else if (permMode === 'edit') { e.preventDefault(); setPermMode('view'); }
          break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [visible, selectedId, selected, permMode, search]);

  return (
    <motion.div
      initial={prefersReduced ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: prefersReduced ? 0 : 0.2, ease: [0.2, 0, 0, 1] }}
      className="h-full flex gap-5 min-h-0"
    >
      {/* ── Left rail: role list + default selector ── */}
      <div className="w-[340px] shrink-0 rounded-lg border border-canvas-border bg-canvas-elevated flex flex-col overflow-hidden">
        <div className="px-3 py-3 border-b border-canvas-border flex items-center gap-2">
          <div className="flex flex-1 min-w-0 items-center gap-2 px-3 h-9 rounded-md border border-canvas-border bg-canvas focus-within:border-brand-600 transition-colors">
            <Search size={14} className="text-ink-400 shrink-0" />
            <input
              ref={searchRef}
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search roles..."
              className="flex-1 min-w-0 bg-transparent outline-none text-[0.8125rem] text-ink-800 placeholder:text-ink-400"
            />
            {search && (
              <button onClick={() => setSearch('')} className="text-ink-400 hover:text-ink-700 cursor-pointer shrink-0" aria-label="Clear search">
                <X size={13} />
              </button>
            )}
          </div>
          <button
            onClick={() => onCreateRole()}
            aria-label="Create Role"
            title="Create Role"
            className="shrink-0 inline-flex items-center justify-center w-9 h-9 rounded-md bg-brand-600 hover:bg-brand-500 active:bg-brand-800 active:scale-95 text-white transition-all duration-150 cursor-pointer"
          >
            <Plus size={16} />
          </button>
        </div>

        <div ref={listRef} className="flex-1 overflow-y-auto py-1.5">
          {visible.length === 0 ? (
            <div className="px-3 py-10 text-center text-[0.8125rem] text-ink-400">No roles match your search.</div>
          ) : visible.map((r, i) => {
            const isSel = r.id === selectedId;
            const count = userCounts[r.id] ?? 0;
            return (
              <motion.button
                key={r.id}
                data-role-id={r.id}
                onClick={() => setSelectedId(r.id)}
                initial={prefersReduced ? false : { opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: prefersReduced ? 0 : 0.22, delay: prefersReduced ? 0 : i * 0.035, ease: [0.2, 0, 0, 1] }}
                whileTap={prefersReduced ? undefined : { scale: 0.985 }}
                className={`group no-focus-ring relative w-full text-left pl-3 pr-3 py-2.5 cursor-pointer ${
                  isSel ? '' : 'hover:bg-canvas transition-colors'
                }`}
              >
                {/* Selection indicator slides between rows (shared layoutId). */}
                {isSel && (
                  <motion.div
                    layoutId="role-active"
                    transition={prefersReduced ? { duration: 0 } : { type: 'spring', stiffness: 520, damping: 42 }}
                    className="absolute inset-0 bg-brand-50 border-l-2 border-brand-600"
                  />
                )}
                <div className="relative z-10 flex items-center gap-3">
                  {/* Brand is the only chromatic anchor: the chip is a calm
                      monochrome hairline at rest, warms to a brand tint on hover,
                      and goes solid brand once selected. */}
                  <div className={`w-8 h-8 rounded-md flex items-center justify-center shrink-0 transition-colors duration-150 ${
                    isSel ? 'bg-brand-600' : 'bg-canvas border border-canvas-border group-hover:bg-brand-50 group-hover:border-brand-200'
                  }`}>
                    <Shield size={14} className={`transition-colors duration-150 ${isSel ? 'text-white' : 'text-ink-400 group-hover:text-brand-600'}`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className={`text-[0.875rem] font-semibold tracking-[-0.01em] truncate transition-colors ${isSel ? 'text-brand-800' : 'text-ink-900 group-hover:text-brand-700'}`}>{r.name}</span>
                      {r.id === defaultRoleId && <span className="shrink-0 inline-flex items-center px-2 h-5 rounded-md bg-brand-50 text-brand-700 text-[0.6875rem] font-medium">Default</span>}
                    </div>
                    <div className="mt-0.5 flex items-center gap-1.5 text-[0.75rem] text-ink-400">
                      <span className="tabular-nums">{count} {count === 1 ? 'user' : 'users'}</span>
                      <span className="w-0.5 h-0.5 rounded-full bg-ink-300" />
                      <span className="tabular-nums">{r.permissions.length}/{TOTAL_PERMS} perms</span>
                    </div>
                  </div>
                </div>
              </motion.button>
            );
          })}
        </div>

        <DefaultRoleSelector />
      </div>

      {/* ── Right pane: permission matrix for the selected role ── */}
      <div className="flex-1 min-w-0 rounded-lg border border-canvas-border bg-canvas-elevated flex flex-col overflow-hidden">
        {!selected ? (
          <div className="flex-1 flex items-center justify-center">
            <EmptyState icon={Shield} title="No role selected" body="Pick a role on the left to view and edit its permissions, or create a new one." size="compact"
              action={<button className={BTN_CTA_PRIMARY} onClick={() => onCreateRole()}><Plus size={14} />Create Role</button>} />
          </div>
        ) : (
          <>
            {/* Role header */}
            <div className="shrink-0 px-6 pt-3.5 pb-3.5 border-b border-canvas-border">
              <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2.5">
                      <h2 className="text-[1.125rem] font-semibold text-ink-900 tracking-tight truncate">{selected.name}</h2>
                      <TypePill type={selected.type} />
                    </div>
                    {selected.description && <p className="mt-0.5 text-[0.8125rem] text-ink-500 leading-snug">{selected.description}</p>}
                    <div className="mt-1.5 flex items-center gap-2.5 text-[0.75rem] text-ink-400">
                      <span className="inline-flex items-center gap-1.5"><UsersIcon size={12} /><span className="tabular-nums text-ink-600 font-medium">{userCounts[selected.id] ?? 0}</span> assigned</span>
                      <span className="w-0.5 h-0.5 rounded-full bg-ink-300" />
                      <span className="inline-flex items-center gap-1.5">Created by <span className="text-ink-600">{selected.createdBy}</span></span>
                      <span className="w-0.5 h-0.5 rounded-full bg-ink-300" />
                      <span className="inline-flex items-center gap-1.5">Updated <span className="text-ink-600">{selected.lastModified}</span></span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => onCreateRole({ name: `${selected.name} (copy)`, description: selected.description ?? '', permissions: [...selected.permissions] })}
                      className="inline-flex items-center gap-1.5 px-2.5 h-8 rounded-md border border-canvas-border bg-canvas-elevated text-[0.75rem] font-medium text-ink-600 hover:text-brand-700 hover:border-ink-300/60 hover:bg-canvas transition-colors cursor-pointer"
                    >
                      <CopyPlus size={12} />Duplicate
                    </button>
                    {/* Delete is offered only on Custom roles; it's disabled (with a
                        reason) while the role is the default or still assigned. */}
                    {selected.type === 'Custom' && (
                      <button
                        onClick={() => setConfirmDelete(true)}
                        disabled={deleteBlockedReason !== null}
                        title={deleteBlockedReason ?? 'Delete role'}
                        className="inline-flex items-center gap-1.5 px-2.5 h-8 rounded-md border border-canvas-border bg-canvas-elevated text-[0.75rem] font-medium text-risk-700 hover:bg-risk-50 hover:border-risk-200 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-canvas-elevated disabled:hover:border-canvas-border"
                      >
                        <Trash2 size={12} />Delete
                      </button>
                    )}
                  </div>
              </div>

              {/* View/Edit toggle (+ presets when editing) with a compact
                  inline coverage meter — one row, no full-width bar. */}
              <div className="mt-3">
                <div className="flex items-center justify-between gap-x-4 gap-y-2 flex-wrap">
                  <div className="flex items-center gap-3">
                    <div className="inline-flex items-center gap-1 p-1 rounded-lg border border-canvas-border/60 bg-canvas-elevated/40">
                      {(['view', 'edit'] as const).map(m => (
                        <button
                          key={m}
                          onClick={() => setPermMode(m)}
                          aria-pressed={permMode === m}
                          className={`relative flex items-center justify-center px-3 h-8 rounded-md text-[0.75rem] font-medium capitalize transition-colors cursor-pointer ${
                            permMode === m ? 'text-brand-700' : 'text-ink-500 hover:text-ink-700'
                          }`}
                        >
                          {permMode === m && (
                            <motion.span
                              layoutId="permmode-active"
                              transition={prefersReduced ? { duration: 0 } : { type: 'spring', stiffness: 400, damping: 30 }}
                              className="absolute inset-0 rounded-md bg-canvas-elevated border border-canvas-border shadow-[0_1px_2px_rgb(15_8_30_/_0.06),0_2px_6px_rgb(15_8_30_/_0.04)]"
                            />
                          )}
                          <span className="relative z-10">{m}</span>
                        </button>
                      ))}
                    </div>
                    {permMode === 'edit' && (
                      <>
                        <span className="w-px h-5 bg-canvas-border shrink-0" aria-hidden="true" />
                        <div className="flex items-center gap-1.5">
                          <button onClick={() => applyPreset('none')} className={presetChip(enabled.size === 0)}>None</button>
                          <button onClick={() => applyPreset('readonly')} className={presetChip(readonlyActive)}>View Only</button>
                          <button onClick={() => applyPreset('full')} className={presetChip(enabled.size === TOTAL_PERMS)}>Full Access</button>
                        </div>
                      </>
                    )}
                  </div>
                  {/* Compact inline meter + count — replaces the old full-width
                      progress row so the header stays tight. */}
                  <div className="flex items-center gap-2.5 shrink-0">
                    <div className="w-24 h-1.5 rounded-full bg-canvas-border/70 overflow-hidden">
                      <div className="h-full rounded-full bg-brand-500 transition-all duration-300" style={{ width: `${Math.round((enabled.size / TOTAL_PERMS) * 100)}%` }} />
                    </div>
                    <span className="text-[0.8125rem] text-ink-700 tabular-nums">
                      <span className="font-semibold text-ink-900">{enabled.size}</span>
                      <span className="text-ink-400"> / {TOTAL_PERMS} permissions · </span>
                      <span className="font-semibold text-brand-700">{Math.round((enabled.size / TOTAL_PERMS) * 100)}%</span>
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Permissions — view: granted (active-only) chips; edit: full matrix.
                Crossfades when the role or mode changes (keyed remount). */}
            <div className="flex-1 overflow-y-auto">
              <motion.div
                key={`${selectedId}-${permMode}`}
                initial={prefersReduced ? false : { opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: prefersReduced ? 0 : 0.2, ease: [0.2, 0, 0, 1] }}
              >
              {permMode === 'view' ? (
                enabled.size === 0 ? (
                  <div className="text-[0.8125rem] text-ink-400 py-8 text-center">This role grants no permissions.</div>
                ) : (
                  <div className="divide-y divide-canvas-border">
                      {PERMISSION_GROUPS.map((group, gi) => {
                        const on = group.perms.filter(p => enabled.has(p.key));
                        if (on.length === 0) return null;
                        const total = group.perms.length;
                        const full = on.length === total;
                        return (
                          <motion.div
                            key={group.group}
                            initial={prefersReduced ? false : { opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: prefersReduced ? 0 : 0.22, delay: prefersReduced ? 0 : gi * 0.04, ease: [0.2, 0, 0, 1] }}
                            className="px-6 py-3 scroll-mt-2"
                          >
                            <div className="flex items-center justify-between gap-2 mb-2">
                              <span className="text-[0.6875rem] font-semibold text-ink-600 uppercase tracking-wide">{group.group}</span>
                              <span className="text-[0.6875rem] tabular-nums shrink-0">
                                <span className={full ? 'text-ink-400' : 'text-brand-700 font-semibold'}>{on.length}</span>
                                <span className="text-ink-300">/{total}</span>
                              </span>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {on.map(p => (
                                <span key={p.key} className="inline-flex items-center px-2 h-6 rounded-md bg-brand-50 text-brand-700 text-[0.6875rem] font-medium">
                                  {p.name}
                                </span>
                              ))}
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                )
              ) : (
                <div className="divide-y divide-canvas-border">
                  {PERMISSION_GROUPS.map((group, gi) => {
                    const groupKeys = group.perms.map(p => p.key);
                    const groupOn = groupKeys.filter(k => enabled.has(k)).length;
                    const allOn = groupOn === groupKeys.length;
                    // Master switch — flips the whole module on/off at once.
                    const toggleGroup = () => setEnabled(prev => {
                      const next = new Set(prev);
                      if (allOn) groupKeys.forEach(k => next.delete(k));
                      else groupKeys.forEach(k => next.add(k));
                      return next;
                    });
                    return (
                    <motion.div
                      key={group.group}
                      initial={prefersReduced ? false : { opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: prefersReduced ? 0 : 0.22, delay: prefersReduced ? 0 : gi * 0.04, ease: [0.2, 0, 0, 1] }}
                    >
                      <div className="flex items-center justify-between gap-3 px-6 py-2.5 bg-canvas">
                        <span className="text-[0.6875rem] font-semibold text-ink-600 uppercase tracking-wide">{group.group}</span>
                        <div className="flex items-center gap-2.5 shrink-0">
                          <span className="text-[0.6875rem] tabular-nums">
                            <span className={groupOn === 0 ? 'text-ink-300' : allOn ? 'text-ink-400' : 'text-brand-700 font-semibold'}>{groupOn}</span>
                            <span className="text-ink-300">/{groupKeys.length}</span>
                          </span>
                          <Toggle checked={allOn} onChange={toggleGroup} ariaLabel={`Toggle all ${group.group} permissions`} />
                        </div>
                      </div>
                      {group.perms.map(perm => {
                        const isOn = enabled.has(perm.key);
                        return (
                          <div
                            key={perm.key}
                            onClick={() => setEnabled(prev => toggleKey(prev, perm.key))}
                            className="flex items-center justify-between gap-4 px-6 py-2.5 border-t border-canvas-border/60 cursor-pointer hover:bg-canvas transition-colors select-none"
                          >
                            <div className="min-w-0">
                              <div className={`text-[0.8125rem] font-medium transition-colors ${isOn ? 'text-ink-800' : 'text-ink-600'}`}>{perm.name}</div>
                              <div className="text-[0.75rem] text-ink-400 truncate">{perm.desc}</div>
                            </div>
                            <Toggle checked={isOn} />
                          </div>
                        );
                      })}
                    </motion.div>
                    );
                  })}
                </div>
              )}
              </motion.div>
            </div>

            {/* Sticky save bar */}
            <div className="shrink-0 px-6 py-3 border-t border-canvas-border flex items-center justify-between gap-3">
              <span className="inline-flex items-center gap-1.5 text-[0.75rem] text-ink-500">
                <Info size={13} /> Changes apply to everyone with this role.
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={save}
                  disabled={!dirty}
                  className={`${BTN_PRIMARY} transition-opacity duration-200 disabled:opacity-40 disabled:cursor-not-allowed`}
                >
                  Save Changes
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      <ConfirmationModal
        open={confirmDelete}
        title="Delete role?"
        description={<>This will permanently delete the <span className="font-semibold">{selected?.name}</span> role. This action cannot be undone.</>}
        confirmLabel="Delete Role"
        tone="destructive"
        onConfirm={doDelete}
        onClose={() => setConfirmDelete(false)}
      />
    </motion.div>
  );
}

/* ── Create role modal (also used by Duplicate, which seeds it) ── */
export function CreateRoleModal({ onClose, seed }: { onClose: () => void; seed?: RoleSeed | null }) {
  const { addToast } = useToast();
  const { roles, addRole } = useCurrentUser();
  const logEvent = useAuditLog();
  const submitting = useRef(false);
  const [name, setName] = useState(seed?.name ?? '');
  const [description, setDescription] = useState(seed?.description ?? '');
  // A fresh role starts blank (no permissions), matching "choose its
  // permissions"; the author opts in explicitly. Duplicating seeds from the
  // source role's permissions.
  const [enabled, setEnabled] = useState<Set<string>>(() => new Set<string>(seed?.permissions ?? []));

  const applyPreset = (preset: 'none' | 'readonly' | 'full') => setEnabled(new Set(presetKeys(preset)));

  const create = () => {
    if (submitting.current) return;
    const trimmed = name.trim();
    if (!trimmed) { addToast({ message: 'Role name is required', type: 'error' }); return; }
    // Reject duplicate role names (A5).
    if (roles.some(r => r.name.trim().toLowerCase() === trimmed.toLowerCase())) { addToast({ message: 'A role with this name already exists', type: 'error' }); return; }
    submitting.current = true;
    addRole({
      id: `role-${(globalThis.crypto as Crypto | undefined)?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`}`,
      name: trimmed,
      type: 'Custom',
      description: description.trim(),
      createdBy: 'You',
      lastModified: 'Just now',
      permissions: [...enabled] as PermissionKey[],
    });
    logEvent({ action: 'Create', description: `Created role "${trimmed}" with ${enabled.size} permissions`, module: 'Admin', entity: 'Role' });
    onClose();
    addToast({ message: `Role "${trimmed}" created`, type: 'success' });
  };

  return (
    <Modal
      title="Create Role"
      width="max-w-[620px]"
      onClose={onClose}
      footer={
        <>
          <span className="mr-auto inline-flex items-center gap-1.5 text-[0.75rem] text-ink-500">
            <Info size={13} /> You can change this later.
          </span>
          <button className={BTN_CANCEL} onClick={onClose}>Cancel</button>
          <button className={`${BTN_PRIMARY} disabled:opacity-40 disabled:cursor-not-allowed`} onClick={create} disabled={!name.trim()}>Create Role</button>
        </>
      }
    >
      <div className="space-y-6">
        {/* Details */}
        <section>
          <h3 className="text-[0.6875rem] font-semibold text-ink-500 uppercase tracking-[0.14em] mb-3">Details</h3>
          <div className="space-y-4">
            <div>
              <label className={FIELD_LABEL}>Role Name <span className="text-risk-700">*</span></label>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="Enter role name" className={FIELD_INPUT} />
            </div>
            <div>
              <label className={FIELD_LABEL}>Description</label>
              <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} placeholder="Enter a description..." className={FIELD_TEXTAREA} />
            </div>
          </div>
        </section>

        {/* Permissions */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[0.6875rem] font-semibold text-ink-500 uppercase tracking-[0.14em]">Permissions</h3>
            <div className="flex items-center gap-1">
              <button onClick={() => applyPreset('none')} className={presetChip(enabled.size === 0)}>None</button>
              <button onClick={() => applyPreset('readonly')} className={presetChip(false)}>View Only</button>
              <button onClick={() => applyPreset('full')} className={presetChip(enabled.size === TOTAL_PERMS)}>Full Access</button>
            </div>
          </div>

          <div className="mb-4"><ProgressBar value={enabled.size} total={TOTAL_PERMS} /></div>

          <div className="border border-canvas-border rounded-lg overflow-hidden">
            {PERMISSION_GROUPS.map((group, gi) => (
              <div key={group.group}>
                <div className={`px-4 py-2.5 bg-canvas ${gi > 0 ? 'border-t border-canvas-border' : ''}`}>
                  <span className="text-[0.8125rem] font-semibold text-ink-800">{group.group}</span>
                </div>
                {group.perms.map(perm => {
                  const isOn = enabled.has(perm.key);
                  return (
                    <div
                      key={perm.key}
                      onClick={() => setEnabled(prev => toggleKey(prev, perm.key))}
                      className="flex items-center justify-between gap-4 px-4 py-2.5 border-t border-canvas-border/60 cursor-pointer hover:bg-canvas transition-colors"
                    >
                      <div className="min-w-0">
                        <div className="text-[0.8125rem] font-medium text-ink-800">{perm.name}</div>
                        <div className="text-[0.75rem] text-ink-500">{perm.desc}</div>
                      </div>
                      <Toggle checked={isOn} />
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </section>
      </div>
    </Modal>
  );
}
