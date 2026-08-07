import { useState, useEffect, useRef, useMemo, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { Link2, Globe, Lock, ChevronDown, Check, Users, Trash2, Building2, X } from 'lucide-react';
import { useToast } from '../shared/Toast';
import { useAuditLog } from '../../context/AdminDataContext';
import { Button } from '../shared/Button';

type Anchor = { top: number; left: number; right: number; bottom: number; width: number; height: number };

interface Props {
  onClose: () => void;
  /** Called after a successful invite. Used by App.tsx to push a
   *  notification into the platform feed (Phase 3 producer wiring). */
  onShare?: (recipients: string[]) => void;
  /** What is being shared, e.g. "workspace", "report". Drives placeholder copy. */
  scope?: string;
  /** The name of the specific thing being shared. Printed in the header so a
   *  popover opened from a row in a long list says which row it is about. */
  subjectName?: string;
  /** Rect of the element that opened the popover, so it anchors next to it.
   *  Null → top-right of the viewport. */
  anchor?: Anchor | null;
}

interface Member {
  name: string;
  email: string;
  initials: string;
  permission: string;
  owner?: boolean;
  you?: boolean;
  /** Just-invited rows that haven't "accepted". */
  pending?: boolean;
}

type DirEntry =
  | { kind: 'user'; name: string; email: string; initials: string }
  | { kind: 'team'; name: string; members: number };

const ACCESS_OPTIONS = ['Full access', 'Can edit', 'Can view'] as const;
const GENERAL_PERMS = ['Can view', 'Can comment', 'Can edit'] as const;
const AUDIENCES = ['Only invited users', 'Everyone at Irame', 'Anyone with the link'] as const;
type Audience = typeof AUDIENCES[number];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const POPOVER_W = 460;

/** Designed focus ring (PRODUCT.md: visible rings on every interactive element,
 *  not browser defaults). brand-600 at low alpha, offset off the elevated sheet. */
const FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/45 focus-visible:ring-offset-1 focus-visible:ring-offset-canvas-elevated';

/** Calm, on-brand avatar tints kept inside the violet / ink family. brand-600 is
 *  reserved for signal (primary action, selection) — never a decorative avatar. */
const AVATAR_TINTS = [
  'bg-brand-100 text-brand-700',
  'bg-draft-50 text-draft-700',
  'bg-brand-50 text-brand-600',
];
const tintFor = (s: string) =>
  AVATAR_TINTS[[...s].reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_TINTS.length];

const DIRECTORY: DirEntry[] = [
  { kind: 'user', name: 'Aastha Jain', email: 'aastha.jain@irame.ai', initials: 'A' },
  { kind: 'user', name: 'Tushar Goel', email: 'tushar.goel@company.com', initials: 'T' },
  { kind: 'user', name: 'Karan Mehta', email: 'karan.mehta@company.com', initials: 'K' },
  { kind: 'user', name: 'Sarah Johnson', email: 'sarah.johnson@irame.ai', initials: 'S' },
  { kind: 'user', name: 'Michael Chen', email: 'michael.chen@irame.ai', initials: 'M' },
  { kind: 'user', name: 'Sneha Desai', email: 'sneha.desai@irame.ai', initials: 'S' },
  { kind: 'user', name: 'Priya Sharma', email: 'priya.sharma@irame.ai', initials: 'P' },
  { kind: 'user', name: 'David Kim', email: 'david.kim@irame.ai', initials: 'D' },
  { kind: 'team', name: 'Audit Team', members: 8 },
  { kind: 'team', name: 'Risk & Compliance', members: 5 },
];

// First-run share: only the owner (you) has access. Invite others from here.
const INITIAL_MEMBERS: Member[] = [
  { name: 'Nilesh Anand', email: 'nilesh.anand@irame.ai', initials: 'N', permission: 'Full access', owner: true, you: true },
];

// Your workspace domain, derived from the owner. People inside it get access
// immediately; people from another workspace stay "Pending" until they accept.
const ORG_DOMAIN = (INITIAL_MEMBERS.find(m => m.you)?.email.split('@')[1] ?? 'irame.ai').toLowerCase();
const isExternalRecipient = (value: string) =>
  !value.includes('(team)') && !value.toLowerCase().endsWith(`@${ORG_DOMAIN}`);

const initialsOf = (s: string) => s.replace(/^@/, '').trim()[0]?.toUpperCase() ?? '?';
const nameFromEmail = (email: string) =>
  email.split('@')[0].split(/[._-]+/).filter(Boolean)
    .map(w => w[0]?.toUpperCase() + w.slice(1)).join(' ') || email;

function Avatar({ initials, you, team, email }: { initials: string; you?: boolean; team?: boolean; email?: string }) {
  if (team) {
    return (
      <div className="w-8 h-8 rounded-full bg-brand-50 text-brand-600 flex items-center justify-center shrink-0">
        <Users size={16} aria-hidden="true" />
      </div>
    );
  }
  const tint = you ? 'bg-canvas-elevated ring-1 ring-canvas-border text-ink-600' : tintFor(email ?? initials);
  return (
    <div className={`w-8 h-8 rounded-full text-[0.75rem] font-semibold flex items-center justify-center shrink-0 ${tint}`}>
      {initials}
    </div>
  );
}

/** Dropdown surface, portalled to <body> so it never gets clipped by the
 *  popover's overflow and always positions the same way: anchored to its
 *  trigger, opening down, flipping up only when there isn't room below, and
 *  clamped to the viewport horizontally. One rule for every menu in here. */
function Menu({
  triggerRef, open, align, width, children,
}: {
  triggerRef: React.RefObject<HTMLButtonElement | null>;
  open: boolean;
  align: 'left' | 'right';
  width: number;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const t = triggerRef.current?.getBoundingClientRect();
      if (!t) return;
      const h = ref.current?.offsetHeight ?? 200;
      const vw = window.innerWidth, vh = window.innerHeight, gap = 6, pad = 8;
      let left = align === 'right' ? t.right - width : t.left;
      left = Math.min(Math.max(pad, left), vw - width - pad);
      let top = t.bottom + gap;                         // open down by default
      if (top + h > vh - pad) {                         // not enough room → flip up
        const up = t.top - gap - h;
        top = up >= pad ? up : Math.max(pad, vh - h - pad);
      }
      setCoords({ top, left });
    };
    place();
    const ro = new ResizeObserver(place);
    if (ref.current) ro.observe(ref.current);
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => { ro.disconnect(); window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true); };
  }, [open, align, width, triggerRef]);

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          ref={ref}
          role="menu"
          initial={{ opacity: 0, scale: 0.97, y: -4 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.97, y: -4 }}
          transition={{ type: 'spring', stiffness: 520, damping: 32, mass: 0.6 }}
          style={{ position: 'fixed', top: coords?.top ?? -9999, left: coords?.left ?? -9999, width }}
          className="z-[70] bg-canvas-elevated border border-canvas-border rounded-xl shadow-lg py-1 origin-top"
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

