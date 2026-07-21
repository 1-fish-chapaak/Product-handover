/**
 * DrillContext
 * ────────────
 * Global drill-down state for the dashboard.
 *
 * Hierarchy (drillLevel):
 *  0 → Monthly H1  (Jan–Jun, default)
 *  1 → Weekly      (weeks within the selected month)
 *  2 → Daily       (days within the selected week / all days of a month on double-drill)
 *
 * Drill flow:
 *  1. User clicks ↓ or ↓↓ button on any card toolbar → enables drill-click mode
 *  2. Clicking any bar/slice on a chart triggers drillIntoItem(label)
 *  3. All charts respond by showing sub-data for that item at the next level
 *  4. DrillBanner breadcrumb shows the current path and lets you jump back
 */

import { createContext, useContext, useState, type ReactNode } from "react";

export type DrillLevel = 0 | 1 | 2 | 3 | 4;

export interface DrillLevelMeta {
  label: string;
  shortLabel: string;
  description: string;
  icon: string;
}

export const DRILL_LEVEL_META: Record<DrillLevel, DrillLevelMeta> = {
  0: { label: "Monthly (H1)",   shortLabel: "Monthly H1", description: "Jan – Jun overview",        icon: "📅" },
  1: { label: "Weekly",         shortLabel: "Weekly",     description: "Weeks within month",        icon: "📆" },
  2: { label: "Daily",          shortLabel: "Daily",      description: "Days within week / month",  icon: "🗓️" },
  3: { label: "Hourly",         shortLabel: "Hourly",     description: "Hours within a day",        icon: "📊" },
  4: { label: "Per Transaction",shortLabel: "Transaction",description: "Transaction-level detail",  icon: "🔍" },
};

export interface DrillState {
  level: DrillLevel;
  path: string[];
  drillModeActive: boolean;
  doubleDrillPending: boolean;
  doubleDrillMode: 0 | 1 | 2 | 3;
  activeDrillCardId?: string | null;
  resetCount: number;
  /**
   * Increments every time the Drill-Up toolbar button fires while DD mode is
   * active at level 0 (DD1 internal steps). Charts watch this to step back
   * through their own local hierarchy without needing ctxLevel to change.
   */
  drillUpCount: number;
}

export interface DrillContextValue {
  drillState: DrillState;
  isDrillActive: boolean;

  activateSingleDrill: (cardId?: string) => void;
  activateDoubleDrill: (cardId?: string) => void;
  drillIntoItem: (label: string) => void;
  drillUp: () => void;
  goNextLevel: () => void;
  expandAllDown: () => void;
  resetHierarchy: () => void;
  jumpToLevel: (level: DrillLevel) => void;
  deactivateDrill: () => void;
  /** Signal charts to step back one local level (used when DD is active at ctx level 0) */
  signalDrillUp: () => void;
}

export const DrillContext = createContext<DrillContextValue | null>(null);

/** Each UnifiedCard provides its own ID here so child charts can gate drill state */
export const DrillCardIdContext = createContext<string | null>(null);

