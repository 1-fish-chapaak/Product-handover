"use client";

import { memo, useEffect, useMemo, useRef, useState, type FC, type ReactNode } from 'react';
import {
  type RiveParameters,
  useRive,
  useStateMachineInput,
  useViewModel,
  useViewModelInstance,
  useViewModelInstanceColor,
} from '@rive-app/react-webgl2';

export type PersonaState = 'idle' | 'listening' | 'thinking' | 'speaking' | 'asleep';

export type PersonaVariant = keyof typeof sources;

interface AIPersonaProps {
  state: PersonaState;
  variant?: PersonaVariant;
  className?: string;
  onLoad?: RiveParameters['onLoad'];
  onLoadError?: RiveParameters['onLoadError'];
  onReady?: () => void;
  onPause?: RiveParameters['onPause'];
  onPlay?: RiveParameters['onPlay'];
  onStop?: RiveParameters['onStop'];
}

const SM = 'default';

const sources = {
  obsidian: {
    source: 'https://ejiidnob33g9ap1r.public.blob.vercel-storage.com/obsidian-2.0.riv',
    dynamicColor: true,
    hasModel: true,
  },
  mana: {
    source: 'https://ejiidnob33g9ap1r.public.blob.vercel-storage.com/mana-2.0.riv',
    dynamicColor: false,
    hasModel: true,
  },
  opal: {
    source: 'https://ejiidnob33g9ap1r.public.blob.vercel-storage.com/orb-1.2.riv',
    dynamicColor: false,
    hasModel: false,
  },
  halo: {
    source: 'https://ejiidnob33g9ap1r.public.blob.vercel-storage.com/halo-2.0.riv',
    dynamicColor: true,
    hasModel: true,
  },
  glint: {
    source: 'https://ejiidnob33g9ap1r.public.blob.vercel-storage.com/glint-2.0.riv',
    dynamicColor: true,
    hasModel: true,
  },
  command: {
    source: 'https://ejiidnob33g9ap1r.public.blob.vercel-storage.com/command-2.0.riv',
    dynamicColor: true,
    hasModel: true,
  },
} as const;

/* ─── Theme Detection ─── */

const getCurrentTheme = (): 'light' | 'dark' => {
  if (typeof window !== 'undefined') {
    if (document.documentElement.classList.contains('dark')) return 'dark';
    if (window.matchMedia?.('(prefers-color-scheme: dark)').matches) return 'dark';
  }
  return 'light';
};

const useTheme = (enabled: boolean) => {
  const [theme, setTheme] = useState<'light' | 'dark'>(getCurrentTheme);

  useEffect(() => {
    if (!enabled) return;

    const observer = new MutationObserver(() => setTheme(getCurrentTheme()));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

    let mql: MediaQueryList | null = null;
    const onMediaChange = () => setTheme(getCurrentTheme());

    if (window.matchMedia) {
      mql = window.matchMedia('(prefers-color-scheme: dark)');
      mql.addEventListener('change', onMediaChange);
    }

    return () => {
      observer.disconnect();
      mql?.removeEventListener('change', onMediaChange);
    };
  }, [enabled]);

  return theme;
};

/* ─── View-Model Wrappers ─── */

const PersonaWithModel = memo(
  ({ rive, source, children }: { rive: ReturnType<typeof useRive>['rive']; source: (typeof sources)[PersonaVariant]; children: ReactNode }) => {
    const theme = useTheme(source.dynamicColor);
    const viewModel = useViewModel(rive, { useDefault: true });
    const viewModelInstance = useViewModelInstance(viewModel, { rive, useDefault: true });
    const colorProp = useViewModelInstanceColor('color', viewModelInstance);

    useEffect(() => {
      if (!(colorProp && source.dynamicColor)) return;
      // Brand purple in dark mode, deep navy in light mode
      const [r, g, b] = theme === 'dark' ? [106, 18, 205] : [14, 11, 30];
      colorProp.setRgb(r, g, b);
    }, [colorProp, theme, source.dynamicColor]);

    return <>{children}</>;
  },
);
PersonaWithModel.displayName = 'PersonaWithModel';

const PersonaWithoutModel = memo(({ children }: { children: ReactNode }) => <>{children}</>);
PersonaWithoutModel.displayName = 'PersonaWithoutModel';

/* ─── Main Component ─── */

export const AIPersona: FC<AIPersonaProps> = memo(
  ({ variant = 'halo', state = 'idle', onLoad, onLoadError, onReady, onPause, onPlay, onStop, className = '' }) => {
    const source = sources[variant];

    const callbacksRef = useRef({ onLoad, onLoadError, onReady, onPause, onPlay, onStop });
    callbacksRef.current = { onLoad, onLoadError, onReady, onPause, onPlay, onStop };

    const stableCallbacks = useMemo(
      () => ({
        onLoad: ((r) => callbacksRef.current.onLoad?.(r)) as RiveParameters['onLoad'],
        onLoadError: ((e) => callbacksRef.current.onLoadError?.(e)) as RiveParameters['onLoadError'],
        onReady: () => callbacksRef.current.onReady?.(),
        onPause: ((ev) => callbacksRef.current.onPause?.(ev)) as RiveParameters['onPause'],
        onPlay: ((ev) => callbacksRef.current.onPlay?.(ev)) as RiveParameters['onPlay'],
        onStop: ((ev) => callbacksRef.current.onStop?.(ev)) as RiveParameters['onStop'],
      }),
      [],
    );

    const { rive, RiveComponent } = useRive({
      src: source.source,
      stateMachines: SM,
      autoplay: true,
      onLoad: stableCallbacks.onLoad,
      onLoadError: stableCallbacks.onLoadError,
      onRiveReady: stableCallbacks.onReady,
      onPause: stableCallbacks.onPause,
      onPlay: stableCallbacks.onPlay,
      onStop: stableCallbacks.onStop,
    });

    const listening = useStateMachineInput(rive, SM, 'listening');
    const thinking = useStateMachineInput(rive, SM, 'thinking');
    const speaking = useStateMachineInput(rive, SM, 'speaking');
    const asleep = useStateMachineInput(rive, SM, 'asleep');

    useEffect(() => {
      if (listening) listening.value = state === 'listening';
      if (thinking) thinking.value = state === 'thinking';
      if (speaking) speaking.value = state === 'speaking';
      if (asleep) asleep.value = state === 'asleep';
    }, [state, listening, thinking, speaking, asleep]);

    const Wrapper = source.hasModel ? PersonaWithModel : PersonaWithoutModel;

    return (
      <Wrapper rive={rive} source={source}>
        <RiveComponent className={`shrink-0 ${className}`} />
      </Wrapper>
    );
  },
);
AIPersona.displayName = 'AIPersona';

