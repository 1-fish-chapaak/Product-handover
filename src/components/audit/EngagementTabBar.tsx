/**
 * EngagementTabBar — a reusable engagement sub-page tab bar with:
 *   • bright, business-colorful icon chips per tab
 *   • drag-to-reorder (motion Reorder, horizontal)
 *   • a gear menu to show/hide individual tabs
 *   • per-bar persistence of order + hidden set (localStorage by storageKey)
 *
 * Used by the Engagements, Engagement Final, and Engagement Config pages so the
 * tab experience stays consistent across all three.
 */

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { motion, AnimatePresence, Reorder } from 'motion/react';
import {
  LayoutDashboard, Table2, ShieldCheck, Workflow, FolderOpen, AlertTriangle,
  BookOpen, Activity, Settings, Target, Inbox, FileBarChart, SlidersHorizontal,
  GripHorizontal, Eye, EyeOff, FileText, ListChecks, ClipboardList, Megaphone,
  Briefcase, CheckCircle2,
} from 'lucide-react';

export interface TabDef { id: string; label: string }

/** Per-sub-page icon + a literal Tailwind chip class (no interpolation → purge-safe). */
export const TAB_META: Record<string, { icon: React.ElementType; chip: string }> = {
  overview:        { icon: LayoutDashboard, chip: 'bg-blue-50 text-blue-600' },
  scope:           { icon: Target,          chip: 'bg-lime-50 text-lime-600' },
  'control-scope': { icon: Target,          chip: 'bg-lime-50 text-lime-600' },
  racm:            { icon: Table2,          chip: 'bg-violet-50 text-violet-600' },
  'ia-racm':       { icon: Table2,          chip: 'bg-violet-50 text-violet-600' },
  controls:        { icon: ShieldCheck,     chip: 'bg-emerald-50 text-emerald-600' },
  'ia-controls':   { icon: ShieldCheck,     chip: 'bg-emerald-50 text-emerald-600' },
  idr:             { icon: Inbox,           chip: 'bg-sky-50 text-sky-600' },
  requests:        { icon: Inbox,           chip: 'bg-sky-50 text-sky-600' },
  'requests-idr':  { icon: Inbox,           chip: 'bg-sky-50 text-sky-600' },
  workflows:       { icon: Workflow,        chip: 'bg-cyan-50 text-cyan-600' },
  evidence:        { icon: FolderOpen,      chip: 'bg-amber-50 text-amber-600' },
  'samples-evidence': { icon: FolderOpen,   chip: 'bg-amber-50 text-amber-600' },
  'attr-testing':  { icon: ListChecks,      chip: 'bg-indigo-50 text-indigo-600' },
  exceptions:      { icon: AlertTriangle,   chip: 'bg-rose-50 text-rose-600' },
  cases:           { icon: Briefcase,       chip: 'bg-rose-50 text-rose-600' },
  report:          { icon: FileBarChart,    chip: 'bg-teal-50 text-teal-600' },
  reports:         { icon: FileBarChart,    chip: 'bg-teal-50 text-teal-600' },
  summary:         { icon: FileBarChart,    chip: 'bg-teal-50 text-teal-600' },
  'final-report':  { icon: FileBarChart,    chip: 'bg-teal-50 text-teal-600' },
  'working-paper': { icon: BookOpen,        chip: 'bg-teal-50 text-teal-600' },
  conclusion:      { icon: CheckCircle2,    chip: 'bg-emerald-50 text-emerald-600' },
  review:          { icon: Eye,             chip: 'bg-sky-50 text-sky-600' },
  'output-review': { icon: Eye,             chip: 'bg-sky-50 text-sky-600' },
  announcement:    { icon: Megaphone,       chip: 'bg-orange-50 text-orange-600' },
  trail:           { icon: Activity,        chip: 'bg-fuchsia-50 text-fuchsia-600' },
  'activity-trail':{ icon: Activity,        chip: 'bg-fuchsia-50 text-fuchsia-600' },
  config:          { icon: Settings,        chip: 'bg-slate-100 text-slate-600' },
};