export function DrillProvider({ children }: { children: ReactNode }) {
  const [drillState, setDrillState] = useState<DrillState>({
    level: 0,
    path: [],
    drillModeActive: false,
    doubleDrillPending: false,
    doubleDrillMode: 0,
    resetCount: 0,
    drillUpCount: 0,
  });

  const MAX: DrillLevel = 2;

  const activateSingleDrill = (cardId?: string) =>
    setDrillState(prev => {
      const isSwitchingTarget = prev.activeDrillCardId && prev.activeDrillCardId !== cardId;
      const turningOn = isSwitchingTarget ? true : !prev.drillModeActive;
      return {
        ...prev,
        drillModeActive: turningOn,
        doubleDrillPending: false,
        activeDrillCardId: turningOn ? (cardId || null) : null,
        // Reset level/path when switching to a different widget's drill
        ...(isSwitchingTarget ? { level: 0 as DrillLevel, path: [] } : {}),
      };
    });

  const activateDoubleDrill = (cardId?: string) =>
    setDrillState(prev => {
      const cur = prev.doubleDrillMode ?? 0;
      const next = (cur >= 3 ? 0 : cur + 1) as 0 | 1 | 2 | 3;
      const isSwitchingTarget = prev.activeDrillCardId && prev.activeDrillCardId !== cardId;
      return {
        ...prev,
        doubleDrillMode: next,
        doubleDrillPending: next > 0,
        drillModeActive: false,
        activeDrillCardId: next > 0 ? (cardId || null) : null,
        // Reset level/path when switching to a different widget's drill
        ...(isSwitchingTarget ? { level: 0 as DrillLevel, path: [] } : {}),
      };
    });

  const drillIntoItem = (label: string) =>
    setDrillState(prev => {
      if (prev.level >= MAX) return { ...prev, drillModeActive: false, doubleDrillPending: false, activeDrillCardId: null };
      // Always advance exactly ONE level — double-drill just keeps the mode
      // alive for a second click instead of jumping two levels at once.
      const next = (prev.level + 1) as DrillLevel;
      const reachedMax = next >= MAX;
      // Keep doubleDrillPending active until we actually reach MAX
      const keepDouble = prev.doubleDrillPending && !reachedMax;
      return {
        ...prev,
        level: next,
        path: [...prev.path, label],
        drillModeActive: prev.drillModeActive && !reachedMax,
        doubleDrillPending: keepDouble,
        activeDrillCardId: (!reachedMax && (prev.drillModeActive || keepDouble))
          ? prev.activeDrillCardId
          : null,
      };
    });

  const drillUp = () =>
    setDrillState(prev => {
      if (prev.level === 0) return { ...prev, drillModeActive: false, doubleDrillPending: false, doubleDrillMode: 0, activeDrillCardId: null };
      const next = (prev.level - 1) as DrillLevel;
      return { ...prev, level: next, path: prev.path.slice(0, -1), drillModeActive: false, doubleDrillPending: false, doubleDrillMode: 0, activeDrillCardId: null };
    });

  const goNextLevel = () =>
    setDrillState(prev => {
      if (prev.level >= MAX) return prev;
      const next = (prev.level + 1) as DrillLevel;
      const autoLabel = prev.level === 0 ? "Jan" : prev.level === 1 ? "Wk 1" : "Mon";
      return { ...prev, level: next, path: [...prev.path, autoLabel], drillModeActive: false, doubleDrillPending: false, activeDrillCardId: null };
    });

  const expandAllDown = () =>
    setDrillState(prev => {
      if (prev.level >= MAX) return prev;
      const next = (prev.level + 1) as DrillLevel;
      return { ...prev, level: next, path: [...prev.path, "All"], drillModeActive: false, doubleDrillPending: false, activeDrillCardId: null };
    });

  const deactivateDrill = () =>
    setDrillState(prev => ({
      ...prev,
      drillModeActive: false,
      doubleDrillPending: false,
      doubleDrillMode: 0,
      activeDrillCardId: null,
    }));

  const resetHierarchy = () =>
    setDrillState(prev => ({
      ...prev,                           // ← preserve drillUpCount (and any future fields)
      level: 0,
      path: [],
      drillModeActive: false,
      doubleDrillPending: false,
      doubleDrillMode: 0,
      activeDrillCardId: null,
      resetCount: (prev.resetCount ?? 0) + 1,
    }));

  const jumpToLevel = (level: DrillLevel) =>
    setDrillState(prev => {
      if (level === prev.level) return prev;
      const newPath = level < prev.level ? prev.path.slice(0, level) : prev.path;
      return { ...prev, level, path: newPath, drillModeActive: false, doubleDrillPending: false, doubleDrillMode: 0, activeDrillCardId: null };
    });

  const signalDrillUp = () =>
    setDrillState(prev => ({
      ...prev,
      drillUpCount: (prev.drillUpCount ?? 0) + 1,
    }));

  const isDrillActive =
    drillState.level > 0 ||
    drillState.drillModeActive ||
    drillState.doubleDrillPending;

  return (
    <DrillContext.Provider
      value={{
        drillState,
        isDrillActive,
        activateSingleDrill,
        activateDoubleDrill,
        drillIntoItem,
        drillUp,
        goNextLevel,
        expandAllDown,
        resetHierarchy,
        jumpToLevel,
        deactivateDrill,
        signalDrillUp,
      }}
    >
      {children}
    </DrillContext.Provider>
  );
}

