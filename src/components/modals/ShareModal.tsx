import { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Link2, Globe, Lock, ChevronDown, Check, UserPlus, Users, Trash2 } from 'lucide-react';
import { useToast } from '../shared/Toast';

interface Props {
  onClose: () => void;
  /** Called after a successful invite. Used by App.tsx to push a
   *  notification into the platform feed (Phase 3 producer wiring). */
  onShare?: (recipients: string[]) => void;
  /** What is being shared, e.g. "workspace", "report". Drives the title. */
  scope?: string;
}

interface Member {
  name: string;
  email: string;
  initials: string;
  permission: string;
  owner?: boolean;
}

type DirEntry =
  | { kind: 'user'; name: string; email: string; initials: string }
  | { kind: 'team'; name: string; members: number };

const ACCESS_OPTIONS = ['Full access', 'Can edit', 'Can view'] as const;

/** Directory backing the "Email, Team & Users" typeahead. */
const DIRECTORY: DirEntry[] = [
  { kind: 'user', name: 'Sarah Johnson', email: 'sarah.johnson@irame.ai', initials: 'SJ' },
  { kind: 'user', name: 'Michael Chen', email: 'michael.chen@irame.ai', initials: 'MC' },
  { kind: 'user', name: 'Sneha Desai', email: 'sneha.desai@irame.ai', initials: 'SD' },
  { kind: 'user', name: 'Priya Sharma', email: 'priya.sharma@irame.ai', initials: 'PS' },
  { kind: 'user', name: 'David Kim', email: 'david.kim@irame.ai', initials: 'DK' },
  { kind: 'team', name: 'Audit Team', members: 8 },
  { kind: 'team', name: 'Risk & Compliance', members: 5 },
];

const INITIAL_MEMBERS: Member[] = [
  { name: 'Aastha Jain', email: 'aastha.jain@irame.ai', initials: 'AJ', permission: 'Full access', owner: true },
  { name: 'Tushar Goel', email: 'tushar.goel@company.com', initials: 'TG', permission: 'Can edit' },
  { name: 'Karan Mehta', email: 'karan.mehta@company.com', initials: 'KM', permission: 'Can view' },
];

const initialsOf = (s: string) =>
  s.replace(/^@/, '').split(/[\s.@]+/).filter(Boolean).slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('') || '?';

/** Initials avatar — owner gets the solid brand fill; teams get a glyph. */
function Avatar({ initials, owner, team }: { initials: string; owner?: boolean; team?: boolean }) {
  if (team) {
    return (
      <div className="w-8 h-8 rounded-full bg-evidence-50 text-evidence-700 flex items-center justify-center shrink-0">
        <Users size={15} />
      </div>
    );
  }
  return (
    <div className={`w-8 h-8 rounded-full text-[0.6875rem] font-bold flex items-center justify-center shrink-0 ${
      owner ? 'bg-brand-600 text-white' : 'bg-brand-50 text-brand-700'
    }`}>
      {initials}
    </div>
  );
}