/* ─── State Config ─── */

const stateConfig: Record<PersonaState, { label: string; color: string; activeColor: string; icon: string }> = {
  idle: {
    label: 'Idle',
    color: 'border-border text-text-secondary hover:border-primary/30 hover:text-text',
    activeColor: 'border-primary/40 bg-primary-xlight text-primary shadow-[0_0_12px_rgba(106,18,205,0.1)]',
    icon: '◆',
  },
  listening: {
    label: 'Listening',
    color: 'border-border text-text-secondary hover:border-info/30 hover:text-text',
    activeColor: 'border-info/40 bg-info-bg text-info shadow-[0_0_12px_rgba(2,132,199,0.1)]',
    icon: '◉',
  },
  thinking: {
    label: 'Thinking',
    color: 'border-border text-text-secondary hover:border-primary/30 hover:text-text',
    activeColor: 'border-primary/40 bg-primary-xlight text-primary shadow-[0_0_12px_rgba(106,18,205,0.1)]',
    icon: '◈',
  },
  speaking: {
    label: 'Speaking',
    color: 'border-border text-text-secondary hover:border-success/30 hover:text-text',
    activeColor: 'border-success/40 bg-success-bg text-success shadow-[0_0_12px_rgba(22,163,74,0.1)]',
    icon: '▣',
  },
  asleep: {
    label: 'Asleep',
    color: 'border-border text-text-secondary hover:border-text-muted/30 hover:text-text',
    activeColor: 'border-text-muted/40 bg-surface-2 text-text-muted shadow-[0_0_12px_rgba(158,150,184,0.1)]',
    icon: '◌',
  },
};

const variants: PersonaVariant[] = ['obsidian', 'mana', 'opal', 'halo', 'glint', 'command'];

/* ─── Demo ─── */

export default function PersonaDemo() {
  const [state, setState] = useState<PersonaState>('thinking');
  const [variant, setVariant] = useState<PersonaVariant>('glint');

  return (
    <div className="flex w-full max-w-md flex-col items-center gap-8 rounded-2xl border border-border-light bg-surface p-8 shadow-[0_1px_3px_rgba(106,18,205,0.04)]">
      {/* Persona Display */}
      <div className="relative flex flex-col items-center gap-3">
        {/* Glow ring behind persona */}
        <div className="relative">
          <div
            className={`absolute inset-0 rounded-full blur-xl transition-all duration-700 ${
              state === 'thinking'
                ? 'bg-primary/10 scale-125'
                : state === 'speaking'
                  ? 'bg-success/8 scale-110'
                  : state === 'listening'
                    ? 'bg-info/8 scale-110'
                    : 'bg-transparent scale-100'
            }`}
          />
          <AIPersona key={variant} state={state} variant={variant} className="relative size-36" />
        </div>

        {/* State indicator */}
        <div className="flex items-center gap-2">
          <span
            className={`inline-block size-1.5 rounded-full transition-colors duration-300 ${
              state === 'idle'
                ? 'bg-primary/50'
                : state === 'listening'
                  ? 'bg-info animate-pulse'
                  : state === 'thinking'
                    ? 'bg-primary animate-pulse'
                    : state === 'speaking'
                      ? 'bg-success animate-pulse'
                      : 'bg-text-muted/40'
            }`}
          />
          <span className="text-[0.75rem] font-medium text-text-muted">
            {state}
          </span>
        </div>
      </div>

      {/* Variant Selector */}
      <div className="flex w-full flex-col gap-2">
        <span className="text-[0.75rem] font-medium text-text-muted">
          Variant
        </span>
        <div className="grid grid-cols-3 gap-1.5">
          {variants.map((v) => (
            <button
              key={v}
              onClick={() => setVariant(v)}
              className={`rounded-lg border px-3 py-1.5 text-[0.75rem] font-medium capitalize transition-all duration-200 cursor-pointer ${
                variant === v
                  ? 'border-primary/40 bg-primary-xlight text-primary shadow-[0_0_8px_rgba(106,18,205,0.08)]'
                  : 'border-border-light bg-surface text-text-secondary hover:border-primary/20 hover:bg-primary-xlight/50'
              }`}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {/* State Controls */}
      <div className="flex w-full flex-col gap-2">
        <span className="text-[0.75rem] font-medium text-text-muted">
          State
        </span>
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(stateConfig) as PersonaState[]).map((s) => {
            const cfg = stateConfig[s];
            const isActive = state === s;
            return (
              <button
                key={s}
                onClick={() => setState(s)}
                className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[0.75rem] font-medium transition-all duration-200 cursor-pointer ${
                  isActive ? cfg.activeColor : cfg.color
                }`}
              >
                <span className="text-[0.75rem]">{cfg.icon}</span>
                {cfg.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