export function useDrill(): DrillContextValue {
  const ctx = useContext(DrillContext);
  if (!ctx) throw new Error("useDrill must be used within a DrillProvider");
  return ctx;
}

export function useDrillSafe(): DrillContextValue | null {
  return useContext(DrillContext);
}

/* ─────────────────────────────────────────────────────────────
   DrillBanner  –  appears below the filter bar when drill is active
───────────────────────────────────────────────────────────────── */
import { motion, AnimatePresence } from "motion/react";
import { ChevronRight, X, Layers, MousePointer2 } from "lucide-react";

export function DrillBanner() {
  const { drillState, isDrillActive, jumpToLevel, resetHierarchy } = useDrill();
  const { level, path, drillModeActive, doubleDrillPending } = drillState;

  const isInteractive = drillModeActive || doubleDrillPending;
  const showBanner = isDrillActive;

  return (
    <AnimatePresence>
      {showBanner && (
        <motion.div
          key="drill-banner"
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.22, ease: "easeOut" }}
          className="overflow-hidden shrink-0 z-10 relative"
        >
          <div className="flex items-center gap-2 px-4 sm:px-6 py-2 bg-[#6a12cd]/6 border-b border-[#6a12cd]/15" style={{ display: "none" }}>
            {/* Icon + Label */}
            <div className="flex items-center gap-1.5 shrink-0">
              <div className="p-1 bg-[#6a12cd]/10 rounded-md">
                {isInteractive
                  ? <MousePointer2 className="size-3 text-[#6a12cd]" />
                  : <Layers className="size-3 text-[#6a12cd]" />
                }
              </div>
              <span className="font-mono text-[0.75rem] font-semibold text-[#6a12cd] whitespace-nowrap">
                {isInteractive
                  ? doubleDrillPending
                    ? drillState.doubleDrillMode === 1 ? "DD1 — State → Category → Sub-Category → Product"
                      : drillState.doubleDrillMode === 2 ? "DD2 — City → Product"
                      : drillState.doubleDrillMode === 3 ? "DD3 — Top Stores across all States"
                      : "Double Drilldown Activated"
                    : "Drill Mode — Click a bar"
                  : "Drill Active"
                }
              </span>
            </div>

            <ChevronRight className="size-3 text-[#6a12cd]/40 shrink-0" />

            {/* Breadcrumb trail */}
            <div className="flex items-center gap-1 flex-wrap min-w-0">
              {/* Root node */}
              <button
                onClick={resetHierarchy}
                className="font-mono text-[0.75rem] text-[#6a12cd]/60 hover:text-[#6a12cd] transition-colors px-1.5 py-0.5 rounded hover:bg-[#6a12cd]/10 shrink-0"
              >
                {DRILL_LEVEL_META[0].shortLabel}
              </button>

              {/* Each drill step */}
              {path.map((step, i) => {
                const targetLevel = (i + 1) as DrillLevel;
                const isActive = targetLevel === level && !isInteractive;
                return (
                  <div key={i} className="flex items-center gap-1 shrink-0">
                    <ChevronRight className="size-2.5 text-[#6a12cd]/30" />
                    <button
                      onClick={() => jumpToLevel(targetLevel)}
                      className={`font-mono text-[0.75rem] px-1.5 py-0.5 rounded transition-all ${
                        isActive
                          ? "bg-[#6a12cd] text-white"
                          : "text-[#6a12cd]/70 hover:text-[#6a12cd] hover:bg-[#6a12cd]/10"
                      }`}
                    >
                      {step}
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Current level description pill */}
            {!isInteractive && level > 0 && (
              <div className="ml-1 hidden sm:flex items-center gap-1 shrink-0">
                <span className="text-[0.625rem] text-ink-400">→</span>
                <span className="text-[0.625rem] bg-white border border-[#6a12cd]/20 text-[#6a12cd] px-2 py-0.5 rounded-full">
                  {DRILL_LEVEL_META[level].description}
                </span>
              </div>
            )}

            {/* Right side — reset */}
            <div className="ml-auto flex items-center gap-1 shrink-0">
              <button
                onClick={resetHierarchy}
                className="flex items-center gap-1 px-2 py-0.5 text-[0.625rem] text-ink-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-200"
              >
                <X className="size-2.5" />
                Clear
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}