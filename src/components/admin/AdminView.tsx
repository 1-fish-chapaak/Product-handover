import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Users, Shield, Settings, ScrollText,
  UserPlus, Plus, Download, Filter,
  Construction, X, Eye, ChevronDown, Search, Pencil, Copy, CopyPlus, Info, Trash2,
} from 'lucide-react';
import SmartTable, { type Column } from '../shared/SmartTable';
import { StatusBadge } from '../shared/StatusBadge';
import FloatingLines from '../shared/FloatingLines';

interface Props {
  activeTab?: string;
}

type TabId = 'users' | 'teams' | 'roles' | 'settings' | 'integrations' | 'logs';

interface Tab {
  id: TabId;
  label: string;
  icon: typeof Users;
}

const tabs: Tab[] = [
  { id: 'users', label: 'Users & Teams', icon: Users },
  { id: 'roles', label: 'Roles & Permissions', icon: Shield },
  { id: 'logs', label: 'Audit Logs', icon: ScrollText },
];

type UserStatus = 'Active' | 'Inactive' | 'Invited' | 'Suspended' | 'Locked';

interface MockUser {
  name: string;
  initials: string;
  email: string;
  role: string;
  team: string;
  status: UserStatus;
  lastLogin: string;
}

const STATUS_MAP: Record<UserStatus, string> = {
  Active: 'active',
  Inactive: 'inactive',
  Invited: 'invited',
  Suspended: 'suspended',
  Locked: 'locked',
};

const AVATAR_COLORS = ['#6A12CD', '#0369A1', '#15803D', '#B45309', '#B42318', '#3B0B72', '#0891B2', '#9333EA', '#C2410C', '#1D4ED8', '#059669', '#7C3AED'];

/* RowActionMenu removed — user actions are now inline icons */

/* ── View User Modal ── */
function ViewUserModal({ user, onClose }: { user: MockUser; onClose: () => void }) {
  const color = AVATAR_COLORS[user.name.charCodeAt(0) % AVATAR_COLORS.length];
  const recentActivity = [
    { action: 'Logged in', time: user.lastLogin },
    { action: 'Updated risk register', time: 'Apr 18' },
    { action: 'Ran duplicate invoice workflow', time: 'Apr 16' },
    { action: 'Exported SOX report', time: 'Apr 14' },
  ];

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.97 }}
        transition={{ duration: 0.15, ease: [0.2, 0, 0, 1] }}
        className="fixed inset-0 z-50 flex items-center justify-center p-8" onClick={onClose}
      >
      <div className="w-[440px] bg-white rounded-lg border border-border-light flex flex-col" style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.12)' }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 h-12 border-b border-border-light shrink-0">
          <h2 className="text-[0.875rem] font-semibold text-text">User Details</h2>
          <button onClick={onClose} className="w-7 h-7 rounded flex items-center justify-center hover:bg-gray-100 transition-colors cursor-pointer text-text-muted">
            <X size={15} />
          </button>
        </div>

        <div className="px-6 py-5 flex items-center gap-4 border-b border-border-light">
          <div className="w-12 h-12 rounded-full flex items-center justify-center text-[1rem] font-bold text-white shrink-0" style={{ background: color }}>
            {user.initials}
          </div>
          <div>
            <div className="text-[0.9375rem] font-semibold text-text">{user.name}</div>
            <div className="text-[0.8125rem] text-text-muted mt-0.5">{user.email}</div>
            <div className="mt-2">
              <StatusBadge status={STATUS_MAP[user.status] || 'draft'} />
            </div>
          </div>
        </div>

        <div className="px-6 py-4 grid grid-cols-2 gap-4 border-b border-border-light">
          {[
            { label: 'Role', value: user.role },
            { label: 'Team', value: user.team },
            { label: 'Last Login', value: user.lastLogin },
            { label: 'Account Created', value: 'Jan 15, 2026' },
          ].map(d => (
            <div key={d.label}>
              <div className="text-[0.75rem] text-text-muted mb-0.5">{d.label}</div>
              <div className="text-[0.8125rem] text-text">{d.value}</div>
            </div>
          ))}
        </div>

        <div className="px-6 py-4">
          <div className="text-[0.8125rem] font-semibold text-text mb-2">Recent Activity</div>
          {recentActivity.map((a, i) => (
            <div key={i} className={`flex items-center justify-between py-2 ${i > 0 ? 'border-t border-border-light/60' : ''}`}>
              <span className="text-[0.8125rem] text-text-secondary">{a.action}</span>
              <span className="text-[0.75rem] text-text-muted tabular-nums">{a.time}</span>
            </div>
          ))}
        </div>

        <div className="px-6 py-3 border-t border-border-light flex justify-end shrink-0">
          <button onClick={onClose} className="px-4 h-8 rounded-md border border-border text-[0.8125rem] font-medium text-text-secondary hover:bg-gray-50 transition-colors cursor-pointer">
            Close
          </button>
        </div>
      </div>
      </motion.div>
    </>
  );
}

