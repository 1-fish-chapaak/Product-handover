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
import { Shield, Search, X, ChevronDown, Check, Info, Plus, CopyPlus, Users as UsersIcon } from 'lucide-react';
import {
  PERMISSION_GROUPS, ALL_PERMISSION_KEYS, PERSON_ROLES, presetKeys,
  type PermissionKey, type Role,
} from '../../data/rbac';
import { useCurrentUser } from '../../context/CurrentUserContext';
import { useAdminData, useAuditLog } from '../../context/AdminDataContext';
import { useToast } from '../shared/Toast';
import Modal from '../shared/Modal';
import Toggle from '../shared/Toggle';
import EmptyState from '../shared/EmptyState';
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
  const { roles } = useCurrentUser();
  const { defaultRoleId, setDefaultRoleId } = useAdminData();
  const { addToast } = useToast();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  return (
    <div className="flex items-center justify-between gap-2 px-3 py-2.5 border-t border-canvas-border bg-canvas/60">
      <span className="text-[0.75rem] font-medium text-ink-600 leading-tight">Default role<br /><span className="text-ink-400">for new users</span></span>
      <div className="relative" ref={ref}>
        <button
          onClick={() => setOpen(o => !o)}
          className={`no-focus-ring inline-flex items-center gap-2 h-8 pl-2.5 pr-2 rounded-lg border bg-canvas-elevated text-[0.8125rem] cursor-pointer transition-colors ${
            open ? 'border-brand-600 text-brand-700' : 'border-canvas-border text-ink-700 hover:border-brand-200'
          }`}
        >
          <span className="whitespace-nowrap max-w-[8rem] truncate">{roles.find(r => r.id === defaultRoleId)?.name ?? 'Select'}</span>
          <ChevronDown size={13} className={`text-ink-400 transition-transform ${open ? 'rotate-180 text-brand-600' : ''}`} />
        </button>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.13, ease: [0.2, 0, 0, 1] }}
            className="absolute right-0 bottom-full mb-1.5 w-52 max-h-[260px] overflow-y-auto origin-bottom-right bg-canvas-elevated border border-canvas-border rounded-xl shadow-[0_10px_30px_-12px_rgba(15,8,30,0.28)] p-1 z-30"
          >
            {roles.map(r => {
              const sel = r.id === defaultRoleId;
              return (
                <button
                  key={r.id}
                  onClick={() => { setDefaultRoleId(r.id); setOpen(false); addToast({ message: `Default role set to ${r.name}`, type: 'success' }); }}
                  className={`no-focus-ring flex w-full items-center justify-between gap-2 px-2.5 h-8 rounded-lg text-[0.8125rem] text-left cursor-pointer transition-colors ${
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
    </div>
  );
}

export function RolesWorkspace({ onCreateRole, initialRoleId }: { onCreateRole: (seed?: RoleSeed) => void; initialRoleId?: string }) {
  const prefersReduced = useReducedMotion();
  const { roles, updateRolePermissions } = useCurrentUser();
  const { defaultRoleId } = useAdminData();
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

  // User counts per role, derived from the people→role mapping.
  const userCounts = useMemo(
    () => Object.values(PERSON_ROLES).reduce<Record<string, number>>((acc, rid) => { acc[rid] = (acc[rid] ?? 0) + 1; return acc; }, {}),
    [],
  );

  const q = search.trim().toLowerCase();
  const visible = q
    ? roles.filter(r => [r.name, r.createdBy, r.description].some(v => String(v ?? '').toLowerCase().includes(q)))
    : roles;

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

  const applyPreset = (preset: 'none' | 'readonly' | 'full') => setEnabled(new Set(presetKeys(preset)));

  const save = () => {
    if (!selected) return;
    updateRolePermissions(selected.id, [...enabled] as PermissionKey[]);
    logEvent({ action: 'Update', description: `Updated permissions for role "${selected.name}" (${enabled.size} enabled)`, module: 'Admin', entity: 'Role' });
    addToast({ message: `${selected.name} permissions updated`, type: 'success' });
  };

  // Largest role headcount, for scaling the per-role usage bars in the rail.
  const maxRoleUsers = Math.max(1, ...Object.values(userCounts));

  return (
    <motion.div
      initial={prefersReduced ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: prefersReduced ? 0 : 0.2, ease: [0.2, 0, 0, 1] }}
      className="h-full flex gap-5 min-h-0"
    >
      {/* ── Left rail: role list + default selector ── */}
      <div className="w-[340px] shrink-0 rounded-xl border border-canvas-border bg-canvas-elevated flex flex-col overflow-hidden">
        <div className="px-3 py-3 border-b border-canvas-border flex items-center gap-2">
          <div className="flex flex-1 min-w-0 items-center gap-2 px-3 h-9 rounded-lg border border-canvas-border bg-canvas focus-within:border-brand-600 transition-colors">
            <Search size={14} className="text-ink-400 shrink-0" />
            <input
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
            aria-label="Create role"
            title="Create role"
            className="shrink-0 inline-flex items-center justify-center w-9 h-9 rounded-lg bg-brand-600 hover:bg-brand-500 active:bg-brand-800 text-white transition-colors cursor-pointer"
          >
            <Plus size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {visible.length === 0 ? (
            <div className="px-3 py-10 text-center text-[0.8125rem] text-ink-400">No roles match your search.</div>
          ) : visible.map(r => {
            const isSel = r.id === selectedId;
            const count = userCounts[r.id] ?? 0;
            return (
              <button
                key={r.id}
                onClick={() => setSelectedId(r.id)}
                className={`no-focus-ring w-full text-left rounded-lg px-3 py-2.5 transition-colors cursor-pointer ${
                  isSel ? 'bg-brand-50 ring-1 ring-inset ring-brand-200' : 'hover:bg-canvas'
                }`}
              >
                <div className="flex items-start gap-2.5">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${r.type === 'System' ? 'bg-brand-100/70' : 'bg-canvas border border-canvas-border'}`}>
                    <Shield size={13} className={r.type === 'System' ? 'text-brand-700' : 'text-ink-400'} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className={`text-[0.8125rem] font-semibold truncate ${isSel ? 'text-brand-800' : 'text-ink-800'}`}>{r.name}</span>
                      {r.id === defaultRoleId && <span className="px-1.5 h-4 inline-flex items-center rounded-full bg-brand-100 text-brand-700 text-[0.5625rem] font-bold uppercase tracking-wide shrink-0">Default</span>}
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-[0.6875rem] text-ink-400">
                      <span className="tabular-nums">{count} {count === 1 ? 'user' : 'users'}</span>
                      <span className="w-0.5 h-0.5 rounded-full bg-ink-300" />
                      <span className="tabular-nums">{r.permissions.length}/{TOTAL_PERMS} perms</span>
                    </div>
                    {/* Role distribution — share of users on this role vs the largest. */}
                    <div className="mt-1.5 h-1 rounded-full bg-canvas-border/70 overflow-hidden" title={`${count} of ${Object.values(userCounts).reduce((a, b) => a + b, 0)} assigned users`}>
                      <div
                        className={`h-full rounded-full transition-all duration-200 ${isSel ? 'bg-brand-600' : 'bg-brand-300'}`}
                        style={{ width: `${count === 0 ? 0 : Math.max(8, (count / maxRoleUsers) * 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <DefaultRoleSelector />
      </div>

      {/* ── Right pane: permission matrix for the selected role ── */}
      <div className="flex-1 min-w-0 rounded-xl border border-canvas-border bg-canvas-elevated flex flex-col overflow-hidden">
        {!selected ? (
          <div className="flex-1 flex items-center justify-center">
            <EmptyState icon={Shield} title="No role selected" body="Pick a role on the left to view and edit its permissions, or create a new one." size="compact"
              action={<button className={BTN_CTA_PRIMARY} onClick={() => onCreateRole()}><Plus size={14} />Create Role</button>} />
          </div>
        ) : (
          <>
            {/* Role header */}
            <div className="shrink-0 px-6 pt-5 pb-4 border-b border-canvas-border">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2.5">
                    <h2 className="text-[1.125rem] font-semibold text-ink-900 tracking-tight truncate">{selected.name}</h2>
                    <TypePill type={selected.type} />
                  </div>
                  {selected.description && <p className="mt-1 text-[0.8125rem] text-ink-500 leading-snug">{selected.description}</p>}
                  <div className="mt-2 flex items-center gap-3.5 text-[0.75rem] text-ink-400">
                    <span className="inline-flex items-center gap-1.5"><UsersIcon size={12} /><span className="tabular-nums">{userCounts[selected.id] ?? 0}</span> assigned</span>
                    <span className="inline-flex items-center gap-1.5">Created by <span className="text-ink-600">{selected.createdBy}</span></span>
                    <span className="inline-flex items-center gap-1.5">Updated <span className="text-ink-600">{selected.lastModified}</span></span>
                  </div>
                </div>
                <button
                  onClick={() => onCreateRole({ name: `${selected.name} (copy)`, description: selected.description ?? '', permissions: [...selected.permissions] })}
                  className="shrink-0 inline-flex items-center gap-1.5 px-2.5 h-8 rounded-md border border-canvas-border bg-canvas-elevated text-[0.75rem] font-medium text-ink-600 hover:text-brand-700 hover:border-ink-300/60 hover:bg-canvas transition-colors cursor-pointer"
                >
                  <CopyPlus size={12} />Duplicate
                </button>
              </div>

              {/* View/Edit toggle (+ presets when editing) and the same tidy
                  metric line + bar used in the Manage User modal. */}
              <div className="mt-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="inline-flex items-center gap-0.5 p-0.5 rounded-lg border border-canvas-border bg-canvas">
                      {(['view', 'edit'] as const).map(m => (
                        <button
                          key={m}
                          onClick={() => setPermMode(m)}
                          className={`px-2.5 h-7 rounded-md text-[0.75rem] font-medium capitalize transition-colors cursor-pointer ${
                            permMode === m ? 'bg-canvas-elevated text-brand-700 border border-canvas-border shadow-[0_1px_2px_rgb(15_8_30_/_0.05)]' : 'text-ink-500 hover:text-ink-700'
                          }`}
                        >
                          {m}
                        </button>
                      ))}
                    </div>
                    {permMode === 'edit' && (
                      <div className="flex items-center gap-1">
                        <button onClick={() => applyPreset('none')} className={presetChip(enabled.size === 0)}>None</button>
                        <button onClick={() => applyPreset('readonly')} className={presetChip(false)}>View Only</button>
                        <button onClick={() => applyPreset('full')} className={presetChip(enabled.size === TOTAL_PERMS)}>Full Access</button>
                      </div>
                    )}
                  </div>
                  <span className="text-[0.8125rem] text-ink-700 tabular-nums shrink-0">
                    <span className="font-semibold text-ink-900">{enabled.size}</span>
                    <span className="text-ink-400"> / {TOTAL_PERMS}</span> permissions
                    <span className="text-ink-400"> · </span>
                    <span className="font-semibold text-brand-700">{Math.round((enabled.size / TOTAL_PERMS) * 100)}%</span>
                  </span>
                </div>
                <div className="mt-2.5 h-1.5 rounded-full bg-canvas-border/70 overflow-hidden">
                  <div className="h-full rounded-full bg-brand-500 transition-all duration-300" style={{ width: `${Math.round((enabled.size / TOTAL_PERMS) * 100)}%` }} />
                </div>
              </div>
            </div>

            {/* Permissions — view: granted (active-only) chips; edit: full matrix */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {permMode === 'view' ? (
                enabled.size === 0 ? (
                  <div className="text-[0.8125rem] text-ink-400 py-8 text-center">This role grants no permissions.</div>
                ) : (
                  <div className="border border-canvas-border rounded-lg divide-y divide-canvas-border">
                    {PERMISSION_GROUPS.map(group => {
                      const on = group.perms.filter(p => enabled.has(p.key));
                      if (on.length === 0) return null;
                      return (
                        <div key={group.group} className="px-4 py-3">
                          <div className="flex items-center justify-between gap-2 mb-2">
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
                )
              ) : (
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
              )}
            </div>

            {/* Sticky save bar */}
            <div className="shrink-0 px-6 py-3 border-t border-canvas-border flex items-center justify-between gap-3">
              <span className="inline-flex items-center gap-1.5 text-[0.75rem] text-ink-500">
                <Info size={13} /> Changes apply to everyone with this role.
              </span>
              <div className="flex items-center gap-2">
                {dirty && <span className="text-[0.75rem] text-mitigated-700 font-medium">Unsaved changes</span>}
                <button
                  onClick={save}
                  disabled={!dirty}
                  className={`${BTN_PRIMARY} disabled:opacity-40 disabled:cursor-not-allowed`}
                >
                  Save Changes
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </motion.div>
  );
}

/* ── Create role modal (also used by Duplicate, which seeds it) ── */
export function CreateRoleModal({ onClose, seed }: { onClose: () => void; seed?: RoleSeed | null }) {
  const { addToast } = useToast();
  const { addRole } = useCurrentUser();
  const logEvent = useAuditLog();
  const [name, setName] = useState(seed?.name ?? '');
  const [description, setDescription] = useState(seed?.description ?? '');
  const [enabled, setEnabled] = useState<Set<string>>(() => new Set<string>(seed?.permissions ?? []));

  const applyPreset = (preset: 'none' | 'readonly' | 'full') => setEnabled(new Set(presetKeys(preset)));

  const create = () => {
    if (!name.trim()) { addToast({ message: 'Role name is required', type: 'error' }); return; }
    addRole({
      id: `role-${Date.now()}`,
      name: name.trim(),
      type: 'Custom',
      description: description.trim(),
      createdBy: 'You',
      lastModified: 'Just now',
      permissions: [...enabled] as PermissionKey[],
    });
    logEvent({ action: 'Create', description: `Created role "${name.trim()}" with ${enabled.size} permissions`, module: 'Admin', entity: 'Role' });
    onClose();
    addToast({ message: `Role "${name.trim()}" created`, type: 'success' });
  };

  return (
    <Modal
      title="Create Role"
      subtitle={seed ? 'Duplicated from an existing role. Adjust and save as new.' : 'Define a role and choose its permissions.'}
      width="max-w-[620px]"
      onClose={onClose}
      footer={
        <>
          <span className="mr-auto inline-flex items-center gap-1.5 text-[0.75rem] text-ink-500">
            <Info size={13} /> Editable later from role settings.
          </span>
          <button className={BTN_CANCEL} onClick={onClose}>Cancel</button>
          <button className={BTN_PRIMARY} onClick={create}>Create Role</button>
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
              <label className={FIELD_LABEL}>Description <span className="text-risk-700">*</span></label>
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