/** Plain text + chevron permission control (no bordered box) — the minimal
 *  Notion treatment. Used for member rows and the general-access permission. */
function RoleControl({
  value, options, open, onToggle, onSelect, onRemove, align = 'right', disabled = false,
}: {
  value: string;
  options: readonly string[];
  open: boolean;
  onToggle: () => void;
  onSelect: (v: string) => void;
  onRemove?: () => void;
  align?: 'left' | 'right';
  disabled?: boolean;
}) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  return (
    <div className="relative shrink-0">
      <button
        ref={triggerRef}
        onClick={disabled ? undefined : onToggle}
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={open}
        className={`flex items-center gap-1 px-1.5 py-1 -mr-1.5 rounded-md text-[0.75rem] transition-colors ${FOCUS} ${
          disabled
            ? 'text-ink-300 cursor-default'
            : open
              ? 'text-brand-700 bg-brand-50 cursor-pointer'
              : 'text-ink-500 hover:text-brand-700 hover:bg-brand-50 cursor-pointer'
        }`}
      >
        {value}
        {!disabled && <ChevronDown size={14} className={`transition-transform ${open ? 'rotate-180 text-brand-600' : 'text-ink-400'}`} aria-hidden="true" />}
      </button>
      <Menu triggerRef={triggerRef} open={open} align={align} width={160}>
        {options.map(opt => (
          <button
            key={opt}
            onClick={() => onSelect(opt)}
            className={`w-full flex items-center justify-between gap-2 text-left px-3 py-2 text-[0.75rem] text-ink-800 hover:bg-canvas focus-visible:bg-canvas focus-visible:outline-none cursor-pointer ${opt === value ? 'font-medium' : ''}`}
          >
            {opt}
            {opt === value && <Check size={14} className="text-brand-600 shrink-0" aria-hidden="true" />}
          </button>
        ))}
        {onRemove && (
          <>
            <div className="my-1 h-px bg-canvas-border" />
            <button
              onClick={onRemove}
              className="w-full flex items-center gap-2 text-left px-3 py-2 text-[0.75rem] font-medium text-risk hover:bg-risk-50 focus-visible:bg-risk-50 focus-visible:outline-none cursor-pointer"
            >
              <Trash2 size={14} aria-hidden="true" />
              Remove access
            </button>
          </>
        )}
      </Menu>
    </div>
  );
}