// Bright palette + generic icons for any tab id not explicitly mapped — keeps
// every tab "business colorful" even on the pattern-driven Config workspaces.
const FALLBACK_CHIPS = [
  'bg-blue-50 text-blue-600', 'bg-violet-50 text-violet-600', 'bg-emerald-50 text-emerald-600',
  'bg-amber-50 text-amber-600', 'bg-rose-50 text-rose-600', 'bg-cyan-50 text-cyan-600',
  'bg-fuchsia-50 text-fuchsia-600', 'bg-teal-50 text-teal-600', 'bg-indigo-50 text-indigo-600',
  'bg-orange-50 text-orange-600', 'bg-lime-50 text-lime-600', 'bg-sky-50 text-sky-600',
];
const FALLBACK_ICONS: React.ElementType[] = [FileText, ClipboardList, ListChecks, FileBarChart];

function hashId(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

export function tabMetaFor(id: string): { icon: React.ElementType; chip: string } {
  const explicit = TAB_META[id];
  if (explicit) return explicit;
  const h = hashId(id);
  return { icon: FALLBACK_ICONS[h % FALLBACK_ICONS.length]!, chip: FALLBACK_CHIPS[h % FALLBACK_CHIPS.length]! };
}

// ─── Layout persistence ───────────────────────────────────────────────────────

interface TabLayout {
  /** Visible tab ids in display order. */
  ordered: string[];
  hidden: string[];
  reorder: (newVisible: string[]) => void;
  toggleHidden: (id: string) => void;
}

interface TabPrefs { order: string[]; hidden: string[] }

function loadPrefs(key: string): TabPrefs {
  try {
    const raw = localStorage.getItem(`eng-tabbar:${key}`);
    if (raw) {
      const p = JSON.parse(raw) as Partial<TabPrefs>;
      return { order: Array.isArray(p.order) ? p.order : [], hidden: Array.isArray(p.hidden) ? p.hidden : [] };
    }
  } catch { /* ignore */ }
  return { order: [], hidden: [] };
}

/**
 * Manage tab order + hidden set for a bar, reconciled against the current valid
 * ids (which can change, e.g. when scope reveals more tabs). Persists per key.
 */
export function useTabLayout(key: string, tabIds: string[]): TabLayout {
  const idsKey = tabIds.join(',');
  const [prefs, setPrefs] = useState<TabPrefs>(() => loadPrefs(key));

  const order = useMemo(() => {
    const known = prefs.order.filter(id => tabIds.includes(id));
    const extra = tabIds.filter(id => !known.includes(id));
    return [...known, ...extra];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefs.order, idsKey]);

  const hidden = useMemo(
    () => prefs.hidden.filter(id => tabIds.includes(id)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [prefs.hidden, idsKey],
  );

  const ordered = useMemo(() => order.filter(id => !hidden.includes(id)), [order, hidden]);

  useEffect(() => {
    try { localStorage.setItem(`eng-tabbar:${key}`, JSON.stringify({ order, hidden })); } catch { /* ignore */ }
  }, [key, order, hidden]);

  const reorder = (newVisible: string[]) => {
    setPrefs(prev => {
      const full = [...order];
      let vi = 0;
      for (let i = 0; i < full.length; i += 1) {
        if (!hidden.includes(full[i]!)) full[i] = newVisible[vi++]!;
      }
      return { order: full, hidden: prev.hidden };
    });
  };

  const toggleHidden = (id: string) => {
    setPrefs(prev => {
      const isHidden = prev.hidden.includes(id);
      // Never hide the last remaining visible tab.
      if (!isHidden && ordered.length <= 1) return prev;
      return { order: order, hidden: isHidden ? prev.hidden.filter(x => x !== id) : [...prev.hidden, id] };
    });
  };

  return { ordered, hidden, reorder, toggleHidden };
}

// ─── Component ────────────────────────────────────────────────────────────────

export function EngagementTabBar({
  tabs, activeTab, onSelect, storageKey, size = 'sm',
}: {
  tabs: TabDef[];
  activeTab: string;
  onSelect: (id: string) => void;
  storageKey: string;
  size?: 'sm' | 'md';
}): ReactNode {
  const tabIds = tabs.map(t => t.id);
  const { ordered, hidden, reorder, toggleHidden } = useTabLayout(storageKey, tabIds);
  const [menuOpen, setMenuOpen] = useState(false);

  const byId = useMemo(() => new Map(tabs.map(t => [t.id, t])), [tabs]);
  const visibleTabs = ordered.map(id => byId.get(id)).filter(Boolean) as TabDef[];

  // If the active tab gets hidden (or filtered out), fall back to the first visible one.
  useEffect(() => {
    if (!ordered.includes(activeTab) && ordered.length > 0) onSelect(ordered[0]!);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ordered.join(','), activeTab]);

  const pad = size === 'md' ? 'px-4 py-2.5 text-[13px]' : 'px-3 py-2 text-[11.5px]';
  const chip = size === 'md' ? 'w-6 h-6' : 'w-5 h-5';
  const iconSize = size === 'md' ? 13 : 12;

  return (
    <div className="border-b border-border-light mb-4">
      <div className="flex items-center">
        <div className="flex items-center gap-0.5 overflow-x-auto pb-px flex-1 min-w-0">
        <Reorder.Group as="div" axis="x" values={ordered} onReorder={reorder} className="flex items-center gap-0.5">
          {visibleTabs.map(tab => {
            const meta = tabMetaFor(tab.id);
            const Icon = meta.icon;
            const active = activeTab === tab.id;
            return (
              <Reorder.Item as="div" key={tab.id} value={tab.id} title="Drag to reorder" className="shrink-0 cursor-grab active:cursor-grabbing">
                <button
                  onClick={() => onSelect(tab.id)}
                  className={`group flex items-center gap-1.5 ${pad} font-semibold whitespace-nowrap border-b-2 transition-colors cursor-pointer select-none ${
                    active ? 'border-primary text-primary' : 'border-transparent text-gray-400 hover:text-text hover:border-gray-200'
                  }`}
                >
                  <span className={`inline-flex items-center justify-center ${chip} rounded-md ${meta.chip}`}>
                    <Icon size={iconSize} />
                  </span>
                  {tab.label}
                  <GripHorizontal size={11} className="text-text-muted/40 opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              </Reorder.Item>
            );
          })}
        </Reorder.Group>
        </div>

        {/* Show/hide menu — kept outside the horizontal scroller so its popover isn't clipped */}
        <div className="relative shrink-0 pl-2">
          <button
            onClick={() => setMenuOpen(o => !o)}
            aria-label="Show or hide tabs"
            className={`inline-flex items-center gap-1 px-2 h-7 rounded-md border text-[11px] font-medium transition-colors cursor-pointer ${
              menuOpen ? 'bg-primary-xlight/50 border-primary/30 text-primary' : 'border-border-light bg-white text-text-muted hover:text-text hover:bg-surface-2'
            }`}
          >
            <SlidersHorizontal size={12} /> Tabs
          </button>
          <AnimatePresence>
            {menuOpen && (
              <>
                <button className="fixed inset-0 z-20 cursor-default" aria-hidden onClick={() => setMenuOpen(false)} />
                <motion.div
                  initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.14 }}
                  className="absolute right-0 top-full mt-1.5 z-30 w-60 rounded-xl border border-border-light bg-white shadow-lg overflow-hidden"
                >
                  <div className="px-3 py-2 border-b border-border-light">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-text-muted">Show / hide tabs</div>
                    <div className="text-[10.5px] text-text-muted mt-0.5">Drag the tab headers to reorder.</div>
                  </div>
                  <div className="py-1 max-h-[280px] overflow-y-auto">
                    {tabs.map(tab => {
                      const meta = tabMetaFor(tab.id);
                      const Icon = meta.icon;
                      const visible = !hidden.includes(tab.id);
                      return (
                        <label key={tab.id} className="flex items-center gap-2.5 px-3 py-2 hover:bg-surface-2/50 cursor-pointer transition-colors">
                          <input type="checkbox" checked={visible} onChange={() => toggleHidden(tab.id)} className="w-4 h-4 rounded border-border accent-primary cursor-pointer" />
                          <span className={`inline-flex items-center justify-center w-5 h-5 rounded-md ${meta.chip} ${visible ? '' : 'opacity-50'}`}>
                            <Icon size={11} />
                          </span>
                          <span className={`text-[12px] font-medium ${visible ? 'text-text' : 'text-text-muted'}`}>{tab.label}</span>
                          <span className="ml-auto text-text-muted">{visible ? <Eye size={12} /> : <EyeOff size={12} />}</span>
                        </label>
                      );
                    })}
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