/** Inline access dropdown — Full access / Can edit / Can view (+ Remove). */
function AccessMenu({
  value, open, onToggle, onChange, onRemove,
}: {
  value: string;
  open: boolean;
  onToggle: () => void;
  onChange: (next: string) => void;
  onRemove?: () => void;
}) {
  return (
    <div className="relative shrink-0">
      <button
        onClick={onToggle}
        className="flex items-center gap-1.5 px-2 py-1 -mr-1 rounded-md text-[0.875rem] text-ink-700 hover:text-ink-900 hover:bg-canvas transition-colors cursor-pointer"
      >
        {value}
        <ChevronDown size={15} className={`text-ink-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1.5 bg-canvas-elevated border border-canvas-border rounded-xl shadow-lg py-1 w-44 z-20">
          {ACCESS_OPTIONS.map(opt => (
            <button
              key={opt}
              onClick={() => onChange(opt)}
              className="w-full flex items-center justify-between gap-2 text-left px-3 py-2 text-[0.8125rem] text-ink-800 hover:bg-canvas cursor-pointer"
            >
              {opt}
              {opt === value && <Check size={14} className="text-brand-600" />}
            </button>
          ))}
          {onRemove && (
            <>
              <div className="my-1 h-px bg-canvas-border" />
              <button
                onClick={onRemove}
                className="w-full flex items-center gap-2 text-left px-3 py-2 text-[0.8125rem] text-risk hover:bg-risk-50 cursor-pointer"
              >
                <Trash2 size={14} />
                Remove
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default function ShareModal({ onClose, onShare, scope }: Props) {
  const { addToast } = useToast();
  const [query, setQuery] = useState('');
  const [chips, setChips] = useState<{ label: string; value: string }[]>([]);
  const [members, setMembers] = useState<Member[]>(INITIAL_MEMBERS);
  const [inviteAccess, setInviteAccess] = useState('Can view');
  const [generalAccess, setGeneralAccess] = useState<'Only invited users' | 'Anyone with the link'>('Only invited users');
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [onClose]);

  const takenEmails = useMemo(
    () => new Set([...members.map(m => m.email), ...chips.map(c => c.value)]),
    [members, chips],
  );

  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return DIRECTORY.filter(d => {
      if (d.kind === 'user' && takenEmails.has(d.email)) return false;
      const hay = d.kind === 'user' ? `${d.name} ${d.email}` : d.name;
      return hay.toLowerCase().includes(q);
    }).slice(0, 5);
  }, [query, takenEmails]);

  const addChip = (label: string, value: string) => {
    if (takenEmails.has(value)) return;
    setChips(prev => [...prev, { label, value }]);
    setQuery('');
    inputRef.current?.focus();
  };

  const addRaw = (raw: string) => {
    raw.split(',').map(s => s.trim()).filter(Boolean).forEach(v => addChip(v, v));
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (suggestions.length > 0) {
        const top = suggestions[0];
        if (top.kind === 'user') addChip(top.name, top.email);
        else addChip(top.name, `${top.name} (team)`);
      } else if (query.trim()) {
        addRaw(query);
      } else {
        handleInvite();
      }
    } else if (e.key === ',') {
      e.preventDefault();
      if (query.trim()) addRaw(query);
    } else if (e.key === 'Backspace' && !query && chips.length > 0) {
      setChips(prev => prev.slice(0, -1));
    }
  };

  const removeChip = (value: string) => setChips(prev => prev.filter(c => c.value !== value));

  const handleInvite = () => {
    const pending = [...chips];
    if (query.trim()) { query.split(',').map(s => s.trim()).filter(Boolean).forEach(v => pending.push({ label: v, value: v })); }
    if (pending.length === 0) return;
    setMembers(prev => [
      ...prev,
      ...pending
        .filter(p => !prev.some(m => m.email === p.value))
        .map(p => ({ name: p.label, email: p.value, initials: initialsOf(p.label), permission: inviteAccess })),
    ]);
    addToast({ type: 'success', message: `Invitation sent to ${pending.map(p => p.label).join(', ')}` });
    setChips([]);
    setQuery('');
    onShare?.(pending.map(p => p.value));
  };

  const canInvite = chips.length > 0 || query.trim().length > 0;
  const setPermission = (email: string, next: string) => {
    setMembers(prev => prev.map(m => m.email === email ? { ...m, permission: next } : m));
    setOpenMenu(null);
  };
  const removeMember = (email: string) => {
    setMembers(prev => prev.filter(m => m.email !== email));
    setOpenMenu(null);
  };

  const handleCopyLink = () => addToast({ type: 'success', message: 'Link copied to clipboard.' });
  const title = scope ? `Share this ${scope}` : 'Share';
  const showSuggestions = focused && suggestions.length > 0;

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        className="fixed inset-0 bg-ink-900/40 backdrop-blur-[2px] z-[60]"
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, y: 10, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 10, scale: 0.98 }}
        transition={{ duration: 0.18, ease: [0.2, 0, 0, 1] }}
        className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-6 pointer-events-none"
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-label={title}
          className="pointer-events-auto w-full max-w-[460px] max-h-[85vh] bg-canvas-elevated rounded-2xl border border-canvas-border shadow-xl flex flex-col overflow-hidden"
          onClick={e => e.stopPropagation()}
        >
          {/* Header — platform modal style: serif title + standard close */}
          <header className="shrink-0 px-6 pt-5 pb-3.5 border-b border-canvas-border flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-brand-50 text-brand-600 flex items-center justify-center shrink-0">
              <UserPlus size={17} />
            </div>
            <h2 className="flex-1 font-display text-[1.25rem] leading-[1.2] font-semibold tracking-tight text-ink-900 truncate">
              {title}
            </h2>
            <button
              onClick={onClose}
              aria-label="Close"
              className="w-8 h-8 rounded-md text-ink-500 hover:text-ink-800 hover:bg-canvas flex items-center justify-center cursor-pointer shrink-0"
            >
              <X size={17} />
            </button>
          </header>

          <div className="flex-1 overflow-y-auto">
            {/* Invite row + typeahead */}
            <div className="px-6 pt-4">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap px-2.5 py-1 min-h-[38px] rounded-lg border border-canvas-border bg-canvas-elevated focus-within:border-brand-600 focus-within:ring-4 focus-within:ring-brand-600/15 transition-all">
                    {chips.map(chip => (
                      <span key={chip.value} className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-md bg-brand-50 text-[0.8125rem] text-brand-700 font-medium">
                        {chip.label}
                        <button onClick={() => removeChip(chip.value)} className="p-0.5 text-brand-600/70 hover:text-brand-700 cursor-pointer" aria-label={`Remove ${chip.label}`}>
                          <X size={12} />
                        </button>
                      </span>
                    ))}
                    <input
                      ref={inputRef}
                      type="text"
                      value={query}
                      onChange={e => setQuery(e.target.value)}
                      onKeyDown={handleInputKeyDown}
                      onFocus={() => setFocused(true)}
                      onBlur={() => setTimeout(() => setFocused(false), 120)}
                      placeholder={chips.length === 0 ? 'Email, Team & Users' : 'Add another…'}
                      className="flex-1 min-w-[140px] bg-transparent px-1 py-0.5 text-[0.875rem] text-ink-900 placeholder:text-ink-400 focus:outline-none"
                    />
                    {chips.length > 0 && (
                      <AccessMenu
                        value={inviteAccess}
                        open={openMenu === 'invite'}
                        onToggle={() => setOpenMenu(openMenu === 'invite' ? null : 'invite')}
                        onChange={(v) => { setInviteAccess(v); setOpenMenu(null); }}
                      />
                    )}
                  </div>

                  {/* Typeahead suggestions */}
                  <AnimatePresence>
                    {showSuggestions && (
                      <motion.div
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        transition={{ duration: 0.12 }}
                        className="absolute left-0 right-0 top-full mt-1.5 bg-canvas-elevated border border-canvas-border rounded-xl shadow-lg py-1.5 z-30 overflow-hidden"
                      >
                        {suggestions.map(s => (
                          <button
                            key={s.kind === 'user' ? s.email : s.name}
                            onMouseDown={(e) => {
                              e.preventDefault();
                              if (s.kind === 'user') addChip(s.name, s.email);
                              else addChip(s.name, `${s.name} (team)`);
                            }}
                            className="w-full flex items-center gap-3 px-3 py-2 hover:bg-canvas cursor-pointer text-left"
                          >
                            <Avatar initials={s.kind === 'user' ? s.initials : ''} team={s.kind === 'team'} />
                            <div className="min-w-0 flex-1">
                              <div className="text-[0.875rem] font-medium text-ink-900 truncate">{s.name}</div>
                              <div className="text-[0.75rem] text-ink-400 truncate">
                                {s.kind === 'user' ? s.email : `Team · ${s.members} members`}
                              </div>
                            </div>
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <button
                  onClick={handleInvite}
                  disabled={!canInvite}
                  className="px-4 h-[38px] shrink-0 rounded-lg text-[0.875rem] font-medium transition-[background-color,box-shadow] cursor-pointer disabled:cursor-not-allowed bg-primary text-white shadow-sm shadow-brand-900/10 hover:bg-primary-hover hover:shadow-md hover:shadow-brand-900/15 active:scale-[0.98] disabled:bg-canvas-border disabled:text-text-muted disabled:shadow-none"
                >
                  Invite
                </button>
              </div>
            </div>

            {/* People with access */}
            <div className="px-4 pt-3 pb-1">
              {members.map(m => (
                <div key={m.email} className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-canvas transition-colors">
                  <Avatar initials={m.initials} owner={m.owner} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[0.875rem] font-semibold text-ink-900 truncate">{m.name}</span>
                      {m.owner && <span className="px-1.5 py-0.5 rounded-md bg-draft-50 text-[0.625rem] font-medium text-ink-600 shrink-0">Owner</span>}
                    </div>
                    <div className="text-[0.75rem] text-ink-400 truncate">@{m.email}</div>
                  </div>
                  {m.owner ? (
                    <span className="text-[0.8125rem] text-ink-400 pr-1">Full access</span>
                  ) : (
                    <AccessMenu
                      value={m.permission}
                      open={openMenu === m.email}
                      onToggle={() => setOpenMenu(openMenu === m.email ? null : m.email)}
                      onChange={(v) => setPermission(m.email, v)}
                      onRemove={() => removeMember(m.email)}
                    />
                  )}
                </div>
              ))}
            </div>

            {/* General access */}
            <div className="px-6 pb-5 pt-1">
              <div className="text-[0.75rem] font-semibold text-ink-500 mb-1.5">General access</div>
              <div className="relative">
                <button
                  onClick={() => setOpenMenu(openMenu === 'general' ? null : 'general')}
                  className="w-full flex items-center gap-2.5 px-2 -mx-2 py-1.5 rounded-lg hover:bg-canvas transition-colors cursor-pointer"
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                    generalAccess === 'Only invited users' ? 'bg-canvas border border-canvas-border text-ink-600' : 'bg-brand-50 text-brand-600'
                  }`}>
                    {generalAccess === 'Only invited users' ? <Lock size={15} /> : <Globe size={15} />}
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <div className="text-[0.875rem] font-semibold text-ink-900">{generalAccess}</div>
                    <div className="text-[0.75rem] text-ink-400 truncate">
                      {generalAccess === 'Only invited users' ? 'Only people added can open' : 'Anyone with the link can view'}
                    </div>
                  </div>
                  <ChevronDown size={18} className={`text-ink-500 shrink-0 transition-transform ${openMenu === 'general' ? 'rotate-180' : ''}`} />
                </button>
                {openMenu === 'general' && (
                  <div className="absolute left-0 right-0 top-full mt-1.5 bg-canvas-elevated border border-canvas-border rounded-xl shadow-lg py-1 z-20">
                    {(['Only invited users', 'Anyone with the link'] as const).map(opt => (
                      <button
                        key={opt}
                        onClick={() => { setGeneralAccess(opt); setOpenMenu(null); }}
                        className="w-full flex items-center gap-2.5 text-left px-3 py-2.5 hover:bg-canvas cursor-pointer"
                      >
                        {opt === 'Only invited users'
                          ? <Lock size={16} className="text-ink-700 shrink-0" />
                          : <Globe size={16} className="text-brand-600 shrink-0" />}
                        <span className="flex-1 text-[0.8125rem] text-ink-800">{opt}</span>
                        {opt === generalAccess && <Check size={14} className="text-brand-600 shrink-0" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Footer */}
          <footer className="shrink-0 px-6 py-3 border-t border-canvas-border flex items-center justify-between">
            <span className="text-[0.8125rem] text-ink-500">join.irame.ai</span>
            <button
              onClick={handleCopyLink}
              className="flex items-center gap-1.5 text-[0.8125rem] font-medium text-ink-700 hover:text-brand-700 transition-colors cursor-pointer"
            >
              <Link2 size={15} />
              Copy link
            </button>
          </footer>
        </div>
      </motion.div>
    </>
  );
}