/* ── Edit User Modal ── */
function EditUserModal({ user, onClose }: { user: MockUser; onClose: () => void }) {
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const color = AVATAR_COLORS[user.name.charCodeAt(0) % AVATAR_COLORS.length];

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.97 }}
        transition={{ duration: 0.15, ease: [0.2, 0, 0, 1] }}
        className="fixed inset-0 z-50 flex items-center justify-center p-8" onClick={onClose}
      >
      <div className="w-[440px] bg-white rounded-lg border border-border-light flex flex-col" style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.12)' }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 h-12 border-b border-border-light shrink-0">
          <h2 className="text-[0.875rem] font-semibold text-text">Edit User</h2>
          <button onClick={onClose} className="w-7 h-7 rounded flex items-center justify-center hover:bg-gray-100 transition-colors cursor-pointer text-text-muted">
            <X size={15} />
          </button>
        </div>

        <div className="px-6 py-3 flex items-center gap-3 border-b border-border-light bg-surface-2/30">
          <div className="w-9 h-9 rounded-full flex items-center justify-center text-[0.75rem] font-bold text-white shrink-0" style={{ background: color }}>
            {user.initials}
          </div>
          <div>
            <div className="text-[0.8125rem] font-semibold text-text">{user.name}</div>
            <div className="text-[0.75rem] text-text-muted">{user.email}</div>
          </div>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="text-[0.8125rem] font-medium text-text mb-1.5 block">Full Name</label>
            <input defaultValue={user.name} className="w-full h-9 px-3 rounded-md border border-border bg-white text-[0.8125rem] text-text outline-none focus:border-primary/40 transition-colors" />
          </div>
          <div>
            <label className="text-[0.8125rem] font-medium text-text mb-1.5 block">Email</label>
            <input defaultValue={user.email} className="w-full h-9 px-3 rounded-md border border-border bg-white text-[0.8125rem] text-text outline-none focus:border-primary/40 transition-colors" />
          </div>
          <div>
            <label className="text-[0.8125rem] font-medium text-text mb-1.5 block">Role</label>
            <div className="relative">
              <select defaultValue={user.role} className="w-full h-9 px-3 rounded-md border border-border bg-white text-[0.8125rem] text-text outline-none appearance-none cursor-pointer focus:border-primary/40 transition-colors">
                <option>test role per final</option>
                <option>test invite permission</option>
                <option>Enabler</option>
                <option>system clone/all permissions</option>
                <option>Viewer</option>
                <option>Nitin Test</option>
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
            </div>
          </div>
          <div>
            <label className="text-[0.8125rem] font-medium text-text mb-1.5 block">Team</label>
            <div className="relative">
              <select defaultValue={user.team} className="w-full h-9 px-3 rounded-md border border-border bg-white text-[0.8125rem] text-text outline-none appearance-none cursor-pointer focus:border-primary/40 transition-colors">
                <option>SOX Audit</option>
                <option>IFC Team</option>
                <option>Engineering</option>
                <option>Management</option>
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
            </div>
          </div>
          <div>
            <label className="text-[0.8125rem] font-medium text-text mb-1.5 block">Status</label>
            <div className="flex items-center gap-2">
              {(['Active', 'Suspended', 'Locked', 'Inactive'] as UserStatus[]).map(s => (
                <label key={s} className={`px-3 py-1.5 rounded-md border cursor-pointer transition-colors text-[0.75rem] font-medium ${
                  user.status === s ? 'border-primary bg-primary-light text-primary font-semibold' : 'border-border text-text-secondary hover:bg-gray-50'
                }`}>
                  <input type="radio" name="status" defaultChecked={user.status === s} className="sr-only" />
                  {s}
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="px-6 py-3 border-t border-border-light shrink-0">
          {deleteConfirm ? (
            <div>
              <p className="text-[0.8125rem] text-text mb-3">Are you sure you want to remove <span className="font-semibold">{user.name}</span>? This action cannot be undone.</p>
              <div className="flex items-center justify-end gap-2">
                <button onClick={() => setDeleteConfirm(false)} className="px-4 h-8 rounded-md border border-border text-[0.8125rem] font-medium text-text-secondary hover:bg-gray-50 transition-colors cursor-pointer">
                  Cancel
                </button>
                <button onClick={onClose} className="flex items-center gap-1.5 px-4 h-8 rounded-md bg-red-600 hover:bg-red-700 text-white text-[0.8125rem] font-semibold transition-colors cursor-pointer">
                  <Trash2 size={13} />
                  Remove User
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <button onClick={() => setDeleteConfirm(true)} className="flex items-center gap-1.5 px-3 h-8 rounded-md text-[0.8125rem] font-medium text-red-600 hover:bg-red-50 transition-colors cursor-pointer">
                <Trash2 size={13} />
                Remove User
              </button>
              <div className="flex items-center gap-2">
                <button onClick={onClose} className="px-4 h-8 rounded-md border border-border text-[0.8125rem] font-medium text-text-secondary hover:bg-gray-50 transition-colors cursor-pointer">
                  Cancel
                </button>
                <button onClick={onClose} className="px-5 h-8 rounded-md bg-primary hover:bg-primary-hover text-white text-[0.8125rem] font-semibold transition-colors cursor-pointer">
                  Save Changes
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
      </motion.div>
    </>
  );
}

const mockUsers: MockUser[] = [
  { name: 'Abhinav Sharma', initials: 'AS', email: 'abhinav@irame.ai', role: 'test role per final', team: 'SOX Audit', status: 'Active', lastLogin: 'Today, 09:14' },
  { name: 'Aditya Thakur', initials: 'AT', email: 'aditya.thakur@irame.ai', role: 'test invite permission', team: 'SOX Audit', status: 'Active', lastLogin: 'Today, 08:30' },
  { name: 'AI', initials: 'AI', email: 'ai@irame.ai', role: 'Test wf for case', team: 'Engineering', status: 'Active', lastLogin: 'Yesterday' },
  { name: 'Ajay 14110008', initials: 'AJ', email: 'ajay.aj@btech2014.iitgn.ac.in', role: 'Enabler', team: 'IFC Team', status: 'Invited', lastLogin: 'Never' },
  { name: 'ajay mudhai', initials: 'AM', email: 'ajay@irame.ai', role: 'Enabler', team: 'IFC Team', status: 'Active', lastLogin: 'Apr 20' },
  { name: 'Ajay Mudhai', initials: 'AM', email: 'ajay@irame.ai', role: 'system clone/all permissions', team: 'Management', status: 'Active', lastLogin: 'Apr 19' },
  { name: 'Ayushi Narang', initials: 'AN', email: 'ayushi.narang@irame.ai', role: 'Enabler', team: 'SOX Audit', status: 'Active', lastLogin: 'Apr 21' },
  { name: 'Chulbul Pandey', initials: 'CP', email: 'kuldeep.msvm@gmail.com', role: 'Enabler', team: 'Management', status: 'Suspended', lastLogin: 'Mar 28' },
  { name: 'CS', initials: 'CS', email: 'cs@irame.ai', role: 'Enabler', team: 'Engineering', status: 'Active', lastLogin: 'Today, 10:02' },
  { name: 'Kuldeep Pandey', initials: 'KP', email: 'kuldeep.msvm@gmail.com', role: 'Nitin Test', team: '\u2014', status: 'Inactive', lastLogin: 'Feb 14' },
  { name: 'Rahul Verma', initials: 'RV', email: 'rahul@irame.ai', role: 'Viewer', team: 'IFC Team', status: 'Locked', lastLogin: 'Mar 05' },
  { name: 'Priya Singh', initials: 'PS', email: 'priya@irame.ai', role: 'Enabler', team: 'SOX Audit', status: 'Invited', lastLogin: 'Never' },
];

const userColumns: Column<MockUser & Record<string, unknown>>[] = [
  {
    key: 'name',
    label: 'Name',
    sortable: true,
    render: (item, i) => {
      const color = AVATAR_COLORS[i % AVATAR_COLORS.length];
      return (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-[0.75rem] font-bold text-white shrink-0" style={{ background: color }}>
            {item.initials as string}
          </div>
          <div>
            <div className="text-[0.8125rem] font-semibold text-text">{item.name as string}</div>
            <div className="text-[0.75rem] text-text-muted mt-0.5">{item.email as string}</div>
          </div>
        </div>
      );
    },
  },
  { key: 'role', label: 'Role', sortable: true },
  { key: 'team', label: 'Team', sortable: true },
  {
    key: 'status',
    label: 'Status',
    sortable: true,
    render: (item) => (
      <StatusBadge status={STATUS_MAP[item.status as UserStatus] || 'draft'} />
    ),
  },
  {
    key: 'lastLogin',
    label: 'Last Login',
    sortable: true,
    render: (item) => (
      <span className="text-[0.75rem] text-text-muted tabular-nums">{item.lastLogin as string}</span>
    ),
  },
  {
    key: 'action',
    label: '',
    sortable: false,
    align: 'right' as const,
    width: '48px',
  },
];

const AVAILABLE_ROLES = [
  { name: 'test manik role', desc: 'report not share', perms: 8, access: ['View', 'Create', 'Edit'] },
  { name: 'report', desc: 'dsg', perms: 6, access: ['View', 'Export'] },
  { name: 'last role', desc: 'nmmm', perms: 3, access: ['View'] },
  { name: 'Team Edit UI Test', desc: 'TEUT', perms: 5, access: ['View', 'Edit'] },
  { name: 'Test invite user final', desc: 'tests', perms: 4, access: ['View', 'Create'] },
  { name: '2test role per final', desc: 'final test', perms: 2, access: ['View'] },
  { name: 'test role per final67', desc: 'final tests', perms: 10, access: ['View', 'Create', 'Edit', 'Delete'] },
];

function InviteUserModal({ onClose }: { onClose: () => void }) {
  const [selectedRole, setSelectedRole] = useState(AVAILABLE_ROLES[0].name);
  const [previewRole, setPreviewRole] = useState<string | null>(null);

  return (
    <>
      <div className="fixed inset-0 bg-ink-900/40 z-40" onClick={onClose} style={{ backdropFilter: 'blur(4px)' }} />
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.97 }}
        transition={{ duration: 0.15, ease: [0.2, 0, 0, 1] }}
        className="fixed inset-0 z-50 flex items-center justify-center p-8"
        onClick={onClose}
      >
      <div className="w-[520px] max-h-[85vh] bg-paper-0 rounded-xl border border-paper-200 flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 h-14 border-b border-paper-200 shrink-0">
          <h2 className="text-[0.9375rem] font-semibold text-ink-900" style={{ fontWeight: 600 }}>Invite User</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-md flex items-center justify-center hover:bg-paper-100 transition-colors cursor-pointer text-ink-500">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          <div className="px-6 py-6 space-y-5">
            <div>
              <label className="text-[0.8125rem] text-ink-700 mb-2 block" style={{ fontWeight: 560 }}>Full Name <span className="text-risk-700">*</span></label>
              <input placeholder="Enter full name" className="w-full h-10 px-3 rounded-md border border-paper-200 bg-paper-0 text-[0.8125rem] text-ink-900 outline-none placeholder:text-ink-400 focus:border-brand-600 transition-colors" style={{ boxShadow: 'none' }} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[0.8125rem] text-ink-700 mb-2 block" style={{ fontWeight: 560 }}>Email <span className="text-risk-700">*</span></label>
                <input placeholder="Enter email address" className="w-full h-10 px-3 rounded-md border border-paper-200 bg-paper-0 text-[0.8125rem] text-ink-900 outline-none placeholder:text-ink-400 focus:border-brand-600 transition-colors" style={{ boxShadow: 'none' }} />
              </div>
              <div>
                <label className="text-[0.8125rem] text-ink-700 mb-2 block" style={{ fontWeight: 560 }}>Team <span className="text-risk-700">*</span></label>
                <div className="relative">
                  <select className="w-full h-9 px-3 rounded-md border border-border bg-white text-[0.8125rem] text-text outline-none appearance-none cursor-pointer focus:border-primary/40 transition-colors">
                    <option>Select teams</option>
                    <option>SOX Audit Team</option>
                    <option>IFC Team</option>
                    <option>Management</option>
                  </select>
                  <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none" />
                </div>
              </div>
            </div>
          </div>

          <div className="h-px bg-paper-200" />

          {/* Role selection */}
          <div className="px-6 py-5">
            <h3 className="text-[0.875rem] text-text mb-1" style={{ fontWeight: 600 }}>Initial Role</h3>
            <p className="text-[0.8125rem] text-text-muted mb-4">You can assign only one role to a user.</p>

            <div className="space-y-2.5">
              {AVAILABLE_ROLES.map(role => {
                const isSelected = selectedRole === role.name;
                return (
                  <div
                    key={role.name}
                    onClick={() => setSelectedRole(role.name)}
                    className={`rounded-lg border cursor-pointer transition-colors ${
                      isSelected ? 'border-border bg-white' : 'border-border hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center gap-3 px-4 py-3">
                      <div className={`w-[18px] h-[18px] rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                        isSelected ? 'border-brand-400' : 'border-gray-300'
                      }`}>
                        {isSelected && <div className="w-2 h-2 rounded-full bg-brand-400" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[0.8125rem] text-text" style={{ fontWeight: 600 }}>{role.name}</div>
                        <div className="text-[0.75rem] text-text-muted">{role.desc}</div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-[0.75rem] text-text-muted tabular-nums">{role.perms} permissions</span>
                        <button
                          onClick={e => { e.stopPropagation(); setPreviewRole(previewRole === role.name ? null : role.name); }}
                          className="text-[0.75rem] font-medium text-text-secondary hover:text-text cursor-pointer"
                        >
                          {previewRole === role.name ? 'Hide' : 'Details'}
                        </button>
                      </div>
                    </div>
                    {previewRole === role.name && (
                      <div className="px-4 pb-3 border-t border-border/50 mt-2 pt-2 max-h-[200px] overflow-y-auto">
                        {DETAILED_PERMISSIONS.map((group, gi) => (
                          <div key={group.group}>
                            <div className={`py-2 ${gi > 0 ? 'border-t border-border mt-1' : ''}`}>
                              <span className="text-[0.8125rem] font-semibold text-text">{group.group}</span>
                            </div>
                            {group.perms.map(p => (
                              <div key={p.key} className="flex items-center justify-between py-2 pl-3 border-t border-border/30">
                                <div>
                                  <div className="text-[0.75rem] font-medium text-text">{p.name}</div>
                                  <div className="text-[0.75rem] text-text-muted">{p.desc}</div>
                                </div>
                                <div className="w-9 h-[20px] rounded-full shrink-0 bg-brand-400 ml-3 relative">
                                  <div className="absolute top-[2px] left-[18px] w-4 h-4 rounded-full bg-white" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
                                </div>
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
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-paper-200 flex justify-end shrink-0">
          <button onClick={onClose} className="px-6 h-10 rounded-md bg-brand-600 hover:bg-brand-500 active:bg-brand-800 text-white text-[0.8125rem] transition-colors cursor-pointer" style={{ fontWeight: 600 }}>
            Invite User
          </button>
        </div>
      </div>
      </motion.div>
    </>
  );
}

const TEAM_MEMBERS = [
  { name: 'Abhinav Sharma', email: 'abhinav@irame.ai' },
  { name: 'Aditya Thakur', email: 'aditya.thakur@irame.ai' },
  { name: 'AI', email: 'ai@irame.ai' },
  { name: 'Ajay 14110008', email: 'ajay.aj@btech2014.iitgn.ac.in' },
  { name: 'ajay mudhai', email: 'ajay@irame.ai' },
  { name: 'Ajay Mudhai', email: 'ajay@irame.ai' },
  { name: 'Ayushi Narang', email: 'ayushi.narang@irame.ai' },
  { name: 'Chulbul Pandey', email: 'kuldeep.msvm@gmail.com' },
  { name: 'CS', email: 'cs@irame.ai' },
  { name: 'larobe', email: 'larobe6188@hlkes.com' },
  { name: 'Lee cheng', email: 'lecade7207@7novels.com' },
];

function CreateTeamModal({ onClose }: { onClose: () => void }) {
  const [memberSearch, setMemberSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const filtered = TEAM_MEMBERS.filter(m =>
    !memberSearch || m.name.toLowerCase().includes(memberSearch.toLowerCase()) || m.email.toLowerCase().includes(memberSearch.toLowerCase())
  );

  const toggle = (key: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  return (
    <>
      <div className="fixed inset-0 bg-ink-900/40 z-40" onClick={onClose} style={{ backdropFilter: 'blur(4px)' }} />
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.97 }}
        transition={{ duration: 0.15, ease: [0.2, 0, 0, 1] }}
        className="fixed inset-0 z-50 flex items-center justify-center p-8"
        onClick={onClose}
      >
      <div className="w-[480px] max-h-[85vh] bg-paper-0 rounded-xl border border-paper-200 flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 h-14 border-b border-paper-200 shrink-0">
          <h2 className="text-[0.9375rem] text-ink-900" style={{ fontWeight: 600 }}>Create New Team</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-md flex items-center justify-center hover:bg-paper-100 transition-colors cursor-pointer text-ink-500">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {/* Team name */}
          <div className="px-6 py-5">
            <label className="text-[0.8125rem] text-ink-700 mb-2 block" style={{ fontWeight: 560 }}>Team Name <span className="text-risk-700">*</span></label>
            <input placeholder="Enter unique team name" className="w-full h-10 px-3 rounded-md border border-paper-200 bg-paper-0 text-[0.8125rem] text-ink-900 outline-none placeholder:text-ink-400 focus:border-brand-600 transition-colors" style={{ boxShadow: 'none' }} />
          </div>

          <div className="h-px bg-paper-200" />

          {/* Members */}
          <div className="px-6 py-5">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-[0.875rem] text-ink-900" style={{ fontWeight: 600 }}>Add Team Members</h3>
              {selected.size > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-brand-50 text-[0.75rem] font-semibold text-brand-700 tabular-nums">{selected.size} selected</span>
              )}
            </div>
            <p className="text-[0.8125rem] text-ink-500 mb-4">Select users to add to this team. You can add more members later.</p>

            {/* Search */}
            <div className="flex items-center gap-2 px-3 h-10 rounded-md border border-paper-200 bg-paper-50 mb-3 focus-within:border-brand-600 transition-colors">
              <Search size={14} className="text-ink-400 shrink-0" />
              <input
                placeholder="Search by name or email"
                value={memberSearch}
                onChange={e => setMemberSearch(e.target.value)}
                className="flex-1 bg-transparent outline-none text-[0.8125rem] text-ink-900 placeholder:text-ink-400"
                style={{ boxShadow: 'none' }}
              />
            </div>

            {/* Member list */}
            <div className="border border-paper-200 rounded-lg overflow-hidden">
              {filtered.map((m, i) => {
                const key = m.email + m.name;
                const isChecked = selected.has(key);
                const initials = m.name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase();
                const color = AVATAR_COLORS[i % AVATAR_COLORS.length];
                return (
                  <div
                    key={key}
                    onClick={() => toggle(key)}
                    className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors ${i > 0 ? 'border-t border-paper-100' : ''} ${isChecked ? 'bg-brand-50' : 'hover:bg-paper-50'}`}
                  >
                    <div className={`w-4 h-4 rounded flex items-center justify-center shrink-0 transition-colors ${isChecked ? 'bg-brand-600' : 'border border-ink-300'}`}>
                      {isChecked && <svg width="8" height="6" viewBox="0 0 8 6" fill="none"><path d="M1 3L3 5L7 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                    </div>
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-[0.75rem] font-bold text-white shrink-0" style={{ background: color }}>
                      {initials}
                    </div>
                    <div className="min-w-0">
                      <div className="text-[0.8125rem] text-ink-800 truncate" style={{ fontWeight: 520 }}>{m.name}</div>
                      <div className="text-[0.75rem] text-ink-500 truncate">{m.email}</div>
                    </div>
                  </div>
                );
              })}
              {filtered.length === 0 && (
                <div className="px-4 py-8 text-center text-[0.8125rem] text-ink-400">No users match your search.</div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-paper-200 flex items-center justify-between shrink-0">
          <span className="text-[0.75rem] text-ink-500 tabular-nums">{selected.size} member{selected.size !== 1 ? 's' : ''} selected</span>
          <button onClick={onClose} className="px-6 h-10 rounded-md bg-brand-600 hover:bg-brand-500 active:bg-brand-800 text-white text-[0.8125rem] transition-colors cursor-pointer" style={{ fontWeight: 600 }}>
            Create Team
          </button>
        </div>
      </div>
      </motion.div>
    </>
  );
}

function UsersTab({ onInvite, onCreateTeam }: { onInvite: () => void; onCreateTeam: () => void }) {
  const tableData = mockUsers.map(u => ({ ...u } as MockUser & Record<string, unknown>));
  const [viewUser, setViewUser] = useState<MockUser | null>(null);
  const [editUser, setEditUser] = useState<MockUser | null>(null);
  const [teamDropdown, setTeamDropdown] = useState<string | null>(null);
  const teamDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!teamDropdown) return;
    const close = (e: MouseEvent) => { if (teamDropdownRef.current && !teamDropdownRef.current.contains(e.target as Node)) setTeamDropdown(null); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [teamDropdown]);

  type UserRow = MockUser & Record<string, unknown>;

  const columnsWithAction: Column<UserRow>[] = userColumns.map(col => {
    if (col.key === 'name') {
      return {
        ...col,
        render: (item: UserRow, i: number) => {
          const color = AVATAR_COLORS[i % AVATAR_COLORS.length];
          return (
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-[0.75rem] font-bold text-white shrink-0" style={{ background: color }}>
                {item.initials as string}
              </div>
              <div>
                <button onClick={() => setViewUser(item as unknown as MockUser)} className="text-[0.8125rem] font-semibold text-text hover:text-primary cursor-pointer text-left">{item.name as string}</button>
                <div className="text-[0.75rem] text-text-muted mt-0.5">{item.email as string}</div>
              </div>
            </div>
          );
        },
      };
    }
    if (col.key === 'role') {
      return {
        ...col,
        render: (item: UserRow) => (
          <button onClick={() => setEditUser(item as unknown as MockUser)} className="inline-flex items-center gap-1 text-[0.8125rem] text-text-secondary hover:text-primary cursor-pointer group">
            {item.role as string}
            <Pencil size={12} className="opacity-0 group-hover:opacity-100 transition-opacity" />
          </button>
        ),
      };
    }
    if (col.key === 'team') {
      return {
        ...col,
        render: (item: UserRow) => {
          const teamName = item.team as string;
          const rowId = item.email as string;
          const isOpen = teamDropdown === rowId;
          const teams = ['SOX Audit', 'IFC Team', 'Engineering', 'Management'];

          return (
            <div className="relative" ref={isOpen ? teamDropdownRef : undefined}>
              <button
                onClick={() => setTeamDropdown(isOpen ? null : rowId)}
                className={`inline-flex items-center gap-1 text-[0.8125rem] cursor-pointer transition-colors ${
                  teamName === '\u2014' ? 'text-text-muted hover:text-primary' : 'text-text-secondary hover:text-primary'
                }`}
              >
                {teamName === '\u2014' ? 'Assign team' : teamName}
                <ChevronDown size={12} className={`transition-transform ${isOpen ? 'rotate-180 text-primary' : 'opacity-0 group-hover:opacity-100'}`} />
              </button>
              {isOpen && (
                <div className="absolute left-0 top-full mt-1 w-40 bg-white rounded-md py-1 z-30" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.05)' }}>
                  {teams.map(t => (
                    <button
                      key={t}
                      onClick={() => setTeamDropdown(null)}
                      className={`w-full text-left px-3 py-1.5 text-[0.8125rem] cursor-pointer transition-colors ${
                        t === teamName ? 'text-primary font-semibold bg-primary-light' : 'text-text hover:bg-gray-50'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                  {teamName !== '\u2014' && (
                    <>
                      <div className="h-px bg-border-light my-1" />
                      <button
                        onClick={() => setTeamDropdown(null)}
                        className="w-full text-left px-3 py-1.5 text-[0.8125rem] text-red-600 hover:bg-red-50 cursor-pointer transition-colors"
                      >
                        Remove from team
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          );
        },
      };
    }
    if (col.key === 'action') {
      return {
        ...col,
        width: '130px',
        label: '',
        render: (item: UserRow) => (
          <div className="flex items-center gap-1.5">
            <button onClick={() => setViewUser(item as unknown as MockUser)} className="flex items-center gap-1 px-2.5 h-7 rounded-md border border-border text-[0.75rem] font-medium text-text-secondary bg-white hover:border-primary hover:text-primary transition-colors cursor-pointer">
              <Eye size={12} />
              View
            </button>
            <button onClick={() => setEditUser(item as unknown as MockUser)} className="flex items-center gap-1 px-2.5 h-7 rounded-md border border-border text-[0.75rem] font-medium text-text-secondary bg-white hover:border-primary hover:text-primary transition-colors cursor-pointer">
              <Pencil size={12} />
              Edit
            </button>
          </div>
        ),
      };
    }
    return col;
  });

  const [subTab, setSubTab] = useState<'users' | 'teams'>('users');
  const [editTeam, setEditTeam] = useState<{ name: string; members: string[] } | null>(null);

  // Build teams from user data
  const teamsData = (() => {
    const map: Record<string, string[]> = {};
    mockUsers.forEach(u => { if (u.team !== '\u2014') { if (!map[u.team]) map[u.team] = []; map[u.team].push(u.name); } });
    return Object.entries(map).map(([name, members]) => ({ name, members }));
  })();

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
    >
      {/* Toolbar: sub-tabs + stats + CTAs */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          {/* Sub-tab toggle */}
          <div className="flex items-center gap-0.5 bg-surface-2/50 rounded-lg p-0.5 border border-border-light">
            {([
              { key: 'users' as const, label: 'Users', count: mockUsers.length },
              { key: 'teams' as const, label: 'Teams', count: teamsData.length },
            ]).map(t => (
              <button
                key={t.key}
                onClick={() => setSubTab(t.key)}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-[0.8125rem] font-medium transition-colors cursor-pointer ${
                  subTab === t.key ? 'bg-white text-primary border border-border-light' : 'text-text-muted hover:text-text-secondary'
                }`}
              >
                {t.label}
                <span className={`text-[0.75rem] tabular-nums px-1.5 rounded-full ${
                  subTab === t.key ? 'bg-primary-light text-primary font-semibold' : 'bg-gray-100 text-text-muted'
                }`}>{t.count}</span>
              </button>
            ))}
          </div>

          <span className="w-px h-5 bg-border" />

          {/* Stats */}
          {[
            { label: 'Active', count: mockUsers.filter(u => u.status === 'Active').length, text: 'text-emerald-700' },
            { label: 'Invited', count: mockUsers.filter(u => u.status === 'Invited').length, text: 'text-blue-700' },
            { label: 'Suspended', count: mockUsers.filter(u => u.status === 'Suspended').length, text: 'text-orange-700' },
            { label: 'Inactive', count: mockUsers.filter(u => u.status === 'Inactive' || u.status === 'Locked').length, text: 'text-gray-500' },
          ].filter(s => s.count > 0).map(s => (
            <span key={s.label} className={`text-[0.75rem] font-medium ${s.text} tabular-nums`}>
              {s.label}: {s.count}
            </span>
          ))}
        </div>

        {/* CTAs */}
        <div className="flex items-center gap-2">
          <button onClick={onCreateTeam} className="flex items-center gap-2 px-4 h-8 rounded-md border border-border bg-white text-[0.8125rem] font-medium text-text-secondary hover:bg-gray-50 transition-colors cursor-pointer">
            <Plus size={13} />
            Create Team
          </button>
          <button onClick={onInvite} className="flex items-center gap-2 px-4 h-8 rounded-md bg-primary hover:bg-primary-hover text-white text-[0.8125rem] font-semibold transition-colors cursor-pointer">
            <UserPlus size={13} />
            Invite User
          </button>
        </div>
      </div>

      {subTab === 'users' ? (
        <>
          <SmartTable
            columns={columnsWithAction}
            data={tableData}
            keyField="email"
            searchable
            searchPlaceholder="Search by name or email..."
            searchKeys={['name', 'email', 'role', 'team']}
            paginated
            pageSize={10}
            emptyMessage="No users match your search."
          />
          {viewUser && <ViewUserModal user={viewUser} onClose={() => setViewUser(null)} />}
          {editUser && <EditUserModal user={editUser} onClose={() => setEditUser(null)} />}
        </>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-4">
            {teamsData.map(team => (
              <div
                key={team.name}
                className="bg-white rounded-lg border border-border-light p-5 hover:border-primary/30 transition-colors cursor-pointer"
                onClick={() => setEditTeam(team)}
              >
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-[0.875rem] font-semibold text-text">{team.name}</h3>
                  <button
                    onClick={e => { e.stopPropagation(); setEditTeam(team); }}
                    className="p-1 rounded hover:bg-gray-100 transition-colors cursor-pointer text-text-muted hover:text-primary"
                    title="Edit team"
                  >
                    <Pencil size={13} />
                  </button>
                </div>
                <div className="text-[0.75rem] text-text-muted mb-3 tabular-nums">{team.members.length} member{team.members.length !== 1 ? 's' : ''}</div>
                <div className="flex items-center -space-x-2">
                  {team.members.slice(0, 5).map((m, i) => {
                    const initials = m.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase();
                    return (
                      <div key={i} className="w-7 h-7 rounded-full flex items-center justify-center text-[0.75rem] font-bold text-white border-2 border-white" style={{ background: AVATAR_COLORS[i % AVATAR_COLORS.length] }}>
                        {initials}
                      </div>
                    );
                  })}
                  {team.members.length > 5 && (
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-[0.75rem] font-semibold text-text-muted bg-gray-100 border-2 border-white tabular-nums">
                      +{team.members.length - 5}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Edit Team Modal */}
          {editTeam && (
            <EditTeamModal team={editTeam} onClose={() => setEditTeam(null)} />
          )}
        </>
      )}
    </motion.div>
  );
}

function EditTeamModal({ team, onClose }: { team: { name: string; members: string[] }; onClose: () => void }) {
  const [memberSearch, setMemberSearch] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  const allUsers = mockUsers.map(u => u.name);
  const [members, setMembers] = useState<Set<string>>(new Set(team.members));

  const filtered = allUsers.filter(name =>
    !memberSearch || name.toLowerCase().includes(memberSearch.toLowerCase())
  );

  const toggle = (name: string) => {
    setMembers(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.97 }}
        transition={{ duration: 0.15, ease: [0.2, 0, 0, 1] }}
        className="fixed inset-0 z-50 flex items-center justify-center p-8" onClick={onClose}
      >
      <div className="w-[460px] max-h-[80vh] bg-white rounded-lg border border-border-light flex flex-col" style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.12)' }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 h-12 border-b border-border-light shrink-0">
          <h2 className="text-[0.875rem] font-semibold text-text">Edit Team</h2>
          <button onClick={onClose} className="w-7 h-7 rounded flex items-center justify-center hover:bg-gray-100 transition-colors cursor-pointer text-text-muted">
            <X size={15} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="px-6 py-5">
            <label className="text-[0.8125rem] font-medium text-text mb-1.5 block">Team Name</label>
            <input defaultValue={team.name} className="w-full h-9 px-3 rounded-md border border-border bg-white text-[0.8125rem] text-text outline-none focus:border-primary/40 transition-colors" />
          </div>

          <div className="h-px bg-border-light" />

          <div className="px-6 py-5">
            <div className="flex items-center justify-between mb-1">
              <label className="text-[0.8125rem] font-medium text-text">Members</label>
              <span className="text-[0.75rem] text-text-muted tabular-nums">{members.size} selected</span>
            </div>
            <p className="text-[0.75rem] text-text-muted mb-3">Add or remove members from this team.</p>

            <div className="flex items-center gap-2 px-3 h-9 rounded-md border border-border bg-surface-2/30 mb-3 focus-within:border-primary/50 transition-colors">
              <Search size={13} className="text-text-muted shrink-0" />
              <input
                placeholder="Search members"
                value={memberSearch}
                onChange={e => setMemberSearch(e.target.value)}
                className="flex-1 bg-transparent outline-none text-[0.8125rem] text-text placeholder:text-text-muted"
              />
            </div>

            <div className="border border-border-light rounded-md overflow-hidden max-h-[240px] overflow-y-auto">
              {filtered.map((name, i) => {
                const isIn = members.has(name);
                const initials = name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase();
                return (
                  <div
                    key={name + i}
                    onClick={() => toggle(name)}
                    className={`flex items-center gap-3 px-3 py-2 cursor-pointer transition-colors ${i > 0 ? 'border-t border-border-light/60' : ''} ${isIn ? 'bg-primary-light/50' : 'hover:bg-gray-50'}`}
                  >
                    <div className={`w-4 h-4 rounded flex items-center justify-center shrink-0 transition-colors ${isIn ? 'bg-primary' : 'border border-gray-300'}`}>
                      {isIn && <svg width="8" height="6" viewBox="0 0 8 6" fill="none"><path d="M1 3L3 5L7 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                    </div>
                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-[0.75rem] font-bold text-white shrink-0" style={{ background: AVATAR_COLORS[i % AVATAR_COLORS.length] }}>
                      {initials}
                    </div>
                    <span className="text-[0.8125rem] text-text">{name}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="px-6 py-3 border-t border-border-light shrink-0">
          {deleteConfirm ? (
            <div>
              <p className="text-[0.8125rem] text-text mb-3">Are you sure you want to delete team <span className="font-semibold">{team.name}</span>? Members will be unassigned.</p>
              <div className="flex items-center justify-end gap-2">
                <button onClick={() => setDeleteConfirm(false)} className="px-4 h-8 rounded-md border border-border text-[0.8125rem] font-medium text-text-secondary hover:bg-gray-50 transition-colors cursor-pointer">
                  Cancel
                </button>
                <button onClick={onClose} className="flex items-center gap-1.5 px-4 h-8 rounded-md bg-red-600 hover:bg-red-700 text-white text-[0.8125rem] font-semibold transition-colors cursor-pointer">
                  <Trash2 size={13} />
                  Delete Team
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <button onClick={() => setDeleteConfirm(true)} className="flex items-center gap-1.5 px-3 h-8 rounded-md text-[0.8125rem] font-medium text-red-600 hover:bg-red-50 transition-colors cursor-pointer">
                <Trash2 size={13} />
                Delete Team
              </button>
              <div className="flex items-center gap-2">
                <button onClick={onClose} className="px-4 h-8 rounded-md border border-border text-[0.8125rem] font-medium text-text-secondary hover:bg-gray-50 transition-colors cursor-pointer">
                  Cancel
                </button>
                <button onClick={onClose} className="px-5 h-8 rounded-md bg-primary hover:bg-primary-hover text-white text-[0.8125rem] font-semibold transition-colors cursor-pointer">
                  Save Changes
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
      </motion.div>
    </>
  );
}

interface MockRole {
  name: string;
  users: number;
  createdBy: string;
  type: 'System' | 'Custom';
  permissions: number;
  lastModified: string;
}

/* ── View Role Modal ── */
function ViewRoleModal({ role, onClose }: { role: MockRole; onClose: () => void }) {
  // Simulate enabled permissions based on role
  const allKeys = DETAILED_PERMISSIONS.flatMap(g => g.perms.map(p => p.key));
  const viewKeys = DETAILED_PERMISSIONS.flatMap(g => g.perms.length > 0 ? [g.perms[0].key] : []);
  const rolePerms = role.name === 'System Admin'
    ? allKeys
    : role.name === 'Enabler'
    ? allKeys.filter((_, i) => i % 2 === 0 || i < 10) // ~half permissions
    : viewKeys; // view-only for others

  const enabledSet = new Set(rolePerms);

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.97 }}
        transition={{ duration: 0.15, ease: [0.2, 0, 0, 1] }}
        className="fixed inset-0 z-50 flex items-center justify-center p-6" onClick={onClose}
      >
      <div className="w-[580px] max-h-[85vh] bg-white rounded-lg border border-border flex flex-col" style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.12)' }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 h-12 border-b border-border shrink-0">
          <h2 className="text-[0.875rem] font-semibold text-text">Role Details</h2>
          <button onClick={onClose} className="w-7 h-7 rounded flex items-center justify-center hover:bg-gray-100 transition-colors cursor-pointer text-text-muted">
            <X size={15} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Role info */}
          <div className="px-6 py-5 border-b border-border">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[1rem] font-semibold text-text">{role.name}</h3>
              <span className="px-2.5 py-1 rounded-full bg-primary-light text-[0.75rem] font-semibold text-primary tabular-nums">{role.users} users</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-[0.75rem] text-text-muted mb-0.5">Created By</div>
                <div className="text-[0.8125rem] text-text">{role.createdBy}</div>
              </div>
              <div>
                <div className="text-[0.75rem] text-text-muted mb-0.5">Permissions</div>
                <div className="text-[0.8125rem] text-text tabular-nums">{enabledSet.size} enabled</div>
              </div>
            </div>
          </div>

          {/* Permissions (read-only) */}
          <div className="px-6 py-5">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-[0.8125rem] font-semibold text-text">Permissions</h4>
              <span className="text-[0.75rem] text-text-muted tabular-nums">{enabledSet.size} enabled</span>
            </div>
            <div>
              {DETAILED_PERMISSIONS.map((group, gi) => (
                <div key={group.group}>
                  <div className={`py-2.5 ${gi > 0 ? 'border-t border-border mt-1' : ''}`}>
                    <span className="text-[0.8125rem] font-semibold text-text">{group.group}</span>
                  </div>
                  {group.perms.map(perm => {
                    const isOn = enabledSet.has(perm.key);
                    return (
                      <div key={perm.key} className="flex items-center justify-between py-2.5 pl-3 border-t border-border/30">
                        <div>
                          <div className="text-[0.8125rem] font-medium text-text">{perm.name}</div>
                          <div className="text-[0.75rem] text-text-muted">{perm.desc}</div>
                        </div>
                        <div className={`w-10 h-[22px] rounded-full shrink-0 ml-4 relative ${isOn ? 'bg-brand-400' : 'bg-gray-200'}`}>
                          <div className={`absolute top-[3px] w-4 h-4 rounded-full bg-white ${isOn ? 'left-[22px]' : 'left-[3px]'}`} style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="px-6 py-3 border-t border-border flex justify-end shrink-0">
          <button onClick={onClose} className="px-4 h-8 rounded-md border border-border text-[0.8125rem] font-medium text-text-secondary hover:bg-gray-50 transition-colors cursor-pointer">
            Close
          </button>
        </div>
      </div>
      </motion.div>
    </>
  );
}

const mockRoles: MockRole[] = [
  { name: 'System Admin', users: 2, createdBy: 'System', type: 'System', permissions: 48, lastModified: 'Jan 10, 2026' },
  { name: 'Enabler', users: 14, createdBy: 'System', type: 'System', permissions: 30, lastModified: 'Feb 05, 2026' },
  { name: 'Auditor', users: 0, createdBy: 'System', type: 'System', permissions: 22, lastModified: 'Jan 10, 2026' },
  { name: 'Risk Owner', users: 0, createdBy: 'System', type: 'System', permissions: 15, lastModified: 'Jan 10, 2026' },
  { name: 'test manik role', users: 0, createdBy: 'Tushar Goel', type: 'Custom', permissions: 8, lastModified: 'Apr 18, 2026' },
  { name: 'report', users: 0, createdBy: 'Tushar Goel', type: 'Custom', permissions: 6, lastModified: 'Apr 15, 2026' },
  { name: 'last role', users: 0, createdBy: 'Tushar Goel', type: 'Custom', permissions: 3, lastModified: 'Apr 12, 2026' },
  { name: 'Team Edit UI Test', users: 0, createdBy: 'Tushar Goel', type: 'Custom', permissions: 5, lastModified: 'Apr 10, 2026' },
  { name: 'Test invite user final', users: 0, createdBy: 'Tushar Goel', type: 'Custom', permissions: 4, lastModified: 'Apr 08, 2026' },
  { name: '2test role per final', users: 0, createdBy: 'Tushar Goel', type: 'Custom', permissions: 2, lastModified: 'Apr 05, 2026' },
];

const roleColumns: Column<MockRole & Record<string, unknown>>[] = [
  {
    key: 'name',
    label: 'Role Name',
    sortable: true,
    width: '25%',
    render: (item) => (
      <div className="flex items-center gap-2.5">
        <div className={`w-7 h-7 rounded flex items-center justify-center shrink-0 ${item.type === 'System' ? 'bg-primary-light' : 'bg-gray-100'}`}>
          <Shield size={13} className={item.type === 'System' ? 'text-primary' : 'text-text-muted'} />
        </div>
        <span className="text-[0.8125rem] font-medium text-text">{item.name as string}</span>
      </div>
    ),
  },
  {
    key: 'type',
    label: 'Type',
    sortable: true,
    width: '12%',
    render: (item) => (
      <span className={`inline-flex px-2 py-0.5 rounded-full text-[0.75rem] font-medium ${
        item.type === 'System' ? 'bg-blue-50 text-blue-700' : 'bg-gray-100 text-text-secondary'
      }`}>{item.type as string}</span>
    ),
  },
  {
    key: 'users',
    label: 'Users',
    sortable: true,
    width: '10%',
    render: (item) => (
      <span className="text-[0.8125rem] tabular-nums text-text">{item.users as number}</span>
    ),
  },
  {
    key: 'permissions',
    label: 'Permissions',
    sortable: true,
    width: '14%',
    render: (item) => (
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1.5 rounded-full bg-gray-100 max-w-[60px]">
          <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, ((item.permissions as number) / 48) * 100)}%` }} />
        </div>
        <span className="text-[0.75rem] tabular-nums text-text-muted">{item.permissions as number}</span>
      </div>
    ),
  },
  {
    key: 'createdBy',
    label: 'Created By',
    sortable: true,
    width: '18%',
  },
  {
    key: 'lastModified',
    label: 'Last Modified',
    sortable: true,
    width: '14%',
    render: (item) => (
      <span className="text-[0.75rem] text-text-muted tabular-nums">{item.lastModified as string}</span>
    ),
  },
  {
    key: 'action',
    label: 'Quick Actions',
    sortable: false,
    align: 'right' as const,
    width: '140px',
  },
];

function RolesTab({ onCreateRole }: { onCreateRole: () => void }) {
  const tableData = mockRoles.map(r => ({ ...r } as MockRole & Record<string, unknown>));
  const [viewRole, setViewRole] = useState<MockRole | null>(null);
  const [duplicateRole, setDuplicateRole] = useState(false);

  type RoleRow = MockRole & Record<string, unknown>;

  const columnsWithAction = roleColumns.map(col => {
    if (col.key === 'name') {
      return {
        ...col,
        render: (item: RoleRow) => (
          <div className="flex items-center gap-2.5">
            <div className={`w-7 h-7 rounded flex items-center justify-center shrink-0 ${item.type === 'System' ? 'bg-primary-light' : 'bg-gray-100'}`}>
              <Shield size={13} className={item.type === 'System' ? 'text-primary' : 'text-text-muted'} />
            </div>
            <button onClick={() => setViewRole(item as unknown as MockRole)} className="text-[0.8125rem] font-medium text-text hover:text-primary cursor-pointer text-left">{item.name as string}</button>
          </div>
        ),
      };
    }
    if (col.key === 'action') {
      return {
        ...col,
        width: '190px',
        render: (item: RoleRow) => (
          <div className="flex items-center gap-1.5">
            <button onClick={() => setViewRole(item as unknown as MockRole)} className="flex items-center gap-1 px-2.5 h-7 rounded-md border border-border text-[0.75rem] font-medium text-text-secondary bg-white hover:border-primary hover:text-primary transition-colors cursor-pointer">
              <Eye size={12} />
              View
            </button>
            <button onClick={() => { setDuplicateRole(true); onCreateRole(); }} className="flex items-center gap-1 px-2.5 h-7 rounded-md border border-border text-[0.75rem] font-medium text-text-secondary bg-white hover:border-primary hover:text-primary transition-colors cursor-pointer">
              <CopyPlus size={12} />
              Duplicate
            </button>
            <button onClick={() => navigator.clipboard.writeText(item.name as string)} title="Copy Role ID" className="flex items-center justify-center w-7 h-7 rounded-md border border-border text-text-muted bg-white hover:border-primary hover:text-primary transition-colors cursor-pointer">
              <Copy size={12} />
            </button>
          </div>
        ),
      };
    }
    return col;
  });

  void duplicateRole;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
    >
      <SmartTable
        columns={columnsWithAction}
        data={tableData}
        keyField="name"
        searchable
        searchPlaceholder="Search..."
        searchKeys={['name', 'createdBy']}
        paginated
        pageSize={10}
        emptyMessage="No roles found."
      />
      {viewRole && <ViewRoleModal role={viewRole} onClose={() => setViewRole(null)} />}
    </motion.div>
  );
}

// Using DETAILED_PERMISSIONS for all permission UI

// Detailed permission structure matching the real platform
const DETAILED_PERMISSIONS = [
  { group: 'Business Process', perms: [
    { key: 'bp_view', name: 'View', desc: 'View business process and their details' },
    { key: 'bp_create', name: 'Create and Update', desc: 'Build and updates business processes' },
    { key: 'bp_delete', name: 'Delete', desc: 'Remove workflows permanently' },
    { key: 'bp_share', name: 'Sharing Permission', desc: 'Share with specific users and team' },
  ]},
  { group: 'Workflows', perms: [
    { key: 'wf_view', name: 'View', desc: 'View workflow & their details' },
    { key: 'wf_create', name: 'Create', desc: 'Create a copy of the workflow' },
    { key: 'wf_update_delete', name: 'Update & Delete', desc: 'Modify the existing workflows' },
    { key: 'wf_output', name: 'View Output', desc: 'Preview and download generated outputs' },
    { key: 'wf_run', name: 'Run', desc: 'Distribute the workflows with team members' },
    { key: 'wf_upload', name: 'Upload Data', desc: 'Add workflows from external sources' },
  ]},
  { group: 'Reports', perms: [
    { key: 'rp_view', name: 'View', desc: 'Create new queries to streamline data retrieval' },
    { key: 'rp_edit', name: 'Edit/Update', desc: 'Update report structure and content' },
    { key: 'rp_comment', name: 'Comment on Queries', desc: 'Add comments and attach proofs to queries' },
    { key: 'rp_share', name: 'Share', desc: 'Share reports for review and collaboration' },
    { key: 'rp_delete', name: 'Delete Queries', desc: 'Remove existing queries' },
  ]},
  { group: 'Dashboard', perms: [
    { key: 'db_view', name: 'View', desc: 'View dashboards and insights' },
    { key: 'db_add', name: 'Add Queries', desc: 'Add queries to dashboards' },
    { key: 'db_share', name: 'Share Queries', desc: 'Share queries for team access and collaboration' },
    { key: 'db_delete', name: 'Delete Queries', desc: 'Delete dashboard permanently' },
    { key: 'db_comment', name: 'Comment on Queries', desc: 'Comment on dashboard outputs and insights' },
  ]},
  { group: 'Datasource', perms: [
    { key: 'ds_upload', name: 'Manually Upload', desc: 'Upload data files manually' },
    { key: 'ds_live', name: 'Live Datasource List', desc: 'View active data sources' },
  ]},
  { group: 'Admin', perms: [
    { key: 'ad_logs', name: 'Compliance Logs', desc: 'Viewing compliance-related logs and audit trails' },
    { key: 'ad_tech', name: 'Tech Specialist', desc: 'Supports system troubleshooting and optimization' },
  ]},
];

function CreateRoleModal({ onClose }: { onClose: () => void }) {
  const [enabled, setEnabled] = useState<Set<string>>(new Set());
  const totalPerms = DETAILED_PERMISSIONS.reduce((s, g) => s + g.perms.length, 0);

  const togglePerm = (key: string) => {
    setEnabled(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });
  };

  void 0; // toggleGroup removed — individual toggles only

  const applyPreset = (preset: 'none' | 'readonly' | 'full') => {
    if (preset === 'none') { setEnabled(new Set()); return; }
    const n = new Set<string>();
    DETAILED_PERMISSIONS.forEach(g => {
      if (preset === 'full') g.perms.forEach(p => n.add(p.key));
      else if (g.perms[0]) n.add(g.perms[0].key); // first perm is usually "View"
    });
    setEnabled(n);
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.97 }}
        transition={{ duration: 0.15, ease: [0.2, 0, 0, 1] }}
        className="fixed inset-0 z-50 flex items-center justify-center p-6" onClick={onClose}
      >
      <div className="w-[520px] max-h-[90vh] bg-white rounded-lg border border-border flex flex-col" style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.12)' }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 h-12 border-b border-border shrink-0">
          <h2 className="text-[0.875rem] font-semibold text-text">Create New Role</h2>
          <button onClick={onClose} className="w-7 h-7 rounded flex items-center justify-center hover:bg-gray-100 transition-colors cursor-pointer text-text-muted">
            <X size={15} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="px-6 py-5 space-y-4">
            <div>
              <label className="text-[0.8125rem] font-medium text-text mb-1.5 block">Role Name <span className="text-red-500">*</span></label>
              <input placeholder="Enter role name" className="w-full h-9 px-3 rounded-md border border-border bg-white text-[0.8125rem] text-text outline-none focus:border-primary/40 transition-colors" />
            </div>
            <div>
              <label className="text-[0.8125rem] font-medium text-text mb-1.5 block">Description <span className="text-red-500">*</span></label>
              <textarea placeholder="Enter a description..." rows={2} className="w-full px-3 py-2 rounded-md border border-border bg-white text-[0.8125rem] text-text outline-none resize-none focus:border-primary/40 transition-colors" />
            </div>
          </div>

          <div className="h-px bg-border" />

          <div className="px-6 py-5">
            {/* Header with progress */}
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[0.875rem] font-semibold text-text">Set permissions for this role</h3>
              <div className="flex items-center gap-1.5">
                <button onClick={() => applyPreset('none')} className={`px-2.5 py-1 rounded-full text-[0.75rem] font-medium transition-colors cursor-pointer ${enabled.size === 0 ? 'bg-primary-light text-primary' : 'text-text-muted hover:bg-gray-50'}`}>None</button>
                <button onClick={() => applyPreset('readonly')} className="px-2.5 py-1 rounded-full text-[0.75rem] font-medium text-text-muted hover:bg-gray-50 transition-colors cursor-pointer">View Only</button>
                <button onClick={() => applyPreset('full')} className={`px-2.5 py-1 rounded-full text-[0.75rem] font-medium transition-colors cursor-pointer ${enabled.size === totalPerms ? 'bg-primary-light text-primary' : 'text-text-muted hover:bg-gray-50'}`}>Full Access</button>
              </div>
            </div>

            {/* Progress bar */}
            <div className="flex items-center gap-3 mb-4">
              <div className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                <div className="h-full rounded-full bg-primary transition-all duration-200" style={{ width: `${(enabled.size / totalPerms) * 100}%` }} />
              </div>
              <span className="text-[0.75rem] text-text-muted tabular-nums shrink-0">{enabled.size}/{totalPerms}</span>
            </div>

            {/* Permission groups */}
            <div>
              {DETAILED_PERMISSIONS.map((group, gi) => (
                <div key={group.group}>
                  {/* Group header */}
                  <div className={`flex items-center justify-between py-3 ${gi > 0 ? 'border-t border-border mt-2' : ''}`}>
                    <span className="text-[0.875rem] font-semibold text-text">{group.group}</span>
                  </div>
                  {/* Permissions */}
                  {group.perms.map(perm => {
                    const isOn = enabled.has(perm.key);
                    return (
                      <div
                        key={perm.key}
                        onClick={() => togglePerm(perm.key)}
                        className="flex items-center justify-between py-3 pl-3 border-t border-border/50 cursor-pointer"
                      >
                        <div className="min-w-0">
                          <div className="text-[0.8125rem] font-medium text-text">{perm.name}</div>
                          <div className="text-[0.75rem] text-text-muted">{perm.desc}</div>
                        </div>
                        <div className={`w-10 h-[22px] rounded-full transition-colors shrink-0 ml-4 relative ${isOn ? 'bg-brand-400' : 'bg-gray-200'}`}>
                          <div className={`absolute top-[3px] w-4 h-4 rounded-full bg-white transition-transform ${isOn ? 'left-[22px]' : 'left-[3px]'}`} style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="px-6 py-3 border-t border-border shrink-0">
          <div className="flex items-center gap-2 mb-3 text-[0.75rem] text-text-muted">
            <Info size={13} className="shrink-0" />
            These permissions can be modified later from the role edit page.
          </div>
          <div className="flex items-center justify-end">
            <button onClick={onClose} className="px-5 h-8 rounded-md bg-primary hover:bg-primary-hover text-white text-[0.8125rem] font-semibold transition-colors cursor-pointer">
              Create Role
            </button>
          </div>
        </div>
      </div>
      </motion.div>
    </>
  );
}

interface AuditLog {
  timestamp: string;
  user: string;
  action: 'Create' | 'Update' | 'Delete' | 'Login' | 'Export';
  description: string;
  module: string;
  entity: string;
  status: 'Success' | 'Failed';
  ip: string;
}

const mockLogs: AuditLog[] = [
  { timestamp: '2026-04-19 10:30:50', user: 'Abhinav Sharma', action: 'Update', description: 'Updated business process "Procure to Pay" status to Active', module: 'Process Hub', entity: 'Business Process', status: 'Success', ip: '172.18.0.1' },
  { timestamp: '2026-04-19 09:14:22', user: 'Abhinav Sharma', action: 'Login', description: 'User logged in via SSO', module: 'Admin', entity: 'Session', status: 'Success', ip: '172.18.0.1' },
  { timestamp: '2026-04-18 14:22:11', user: 'Tushar Goel', action: 'Create', description: 'Created new role "test manik role" with 8 permissions', module: 'Admin', entity: 'Role', status: 'Success', ip: '172.18.0.1' },
  { timestamp: '2026-04-18 09:15:33', user: 'Aditya Thakur', action: 'Delete', description: 'Deleted workflow "Legacy Invoice Check" from P2P', module: 'Workflow Library', entity: 'Workflow', status: 'Success', ip: '10.0.0.42' },
  { timestamp: '2026-04-17 16:45:02', user: 'Tushar Goel', action: 'Update', description: 'Updated control "SOD Violation Detector" effectiveness to 92%', module: 'Control Library', entity: 'Control', status: 'Success', ip: '172.18.0.1' },
  { timestamp: '2026-04-17 11:08:19', user: 'Aditya Thakur', action: 'Create', description: 'Created risk "Vendor master unauthorized change" in P2P register', module: 'Risk Register', entity: 'Risk', status: 'Success', ip: '10.0.0.42' },
  { timestamp: '2026-04-17 08:30:00', user: 'Ayushi Narang', action: 'Export', description: 'Exported SOX Compliance Report as PDF', module: 'Report', entity: 'Report', status: 'Success', ip: '172.18.0.1' },
  { timestamp: '2026-04-16 15:20:41', user: 'Tushar Goel', action: 'Update', description: 'Changed user "Chulbul Pandey" status from Active to Suspended', module: 'Admin', entity: 'User', status: 'Success', ip: '172.18.0.1' },
  { timestamp: '2026-04-16 10:05:33', user: 'Unknown', action: 'Login', description: 'Failed login attempt with email admin@irame.ai', module: 'Admin', entity: 'Session', status: 'Failed', ip: '185.42.12.8' },
  { timestamp: '2026-04-15 14:12:09', user: 'Ajay Mudhai', action: 'Create', description: 'Connected new data source "SAP ERP Production"', module: 'Knowledge Hub', entity: 'Data Source', status: 'Success', ip: '172.18.0.1' },
];

// Action styles handled by StatusBadge

const logColumns: Column<AuditLog & Record<string, unknown>>[] = [
  {
    key: 'timestamp',
    label: 'Timestamp',
    sortable: true,
    width: '15%',
    render: (item) => (
      <span className="font-mono text-[0.75rem] text-text-secondary tabular-nums">{item.timestamp as string}</span>
    ),
  },
  {
    key: 'user',
    label: 'Performed By',
    sortable: true,
    width: '13%',
    render: (item) => (
      <span className={`text-[0.8125rem] ${item.user === 'Unknown' ? 'text-red-500 italic' : 'font-medium text-text'}`}>{item.user as string}</span>
    ),
  },
  {
    key: 'action',
    label: 'Action',
    sortable: true,
    width: '8%',
    render: (item) => (
      <StatusBadge status={
        item.action === 'Create' ? 'active' :
        item.action === 'Update' ? 'in-progress' :
        item.action === 'Delete' ? 'open' :
        item.action === 'Login' ? 'invited' :
        'draft'
      } />
    ),
  },
  {
    key: 'description',
    label: 'Activity',
    sortable: false,
    width: '36%',
    render: (item) => (
      <div>
        <div className="text-[0.8125rem] text-text">{item.description as string}</div>
        <div className="text-[0.75rem] text-text-muted mt-0.5">{item.module as string} / {item.entity as string}</div>
      </div>
    ),
  },
  {
    key: 'status',
    label: 'Result',
    sortable: true,
    width: '8%',
    render: (item) => (
      <StatusBadge status={item.status === 'Success' ? 'active' : 'open'} />
    ),
  },
];

function AuditLogsTab() {
  const tableData = mockLogs.map(l => ({ ...l } as AuditLog & Record<string, unknown>));
  const [actionFilter, setActionFilter] = useState('all');
  const [resultFilter, setResultFilter] = useState('all');
  const [userFilter, setUserFilter] = useState('all');

  const uniqueUsers = [...new Set(mockLogs.map(l => l.user))];

  const filtered = tableData.filter(l => {
    if (actionFilter !== 'all' && l.action !== actionFilter) return false;
    if (resultFilter !== 'all' && l.status !== resultFilter) return false;
    if (userFilter !== 'all' && l.user !== userFilter) return false;
    return true;
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
    >
      {/* Filters */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex items-center gap-2 text-[0.8125rem] text-text-muted">
          <Filter size={13} />
          Filters
        </div>
        <div className="relative">
          <select value={userFilter} onChange={e => setUserFilter(e.target.value)} className="h-9 pl-3 pr-8 rounded-md border border-border bg-white text-[0.8125rem] text-text outline-none appearance-none cursor-pointer focus:border-primary/40 transition-colors">
            <option value="all">All Users</option>
            {uniqueUsers.map(u => <option key={u} value={u}>{u}</option>)}
          </select>
          <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
        </div>
        <div className="relative">
          <select value={actionFilter} onChange={e => setActionFilter(e.target.value)} className="h-9 pl-3 pr-8 rounded-md border border-border bg-white text-[0.8125rem] text-text outline-none appearance-none cursor-pointer focus:border-primary/40 transition-colors">
            <option value="all">All Actions</option>
            <option value="Create">Create</option>
            <option value="Update">Update</option>
            <option value="Delete">Delete</option>
            <option value="Login">Login</option>
            <option value="Export">Export</option>
          </select>
          <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
        </div>
        <div className="relative">
          <select value={resultFilter} onChange={e => setResultFilter(e.target.value)} className="h-9 pl-3 pr-8 rounded-md border border-border bg-white text-[0.8125rem] text-text outline-none appearance-none cursor-pointer focus:border-primary/40 transition-colors">
            <option value="all">All Results</option>
            <option value="Success">Success</option>
            <option value="Failed">Failed</option>
          </select>
          <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
        </div>
        <input type="date" className="h-9 px-3 rounded-md border border-border bg-white text-[0.8125rem] text-text outline-none cursor-pointer focus:border-primary/40 transition-colors" />
        <span className="text-[0.75rem] text-text-muted">to</span>
        <input type="date" className="h-9 px-3 rounded-md border border-border bg-white text-[0.8125rem] text-text outline-none cursor-pointer focus:border-primary/40 transition-colors" />
      </div>

      <SmartTable
        columns={logColumns}
        data={filtered}
        keyField="timestamp"
        searchable
        searchPlaceholder="Search logs..."
        searchKeys={['user', 'description', 'module', 'entity']}
        paginated
        pageSize={10}
        emptyMessage="No audit logs match your filters."
      />
    </motion.div>
  );
}

function ComingSoonTab({ tab }: { tab: Tab }) {
  const Icon = tab.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
      className="flex flex-col items-center justify-center py-24"
    >
      <div className="w-14 h-14 rounded-xl bg-brand-50 border border-brand-100 flex items-center justify-center mb-4">
        <Icon size={24} className="text-brand-500" />
      </div>
      <h3 className="text-[1.125rem] font-semibold text-ink-800 mb-2">{tab.label}</h3>
      <p className="text-[0.8125rem] text-ink-500 mb-4">This section is under development.</p>
      <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-50 border border-brand-100">
        <Construction size={14} className="text-brand-500" />
        <span className="text-[0.75rem] font-semibold text-brand-700">Coming soon</span>
      </div>
    </motion.div>
  );
}

export default function AdminView({ activeTab }: Props) {
  const resolveInitialTab = (): TabId => {
    if (activeTab === 'roles') return 'roles';
    if (activeTab === 'settings') return 'settings';
    if (activeTab === 'integrations') return 'integrations';
    if (activeTab === 'logs') return 'logs';
    return 'users';
  };

  const [currentTab, setCurrentTab] = useState<TabId>(resolveInitialTab);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [createTeamOpen, setCreateTeamOpen] = useState(false);
  const [createRoleOpen, setCreateRoleOpen] = useState(false);
  const activeTabObj = tabs.find((t) => t.id === currentTab)!;

  return (
    <div className="h-full overflow-y-auto relative" style={{ background: 'linear-gradient(180deg, #f8f5ff 0%, #fafafa 300px)' }}>
      {/* Hero header */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#f3ecff] via-[#faf8ff] to-[#eee8f9]" />
        <FloatingLines enabledWaves={['top', 'middle']} lineCount={4} lineDistance={6} bendRadius={4} bendStrength={-0.3} interactive={true} parallax={true} color="#6a12cd" opacity={0.04} />

        <div className="relative px-10 pt-10 pb-6">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="flex items-center gap-3 mb-1">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-purple-500/20">
                <Settings size={20} className="text-white" />
              </div>
              <div>
                <h1 className="text-[1.75rem] font-extrabold">
                  <span className="ai-gradient-text">Administration</span>
                </h1>
                <p className="text-[0.875rem] text-text-secondary leading-relaxed">
                  Manage users, teams, roles, and platform settings.
                </p>
              </div>
            </div>
          </motion.div>

          {/* Pill tabs + stats */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
            className="mt-6 flex items-center justify-between"
          >
          <div
            className="flex items-center gap-1 bg-white/60 backdrop-blur-xl rounded-xl border border-white/70 p-1 shadow-sm w-fit"
            style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 0 0 1px rgba(0,0,0,0.02)' }}
          >
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = currentTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setCurrentTab(tab.id)}
                  className={`relative flex items-center gap-2 px-4 py-2 rounded-lg text-[0.75rem] font-semibold transition-all cursor-pointer ${
                    isActive
                      ? 'text-violet-700'
                      : 'text-text-muted hover:text-text-secondary hover:bg-white/60'
                  }`}
                >
                  {isActive && (
                    <motion.div
                      layoutId="admin-tab-bg"
                      className="absolute inset-0 bg-white rounded-lg shadow-sm border border-violet-100/60"
                      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                    />
                  )}
                  <span className="relative z-10 flex items-center gap-2">
                    <Icon size={14} />
                    {tab.label}
                  </span>
                </button>
              );
            })}
          </div>

          </motion.div>
        </div>
      </div>

      {/* Contextual action bar */}
      <div className="px-10 pt-4 pb-2">
        {currentTab === 'users' ? (
          <div />
        ) : currentTab === 'roles' ? (
          <div className="flex items-center justify-between">
            <span className="px-2.5 py-1 rounded-full bg-violet-50 border border-violet-100 text-[0.75rem] font-semibold text-violet-700 tabular-nums">Total Roles: {mockRoles.length}</span>
            <button onClick={() => setCreateRoleOpen(true)} className="flex items-center gap-2 px-5 h-9 rounded-lg bg-brand-600 hover:bg-brand-500 active:bg-brand-800 text-white text-[0.8125rem] font-semibold transition-colors cursor-pointer">
              <Plus size={14} />
              Create Role
            </button>
          </div>
        ) : currentTab === 'logs' ? (
          <div className="flex items-center justify-between">
            <span className="px-2.5 py-1 rounded-full bg-violet-50 border border-violet-100 text-[0.75rem] font-semibold text-violet-700 tabular-nums">Total Entries: {mockLogs.length}</span>
            <button className="flex items-center gap-2 px-4 h-9 rounded-lg border border-paper-200 bg-paper-0 text-[0.8125rem] font-medium text-ink-700 hover:bg-paper-50 transition-colors cursor-pointer">
              <Download size={14} />
              Export CSV
            </button>
          </div>
        ) : <div />}
      </div>

      {/* Content */}
      <div className="px-10 pb-12 pt-4">
        <AnimatePresence mode="wait">
          {currentTab === 'users' ? (
            <UsersTab key="users" onInvite={() => setInviteOpen(true)} onCreateTeam={() => setCreateTeamOpen(true)} />
          ) : currentTab === 'roles' ? (
            <RolesTab key="roles" onCreateRole={() => setCreateRoleOpen(true)} />
          ) : currentTab === 'logs' ? (
            <AuditLogsTab key="logs" />
          ) : (
            <ComingSoonTab key={currentTab} tab={activeTabObj} />
          )}
        </AnimatePresence>
      </div>

      {inviteOpen && <InviteUserModal onClose={() => setInviteOpen(false)} />}
      {createTeamOpen && <CreateTeamModal onClose={() => setCreateTeamOpen(false)} />}
      {createRoleOpen && <CreateRoleModal onClose={() => setCreateRoleOpen(false)} />}
    </div>
  );
}