/** Skeleton placeholder for a member row while collaborators load.
 *  Pulse conveys the loading state; it goes static under reduced-motion. */
function MemberRowSkeleton({ pulse, widths }: { pulse: boolean; widths: [string, string] }) {
  // Match the platform skeleton tint (shared Skeleton uses bg-paper-100) —
  // bg-canvas was near-white and read as washed-out / barely visible.
  const block = `bg-paper-100 rounded ${pulse ? 'animate-pulse' : ''}`;
  return (
    <div className="flex items-center gap-3 px-2 py-2">
      <div className={`w-8 h-8 rounded-full shrink-0 ${block}`} />
      <div className="flex-1 min-w-0 space-y-1.5">
        <div className={`h-[0.6875rem] ${block}`} style={{ width: widths[0] }} />
        <div className={`h-[0.625rem] ${block}`} style={{ width: widths[1] }} />
      </div>
      <div className={`h-3.5 w-16 ${block}`} />
    </div>
  );
}

export default function ShareModal({ onClose, onShare, scope, subjectName, anchor }: Props) {
  const { addToast } = useToast();
  const logEvent = useAuditLog();
  const reduce = useReducedMotion();
  const [query, setQuery] = useState('');
  const [chips, setChips] = useState<{ label: string; value: string; invalid?: boolean }[]>([]);
  const [members, setMembers] = useState<Member[]>(INITIAL_MEMBERS);
  const [inviteAccess, setInviteAccess] = useState('Can view');
  // Audit work starts closed. A report, a RACM, a risk or a control opens with
  // general access off, so it reaches exactly the people invited to it and
  // opening it up is a deliberate act. The workspace itself is the one thing
  // everybody is already in, so it keeps the workspace-wide default.
  const [audience, setAudience] = useState<Audience>(
    scope && scope !== 'workspace' ? 'Only invited users' : 'Everyone at Irame',
  );
  const [generalPerm, setGeneralPerm] = useState('Can view');
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);   // highlighted typeahead row
  const [dismissed, setDismissed] = useState(false);   // Escape closed the list
  const [justAdded, setJustAdded] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  // A real share dialog fetches the current collaborators on open. Simulate that
  // round-trip so the loading (skeleton) state is real, not decorative.
  const [loading, setLoading] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const audienceRef = useRef<HTMLButtonElement>(null);
  const suggestRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  // Position the popover next to its trigger, clamped to the viewport. A
  // ResizeObserver re-runs placement whenever the card's height changes
  // (skeleton → loaded, invites, audience copy) so the footer never falls
  // off-screen.
  useLayoutEffect(() => {
    const place = () => {
      const vw = window.innerWidth, vh = window.innerHeight;
      const h = cardRef.current?.offsetHeight ?? 480;
      const gap = 8, pad = 12;
      // Clamp against the anticipated loaded height, not the shorter skeleton,
      // so the popover holds its position while collaborators load (no shift).
      const hStable = Math.max(h, 340);
      const clampX = (x: number) => Math.min(Math.max(pad, x), vw - POPOVER_W - pad);
      const clampY = (y: number) => Math.min(Math.max(pad, y), vh - hStable - pad);
      if (!anchor) { setPos({ top: Math.max(pad, Math.min(64, vh - hStable - pad)), left: Math.max(pad, vw - POPOVER_W - 24) }); return; }

      // Far-left rail trigger (sidebar, collapsed or hover-expanded): open to
      // the RIGHT of it so it clears the rail. Detected by the left edge, not
      // width, so it's stable whether the rail is collapsed or expanded.
      if (anchor.left < 64 && anchor.right + gap + POPOVER_W <= vw - pad) {
        setPos({ left: clampX(anchor.right + gap), top: clampY(anchor.top) });
        return;
      }

      // Every other trigger (toolbar / list icons): drop DOWN like a menu,
      // flipping ABOVE only when there isn't room below — never beside or over
      // the trigger. Hang from the trigger's right edge, fall back to the left
      // edge, then clamp to the viewport.
      //
      // Decide below/above against the *anticipated* loaded height (not the
      // shorter skeleton), so the popover doesn't visibly jump direction when
      // the collaborator list finishes loading.
      const fitsBelow = anchor.bottom + gap + hStable <= vh - pad;
      const top = fitsBelow ? anchor.bottom + gap : anchor.top - gap - h;
      let left = anchor.right - POPOVER_W;
      if (left < pad) left = anchor.left;
      setPos({ left: clampX(left), top: clampY(top) });
    };
    place();
    window.addEventListener('resize', place);
    const ro = new ResizeObserver(place);
    if (cardRef.current) ro.observe(cardRef.current);
    return () => { window.removeEventListener('resize', place); ro.disconnect(); };
  }, [anchor]);

  // Land keyboard focus inside the popover on open.
  useEffect(() => { inputRef.current?.focus(); }, []);

  // Resolve the simulated collaborator fetch.
  useEffect(() => {
    const t = setTimeout(() => setLoading(false), reduce ? 0 : 360);
    return () => clearTimeout(t);
  }, [reduce]);

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

  // Escape steps back one layer: typeahead list → open dropdown → popover.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      const suggestOpen = focused && suggestions.length > 0 && !dismissed;
      if (suggestOpen) { e.stopPropagation(); setDismissed(true); }
      else if (openMenu) { e.stopPropagation(); setOpenMenu(null); }
      else onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, openMenu, focused, suggestions.length, dismissed]);

  // Keep the highlighted typeahead row in view as arrows move it.
  useEffect(() => {
    if (dismissed) return;
    (suggestRef.current?.children[activeIndex] as HTMLElement | undefined)?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, dismissed]);

  const addChip = (label: string, value: string, invalid = false) => {
    if (takenEmails.has(value)) return;
    setChips(prev => [...prev, { label, value, invalid }]);
    setQuery('');
    setActiveIndex(0);
    setDismissed(false);
    inputRef.current?.focus();
  };

  const addRaw = (raw: string) => {
    raw.split(',').map(s => s.trim()).filter(Boolean).forEach(v => addChip(v, v, !EMAIL_RE.test(v)));
  };

  const pickSuggestion = (s: DirEntry) => {
    if (s.kind === 'user') addChip(s.name, s.email);
    else addChip(s.name, `${s.name} (team)`);
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const suggestOpen = focused && suggestions.length > 0 && !dismissed;
    // Arrow keys move the highlight through the typeahead.
    if (suggestOpen && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      e.preventDefault();
      setActiveIndex(i => e.key === 'ArrowDown'
        ? (i + 1) % suggestions.length
        : (i - 1 + suggestions.length) % suggestions.length);
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      if (suggestOpen) pickSuggestion(suggestions[activeIndex] ?? suggestions[0]);
      else if (query.trim()) addRaw(query);
      else handleInvite();
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
    if (query.trim()) {
      query.split(',').map(s => s.trim()).filter(Boolean).forEach(v => pending.push({ label: v, value: v, invalid: !EMAIL_RE.test(v) }));
    }
    if (pending.length === 0) return;

    const bad = pending.filter(p => p.invalid);
    if (bad.length > 0) {
      setChips(pending);
      setQuery('');
      addToast({ type: 'error', message: bad.length === 1
        ? `${bad[0].value} doesn't look like a valid email address.`
        : `${bad.length} entries don't look like valid email addresses.` });
      return;
    }

    const fresh = pending.filter(p => !members.some(m => m.email === p.value));
    setMembers(prev => [
      ...prev,
      ...fresh.map(p => {
        const name = p.label === p.value ? nameFromEmail(p.value) : p.label;
        return { name, email: p.value, initials: initialsOf(name), permission: inviteAccess, pending: isExternalRecipient(p.value) };
      }),
    ]);
    if (fresh[0]) { setJustAdded(fresh[0].value); setTimeout(() => setJustAdded(null), 1400); }
    addToast({ type: 'success', message: `Invitation sent to ${pending.map(p => p.label).join(', ')}.` });
    setChips([]);
    setQuery('');
    onShare?.(pending.map(p => p.value));
    logEvent({
      action: 'Share',
      description: `Shared ${scopeLabel ?? 'workspace'} with ${pending.length} ${pending.length === 1 ? 'recipient' : 'recipients'} (${pending.map(p => p.label).join(', ')})`,
      module: auditTarget.module,
      entity: auditTarget.entity,
    });
  };

  const canInvite = chips.length > 0 || query.trim().length > 0;
  const setPermission = (email: string, next: string) => {
    setMembers(prev => prev.map(m => m.email === email ? { ...m, permission: next } : m));
    setOpenMenu(null);
  };
  const removeMember = (email: string) => {
    const removed = members.find(m => m.email === email);
    const at = members.findIndex(m => m.email === email);
    setMembers(prev => prev.filter(m => m.email !== email));
    setOpenMenu(null);
    if (!removed) return;
    // Undo over confirm (Nielsen #3): restore at the original position.
    addToast({
      type: 'success',
      message: `${removed.name} removed.`,
      action: {
        label: 'Undo',
        onClick: () => setMembers(prev =>
          prev.some(m => m.email === removed.email)
            ? prev
            : [...prev.slice(0, at), removed, ...prev.slice(at)]),
      },
    });
  };

  // Human-readable noun for the dialog label ("Share this RACM"). The link slug
  // keeps the raw lowercase scope; only the visible/aria wording is prettified.
  const SCOPE_LABELS: Record<string, string> = { racm: 'RACM', 'workflow-output': 'workflow output' };
  const scopeLabel = scope ? (SCOPE_LABELS[scope] ?? scope) : null;
  // Audit-log routing — the shared thing's scope decides which module/entity
  // the event files under.
  const auditTarget = (() => {
    const s = (scope ?? 'workspace').toLowerCase();
    if (s === 'report') return { module: 'Reports', entity: 'Report' };
    if (s === 'dashboard') return { module: 'Dashboards', entity: 'Dashboard' };
    if (s === 'workflow' || s === 'workflow-output') return { module: 'Workflow Library', entity: 'Workflow' };
    if (s === 'racm') return { module: 'Governance', entity: 'RACM' };
    return { module: 'Admin', entity: scopeLabel ?? 'workspace' };
  })();
  const shareLink = `join.irame.ai/${scope ?? 'workspace'}`;
  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(`https://${shareLink}`);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = `https://${shareLink}`;
      ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); } catch { /* ignore */ }
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
    addToast({ type: 'success', message: 'Link copied to clipboard.' });
    logEvent({
      action: 'Share',
      description: `Copied share link for ${scopeLabel ?? 'workspace'}`,
      module: auditTarget.module,
      entity: auditTarget.entity,
    });
  };

  const showSuggestions = focused && suggestions.length > 0 && !dismissed;
  const showNoResults = focused && query.trim().length > 0 && suggestions.length === 0 && !dismissed;
  const restricted = audience === 'Only invited users';
  const AudienceIcon = audience === 'Anyone with the link' ? Globe : audience === 'Everyone at Irame' ? Building2 : Lock;

  return (
    <>
      {/* Transparent click-catcher — no dim, this is a popover not a modal. */}
      <div className="fixed inset-0 z-[60]" onClick={onClose} />

      <motion.div
        ref={cardRef}
        initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.97, x: -6 }}
        animate={{ opacity: 1, scale: 1, x: 0 }}
        transition={{ type: 'spring', stiffness: 460, damping: 34, mass: 0.7 }}
        role="dialog"
        aria-modal="true"
        aria-label={scopeLabel ? `Share this ${scopeLabel}` : 'Share'}
        onClick={e => e.stopPropagation()}
        style={pos ? { top: pos.top, left: pos.left } : { top: -9999, left: -9999 }}
        className="fixed z-[61] origin-top-left bg-canvas-elevated rounded-xl border border-canvas-border shadow-lg flex flex-col max-h-[82vh] overflow-hidden"
      >
        <div style={{ width: POPOVER_W }} className="flex flex-col min-h-0 flex-1">
          {/* What is being shared. On a registry the popover opens from one row
              among many, and without this line nothing on screen said which. */}
          {subjectName && (
            <div className="px-4 pt-3.5 pb-0">
              <div className="text-[0.625rem] font-semibold uppercase tracking-[0.12em] text-ink-400">
                Share {scopeLabel ?? 'this'}
              </div>
              <div className="text-[0.8125rem] font-semibold text-ink-900 truncate" title={subjectName}>
                {subjectName}
              </div>
            </div>
          )}
          {/* Invite row */}
          <div className="px-4 pt-4 pb-2">
            <div className="flex items-start gap-2">
              <div className="relative flex-1">
                <div className="flex items-start gap-2 px-2.5 py-1.5 min-h-[36px] rounded-md border border-canvas-border bg-canvas focus-within:bg-canvas-elevated focus-within:border-brand-600 transition-all">
                  {/* Chips + input fill the left column, wrapping row by row.
                      Capped at ~4 rows + scrollable so many recipients don't
                      stretch the modal (or get clipped). */}
                  <div className="flex-1 min-w-0 flex items-center gap-1.5 flex-wrap max-h-[124px] overflow-y-auto">
                    <AnimatePresence initial={false}>
                      {chips.map(chip => (
                        <motion.span
                          key={chip.value}
                          layout
                          initial={reduce ? false : { opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.8 }}
                          transition={{ duration: 0.15, ease: [0.2, 0, 0, 1] }}
                          className={`inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-md text-[0.75rem] font-medium ${
                            chip.invalid ? 'bg-risk-50 text-risk-700' : 'bg-brand-50 text-brand-700'
                          }`}
                          title={chip.invalid ? 'Not a valid email address' : undefined}
                        >
                          {chip.label}
                          <button onClick={() => removeChip(chip.value)} className={`p-0.5 rounded cursor-pointer ${FOCUS} ${chip.invalid ? 'text-risk/70 hover:text-risk' : 'text-brand-600/70 hover:text-brand-700'}`} aria-label={`Remove ${chip.label}`}>
                            <X size={12} aria-hidden="true" />
                          </button>
                        </motion.span>
                      ))}
                    </AnimatePresence>
                    <input
                      ref={inputRef}
                      type="text"
                      value={query}
                      onChange={e => { setQuery(e.target.value); setActiveIndex(0); setDismissed(false); }}
                      role="combobox"
                      aria-expanded={showSuggestions}
                      aria-controls="share-typeahead"
                      aria-activedescendant={showSuggestions ? `share-sug-${activeIndex}` : undefined}
                      aria-autocomplete="list"
                      onKeyDown={handleInputKeyDown}
                      onFocus={() => setFocused(true)}
                      onBlur={() => setTimeout(() => setFocused(false), 120)}
                      placeholder={chips.length === 0 ? 'Add people by name or email' : 'Add another…'}
                      aria-label="Add people, teams, or email addresses"
                      className="flex-1 min-w-[120px] bg-transparent px-1 py-0.5 text-[0.75rem] text-ink-900 placeholder:text-ink-400 focus:outline-none"
                    />
                  </div>
                  {/* Role selector pinned to the top-right — never wraps. */}
                  {chips.length > 0 && (
                    <RoleControl
                      value={inviteAccess}
                      options={ACCESS_OPTIONS}
                      open={openMenu === 'invite'}
                      onToggle={() => setOpenMenu(openMenu === 'invite' ? null : 'invite')}
                      onSelect={(v) => { setInviteAccess(v); setOpenMenu(null); }}
                      align="right"
                    />
                  )}
                </div>

                <AnimatePresence>
                  {(showSuggestions || showNoResults) && (
                    <motion.div
                      ref={suggestRef}
                      id="share-typeahead"
                      role="listbox"
                      initial={reduce ? { opacity: 0 } : { opacity: 0, y: -4, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={reduce ? { opacity: 0 } : { opacity: 0, y: -4, scale: 0.98 }}
                      transition={{ type: 'spring', stiffness: 500, damping: 30, mass: 0.6 }}
                      className="absolute left-0 right-0 top-full mt-1.5 max-h-[264px] overflow-y-auto bg-canvas-elevated border border-canvas-border rounded-xl shadow-lg py-1.5 z-50 origin-top"
                    >
                      {showSuggestions ? suggestions.map((s, idx) => {
                        const active = idx === activeIndex;
                        return (
                        <button
                          key={s.kind === 'user' ? s.email : s.name}
                          id={`share-sug-${idx}`}
                          role="option"
                          aria-selected={active}
                          onMouseEnter={() => setActiveIndex(idx)}
                          onMouseDown={(e) => { e.preventDefault(); pickSuggestion(s); }}
                          className={`w-full flex items-center gap-3 px-3 py-2 cursor-pointer text-left transition-colors ${active ? 'bg-brand-50' : ''}`}
                        >
                          <Avatar initials={s.kind === 'user' ? s.initials : ''} team={s.kind === 'team'} email={s.kind === 'user' ? s.email : ''} />
                          <div className="min-w-0 flex-1">
                            <div className="text-[0.75rem] font-medium text-ink-900 truncate">{s.name}</div>
                            <div className="text-[0.75rem] text-ink-500 truncate">
                              {s.kind === 'user' ? s.email : `Team · ${s.members} members`}
                            </div>
                          </div>
                        </button>
                        );
                      }) : (
                        <div className="px-3 py-2 text-[0.75rem] text-ink-500 leading-snug">
                          No match in your directory. Press <span className="font-mono text-[0.75rem] text-ink-700 bg-canvas border border-canvas-border rounded px-1 py-0.5">Enter</span> to invite{' '}
                          <span className="font-medium text-ink-800 break-all">{query.trim()}</span> by email.
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <Button
                variant="primary"
                size="md"
                shape="md"
                onClick={handleInvite}
                disabled={!canInvite}
                // Platform convention: disabled primary stays brand, faded —
                // not the shared Button's default grey.
                className="!text-[0.75rem] disabled:!bg-primary disabled:!text-white disabled:!opacity-50 disabled:!shadow-none"
              >
                Share
              </Button>
            </div>
          </div>

          {/* People with access — label pinned; the rows scroll on their own
              (capped at ~4) so a long list never stretches the modal. */}
          <div className="shrink-0 px-4 pt-0 pb-0 text-[0.75rem] font-medium text-ink-500">People with access</div>
          <div className="overflow-y-auto px-2 max-h-[220px]" aria-busy={loading}>
            {loading ? (
              <div className="pt-1">
                <MemberRowSkeleton pulse={!reduce} widths={['8rem', '11rem']} />
                <MemberRowSkeleton pulse={!reduce} widths={['6.5rem', '9.5rem']} />
                <MemberRowSkeleton pulse={!reduce} widths={['7.25rem', '10.5rem']} />
              </div>
            ) : (
              // initial={false}: members present on open appear instantly (no
              // load cascade); only invited/removed rows animate.
              <AnimatePresence initial={false}>
                {members.map((m) => (
                  <motion.div
                    key={m.email}
                    layout="position"
                    initial={reduce ? false : { opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={reduce ? { opacity: 0 } : { opacity: 0, x: 12 }}
                    transition={{ duration: 0.22, ease: [0.2, 0, 0, 1] }}
                    className={`relative flex items-center gap-3 px-2 py-2 rounded-lg transition-colors ${
                      openMenu === m.email ? 'z-30' : ''
                    } ${justAdded === m.email ? 'bg-brand-50' : ''}`}
                  >
                    <Avatar initials={m.initials} you={m.you} email={m.email} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[0.75rem] font-medium text-ink-900 truncate">{m.name}</span>
                        {m.you && <span className="text-[0.75rem] text-ink-500 shrink-0">(You)</span>}
                        {m.pending && <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-mitigated-50 text-[0.75rem] font-medium text-mitigated-700 shrink-0">Pending</span>}
                      </div>
                      <div className="text-[0.75rem] text-ink-500 truncate">{m.email}</div>
                    </div>
                    {m.owner ? (
                      // The owner's access is fixed — it can't be changed or
                      // revoked, so it reads as quiet text, not a control.
                      <span className="text-[0.75rem] text-ink-500 shrink-0 pr-1.5">Owner</span>
                    ) : (
                      <RoleControl
                        value={m.permission}
                        options={ACCESS_OPTIONS}
                        open={openMenu === m.email}
                        onToggle={() => setOpenMenu(openMenu === m.email ? null : m.email)}
                        onSelect={(v) => setPermission(m.email, v)}
                        onRemove={() => removeMember(m.email)}
                      />
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>
            )}
          </div>

          {/* General access — pinned below the scrolling member list */}
          <div className="shrink-0 px-2">
            <div className="px-2 pt-0 pb-0 text-[0.75rem] font-medium text-ink-500">General access</div>
            {loading ? (
              <MemberRowSkeleton pulse={!reduce} widths={['9rem', '12rem']} />
            ) : (
            <div className="relative flex items-center gap-3 px-2 py-2 rounded-lg">
              <div className="w-8 h-8 rounded-lg bg-canvas border border-canvas-border text-ink-600 flex items-center justify-center shrink-0">
                <AudienceIcon size={16} aria-hidden="true" />
              </div>
              <div className="flex-1 min-w-0 relative">
                <button
                  ref={audienceRef}
                  onClick={() => setOpenMenu(openMenu === 'audience' ? null : 'audience')}
                  aria-haspopup="menu"
                  aria-expanded={openMenu === 'audience'}
                  className={`flex items-center gap-1 -ml-1 px-1 py-0.5 rounded-md text-[0.75rem] font-medium text-ink-900 hover:text-brand-700 hover:bg-brand-50 cursor-pointer ${FOCUS}`}
                >
                  {audience}
                  <ChevronDown size={15} className={`text-ink-400 transition-transform ${openMenu === 'audience' ? 'rotate-180' : ''}`} aria-hidden="true" />
                </button>
                <div className="text-[0.75rem] text-ink-500 truncate">
                  {restricted ? 'Only people invited can open.' : audience === 'Everyone at Irame' ? 'Anyone in your workspace can open.' : 'Anyone with the link can open.'}
                </div>
                <Menu triggerRef={audienceRef} open={openMenu === 'audience'} align="left" width={256}>
                  {AUDIENCES.map(opt => {
                    const Icon = opt === 'Anyone with the link' ? Globe : opt === 'Everyone at Irame' ? Building2 : Lock;
                    return (
                      <button
                        key={opt}
                        onClick={() => { setAudience(opt); setOpenMenu(null); }}
                        className="w-full flex items-center gap-2.5 text-left px-3 py-2 hover:bg-canvas focus-visible:bg-canvas focus-visible:outline-none cursor-pointer"
                      >
                        <Icon size={16} className="text-ink-700 shrink-0" aria-hidden="true" />
                        <span className="flex-1 text-[0.75rem] text-ink-800">{opt}</span>
                        {opt === audience && <Check size={14} className="text-brand-600 shrink-0" aria-hidden="true" />}
                      </button>
                    );
                  })}
                </Menu>
              </div>
              <RoleControl
                value={restricted ? '—' : generalPerm}
                options={GENERAL_PERMS}
                open={openMenu === 'genperm'}
                onToggle={() => setOpenMenu(openMenu === 'genperm' ? null : 'genperm')}
                onSelect={(v) => { setGeneralPerm(v); setOpenMenu(null); }}
                disabled={restricted}
              />
            </div>
            )}
          </div>

          {/* Footer */}
          <footer className="shrink-0 px-3 pt-2 pb-4 border-t border-canvas-border flex items-center justify-end gap-3">
            <Button
              variant="outline"
              size="sm"
              shape="md"
              leftIcon={copied ? <Check size={14} aria-hidden="true" /> : <Link2 size={14} aria-hidden="true" />}
              onClick={handleCopyLink}
              className={`!text-[0.75rem] ${copied ? '!bg-compliant-50 !text-compliant-700 !border-compliant-50 hover:!bg-compliant-50' : ''}`}
            >
              {copied ? 'Copied' : 'Copy link'}
            </Button>
          </footer>
        </div>
      </motion.div>
    </>
  );
}
