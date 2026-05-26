import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { X, Link2, Globe, ChevronDown } from 'lucide-react';
import { useToast } from '../shared/Toast';

interface Props {
  onClose: () => void;
  /** Called after a successful invite. Used by App.tsx to push a
   *  notification into the platform feed (Phase 3 producer wiring). */
  onShare?: (recipients: string[]) => void;
}

interface SharedUser {
  name: string;
  email: string;
  initials: string;
  avatarClass: string;
  permission: 'edit' | 'view';
}

const PERMISSION_OPTIONS = ['can view', 'can edit', 'can comment'] as const;

const OWNER = {
  name: 'Aastha Jain',
  email: 'aastha.jain@irame.ai',
  initials: 'A',
  avatarClass: 'bg-blue-500 text-white',
};

const INITIAL_SHARED: SharedUser[] = [
  { name: 'Tushar Goel', email: 'tushar.goel@company.com', initials: 'TG', avatarClass: 'bg-primary/15 text-primary', permission: 'edit' },
  { name: 'Karan Mehta', email: 'karan.mehta@company.com', initials: 'KM', avatarClass: 'bg-primary/15 text-primary', permission: 'view' },
];

export default function ShareModal({ onClose, onShare }: Props) {
  const { addToast } = useToast();
  const [email, setEmail] = useState('');
  const [inviteChips, setInviteChips] = useState<string[]>([]);
  const [invitePermission, setInvitePermission] = useState<'can view' | 'can edit'>('can view');
  const [shared, setShared] = useState<SharedUser[]>(INITIAL_SHARED);
  const [anyonePermission, setAnyonePermission] = useState<'can view' | 'can edit'>('can view');
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleCopyLink = () => {
    addToast({ type: 'success', message: 'Link copied to clipboard!' });
  };

  const addChips = (raw: string) => {
    const parts = raw.split(',').map(s => s.trim()).filter(Boolean);
    if (parts.length === 0) return;
    setInviteChips(prev => Array.from(new Set([...prev, ...parts])));
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      if (email.trim()) {
        addChips(email);
        setEmail('');
      } else if (e.key === 'Enter') {
        handleInvite();
      }
    } else if (e.key === 'Backspace' && !email && inviteChips.length > 0) {
      setInviteChips(prev => prev.slice(0, -1));
    }
  };

  const removeChip = (chip: string) => {
    setInviteChips(prev => prev.filter(c => c !== chip));
  };

  const handleInvite = () => {
    const pending = [...inviteChips];
    if (email.trim()) pending.push(email.trim());
    if (pending.length === 0) return;
    addToast({ type: 'success', message: `Invitation sent to ${pending.join(', ')}` });
    setInviteChips([]);
    setEmail('');
    onShare?.(pending);
  };

  const canInvite = inviteChips.length > 0 || email.trim().length > 0;

  const updatePermission = (targetEmail: string, next: 'edit' | 'view') => {
    setShared(prev => prev.map(u => u.email === targetEmail ? { ...u, permission: next } : u));
    setOpenMenu(null);
  };

  const permissionLabel = (p: 'edit' | 'view') => p === 'edit' ? 'can edit' : 'can view';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ duration: 0.2 }}
        role="dialog"
        aria-modal="true"
        aria-label="Share"
        className="relative bg-white rounded-2xl shadow-2xl w-[520px] overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-border-light flex items-center justify-between">
          <h3 className="text-[0.9375rem] font-semibold text-text">Share</h3>
          <div className="flex items-center gap-3">
            <button
              onClick={handleCopyLink}
              className="flex items-center gap-1.5 text-[0.8125rem] font-medium text-primary hover:text-primary-hover transition-colors cursor-pointer"
            >
              <Link2 size={14} />
              Copy link
            </button>
            <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer">
              <X size={16} className="text-text-muted" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4">
          {/* Invite row */}
          <div className="flex gap-2">
            <div className="flex-1 flex items-center gap-1.5 flex-wrap px-2.5 py-1.5 rounded-lg border border-border-light bg-surface-2 focus-within:border-primary/60 focus-within:ring-2 focus-within:ring-primary/10 transition-all">
              {inviteChips.map(chip => (
                <span key={chip} className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-md bg-white border border-border-light text-[0.75rem] text-text">
                  {chip}
                  <button
                    onClick={() => removeChip(chip)}
                    className="p-0.5 text-text-muted hover:text-text cursor-pointer"
                    aria-label={`Remove ${chip}`}
                  >
                    <X size={11} />
                  </button>
                </span>
              ))}
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                onKeyDown={handleInputKeyDown}
                onBlur={() => { if (email.trim()) { addChips(email); setEmail(''); } }}
                placeholder={inviteChips.length === 0 ? 'Add comma separated emails to invite' : ''}
                className="flex-1 min-w-[120px] bg-transparent py-1 text-[0.8125rem] text-text placeholder:text-text-muted focus:outline-none"
              />
              {inviteChips.length > 0 && (
                <div className="relative">
                  <button
                    onClick={() => setOpenMenu(openMenu === 'invite' ? null : 'invite')}
                    className="flex items-center gap-1 px-2 py-1 rounded text-[0.75rem] text-text-secondary hover:text-text transition-colors cursor-pointer"
                  >
                    {invitePermission}
                    <ChevronDown size={12} />
                  </button>
                  {openMenu === 'invite' && (
                    <div className="absolute right-0 top-full mt-1 bg-white border border-border-light rounded-lg shadow-lg py-1 w-32 z-10">
                      {(['can view', 'can edit'] as const).map(opt => (
                        <button
                          key={opt}
                          onClick={() => { setInvitePermission(opt); setOpenMenu(null); }}
                          className="w-full text-left px-3 py-1.5 text-[0.75rem] text-text hover:bg-surface-2 cursor-pointer"
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
            <button
              onClick={handleInvite}
              disabled={!canInvite}
              className="px-5 py-2 rounded-lg text-[0.8125rem] font-semibold transition-colors cursor-pointer disabled:cursor-not-allowed bg-primary text-white hover:bg-primary-hover disabled:bg-gray-100 disabled:text-text-muted"
            >
              Invite
            </button>
          </div>

          {/* Who has access */}
          <div>
            <div className="text-[0.75rem] font-semibold text-text-muted mb-2">Who has access</div>
            <div className="space-y-1">
              {/* Anyone with link */}
              <div className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-surface-2 transition-colors">
                <div className="w-8 h-8 rounded-full bg-surface-2 border border-border-light flex items-center justify-center shrink-0">
                  <Globe size={15} className="text-text-muted" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[0.8125rem] font-medium text-text">Anyone with link</div>
                </div>
                <div className="relative">
                  <button
                    onClick={() => setOpenMenu(openMenu === 'anyone' ? null : 'anyone')}
                    className="flex items-center gap-1 text-[0.75rem] text-text-muted hover:text-text transition-colors cursor-pointer"
                  >
                    {anyonePermission}
                    <ChevronDown size={12} />
                  </button>
                  {openMenu === 'anyone' && (
                    <div className="absolute right-0 top-full mt-1 bg-white border border-border-light rounded-lg shadow-lg py-1 w-32 z-10">
                      {(['can view', 'can edit'] as const).map(opt => (
                        <button
                          key={opt}
                          onClick={() => { setAnyonePermission(opt); setOpenMenu(null); }}
                          className="w-full text-left px-3 py-1.5 text-[0.75rem] text-text hover:bg-surface-2 cursor-pointer"
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Owner */}
              <div className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-surface-2 transition-colors">
                <div className={`w-8 h-8 rounded-full text-[0.75rem] font-bold flex items-center justify-center shrink-0 ${OWNER.avatarClass}`}>
                  {OWNER.initials}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[0.8125rem] text-text">
                    <span className="font-medium">{OWNER.name}</span>
                    <span className="text-text-muted"> (you)</span>
                  </div>
                </div>
                <span className="text-[0.75rem] text-text-muted">owner</span>
              </div>

              {/* Shared users */}
              {shared.map(user => (
                <div key={user.email} className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-surface-2 transition-colors">
                  <div className={`w-8 h-8 rounded-full text-[0.75rem] font-bold flex items-center justify-center shrink-0 ${user.avatarClass}`}>
                    {user.initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[0.8125rem] font-medium text-text truncate">{user.name}</div>
                  </div>
                  <div className="relative">
                    <button
                      onClick={() => setOpenMenu(openMenu === user.email ? null : user.email)}
                      className="flex items-center gap-1 text-[0.75rem] text-text-muted hover:text-text transition-colors cursor-pointer"
                    >
                      {permissionLabel(user.permission)}
                      <ChevronDown size={12} />
                    </button>
                    {openMenu === user.email && (
                      <div className="absolute right-0 top-full mt-1 bg-white border border-border-light rounded-lg shadow-lg py-1 w-32 z-10">
                        {PERMISSION_OPTIONS.filter(p => p !== 'can comment').map(opt => (
                          <button
                            key={opt}
                            onClick={() => updatePermission(user.email, opt === 'can edit' ? 'edit' : 'view')}
                            className="w-full text-left px-3 py-1.5 text-[0.75rem] text-text hover:bg-surface-2 cursor-pointer"
                          >
                            {opt}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
