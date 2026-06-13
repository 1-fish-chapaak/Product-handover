/**
 * Workspace chooser. No backend auth — pick a workspace and enter. The
 * signed-in identity is the default user; in production the user's role
 * comes from their invited account, and that role drives all access.
 */

import { useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { Sparkles, ArrowRight, Building2, Check } from 'lucide-react';
import { useCurrentUser, DEFAULT_USER } from '../../context/CurrentUserContext';
import { WORKSPACES } from '../../data/workspaces';
import BrandPanelFX from './BrandPanelFX';

export default function LoginView() {
  const { signIn, setActiveWorkspace } = useCurrentUser();
  const [selected, setSelected] = useState<string>(WORKSPACES[0].id);
  const reduce = useReducedMotion();

  const enter = () => { setActiveWorkspace(selected); signIn(DEFAULT_USER.id); };

  /** Approved cascade reveal — one-by-one spring with absolute delays.
   *  Same spring/stagger constants as the chat follow-up chips. */
  const rise = (i: number, fromScale = 0.98) =>
    reduce
      ? { initial: false as const }
      : {
          initial: { opacity: 0, y: 12, scale: fromScale },
          animate: { opacity: 1, y: 0, scale: 1 },
          transition: { delay: 0.15 + i * 0.08, type: 'spring' as const, stiffness: 460, damping: 24, mass: 0.7 },
        };

  /** Slow ambient drift for the brand-glow blooms. */
  const drift = (x: number, y: number, scale: number, duration: number) =>
    reduce
      ? {}
      : {
          animate: { x: [0, x, 0], y: [0, y, 0], scale: [1, scale, 1] },
          transition: { duration, repeat: Infinity, ease: 'easeInOut' as const },
        };

  return (
    <div className="flex h-screen w-full bg-canvas">
      {/* Brand panel */}
      <div className="hidden lg:flex w-[44%] flex-col bg-sidebar-bg text-white p-12 relative overflow-hidden">
        {/* ambient brand glow — gives the dark panel depth + slow life */}
        <motion.div
          className="absolute -top-40 -right-32 w-[520px] h-[520px] rounded-full bg-brand-600/30 blur-[130px]"
          {...drift(24, 18, 1.1, 16)}
        />
        <motion.div
          className="absolute top-1/3 -left-44 w-[440px] h-[440px] rounded-full bg-brand-500/15 blur-[130px]"
          {...drift(28, -20, 1.12, 21)}
        />
        <motion.div
          className="absolute -bottom-40 right-1/4 w-[400px] h-[400px] rounded-full bg-brand-400/10 blur-[130px]"
          {...drift(-22, 16, 1.08, 13)}
        />
        {/* drifting particles + draw-in hairline accents */}
        <BrandPanelFX />

        {/* logo — top */}
        <motion.div className="flex items-center gap-2.5 relative z-10" {...rise(0)}>
          <div
            className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-500 to-brand-400 flex items-center justify-center"
            style={{ boxShadow: '0 2px 8px rgb(106 18 205 / 0.30)' }}
          >
            <Sparkles size={18} className="text-white" />
          </div>
          <span className="text-[14px] font-bold tracking-tight">IRAME.AI</span>
        </motion.div>

        {/* hero — optically centered in the remaining space */}
        <div className="flex-1 flex flex-col justify-center relative z-10">
          <motion.div className="flex items-center gap-3 mb-7" {...rise(1)}>
            {/* animated shimmer line */}
            <div className="relative h-px w-10 overflow-hidden bg-white/20">
              <motion.div
                aria-hidden
                className="absolute inset-y-0 left-0 w-1/2 bg-gradient-to-r from-transparent via-white/90 to-transparent"
                animate={reduce ? undefined : { x: ['-120%', '260%'] }}
                transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut', repeatDelay: 0.8 }}
              />
            </div>
            <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-white/45">
              Irame · Ask IRA
            </span>
          </motion.div>

          <motion.h1
            className="text-shimmer font-display text-[2.75rem] leading-[1.08] tracking-tight mb-5"
            {...rise(2)}
          >
            Ask your evidence.<br />Audit the answer.
          </motion.h1>

          <motion.p className="text-shimmer-dim text-[0.9375rem] leading-relaxed max-w-[400px]" {...rise(3)}>
            Ask a data question or build a workflow you can re-run every quarter
            — in one thread. Every answer shows its plan, its code, and its
            sources.
          </motion.p>
        </div>

        {/* footer — grounds the bottom */}
        <motion.div className="relative z-10 text-white/35 text-[0.8125rem] tracking-tight" {...rise(4)}>
          © 2026 IRAME.AI
        </motion.div>
      </div>

      {/* Workspace chooser — open form, no container */}
      <div className="relative flex-1 flex items-center justify-center px-6 py-10 overflow-hidden">
        {/* modern grid + brand orb (21st.dev community "Magenta Orb Grid", recolored to brand) */}
        <div
          className="absolute inset-0 z-0"
          style={{
            backgroundImage: `
              linear-gradient(to right, rgba(106,18,205,0.025) 1px, transparent 1px),
              linear-gradient(to bottom, rgba(106,18,205,0.025) 1px, transparent 1px),
              radial-gradient(circle at 50% 52%, rgba(106,18,205,0.05) 0%, rgba(136,56,222,0.025) 38%, transparent 70%)
            `,
            backgroundSize: '38px 38px, 38px 38px, 100% 100%',
            maskImage: 'radial-gradient(ellipse 75% 65% at 50% 50%, black 25%, transparent 92%)',
            WebkitMaskImage: 'radial-gradient(ellipse 75% 65% at 50% 50%, black 25%, transparent 92%)',
          }}
        />
        <div className="relative z-10 w-full max-w-[400px]">
          <div className="lg:hidden flex items-center gap-2.5 mb-10">
            <div
              className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-500 to-brand-400 text-white flex items-center justify-center"
              style={{ boxShadow: '0 2px 8px rgb(106 18 205 / 0.30)' }}
            >
              <Sparkles size={18} className="text-white" />
            </div>
            <span className="text-[14px] font-bold tracking-tight text-ink-900">IRAME.AI</span>
          </div>

          <motion.h2
            id="ws-chooser-heading"
            className="text-[1.5rem] font-semibold tracking-tight text-ink-900 mb-1.5"
            {...rise(0)}
          >
            Choose a workspace
          </motion.h2>
          <motion.p className="text-[0.875rem] text-ink-500 mb-8" {...rise(1)}>
            You have access to more than one. Select where to continue.
          </motion.p>

          <div role="radiogroup" aria-labelledby="ws-chooser-heading" className="space-y-2.5 mb-8">
            {WORKSPACES.map((ws, i) => {
              const active = selected === ws.id;
              const onArrow = (e: React.KeyboardEvent<HTMLButtonElement>) => {
                if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
                e.preventDefault();
                const dir = e.key === 'ArrowDown' ? 1 : -1;
                const next = WORKSPACES[(i + dir + WORKSPACES.length) % WORKSPACES.length];
                setSelected(next.id);
                e.currentTarget.parentElement
                  ?.querySelector<HTMLButtonElement>(`[data-ws-id="${next.id}"]`)
                  ?.focus();
              };
              return (
                <motion.button
                  key={ws.id}
                  data-ws-id={ws.id}
                  role="radio"
                  aria-checked={active}
                  tabIndex={active ? 0 : -1}
                  onClick={() => setSelected(ws.id)}
                  onKeyDown={onArrow}
                  {...rise(2 + i, 0.96)}
                  whileTap={reduce ? undefined : { scale: 0.99 }}
                  className={`w-full flex items-center gap-3.5 px-3.5 h-[64px] rounded-lg border text-left transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-600/25 ${
                    active
                      ? 'border-brand-600 bg-brand-50'
                      : 'border-canvas-border bg-canvas-elevated hover:border-ink-300'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                    active ? 'bg-brand-600 text-white' : 'bg-brand-50 text-brand-600'
                  }`}>
                    <Building2 size={18} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[0.9375rem] font-semibold text-ink-900 truncate leading-tight">{ws.name}</div>
                    <div className="text-[0.8125rem] text-ink-500 truncate mt-0.5">{ws.description}</div>
                  </div>
                  <div className={`shrink-0 w-5 h-5 rounded-full border flex items-center justify-center transition-colors ${
                    active ? 'border-brand-600 bg-brand-600 text-white' : 'border-ink-300'
                  }`}>
                    {active && (
                      <motion.span
                        initial={reduce ? false : { scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: 'spring', stiffness: 520, damping: 22, mass: 0.6 }}
                      >
                        <Check size={13} strokeWidth={3} />
                      </motion.span>
                    )}
                  </div>
                </motion.button>
              );
            })}
          </div>

          <motion.button
            onClick={enter}
            {...rise(2 + WORKSPACES.length)}
            whileTap={reduce ? undefined : { scale: 0.99 }}
            className="group w-full h-12 rounded-lg bg-brand-600 text-white text-[0.9375rem] font-semibold hover:bg-brand-500 active:bg-brand-800 transition-colors cursor-pointer flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-600/25"
          >
            Enter workspace
            <ArrowRight size={16} className="transition-transform duration-200 group-hover:translate-x-0.5" />
          </motion.button>

          <motion.p className="text-[0.75rem] text-ink-400 mt-6 leading-relaxed" {...rise(3 + WORKSPACES.length)}>
            Prototype — no sign-in needed. Switch workspaces any time from the sidebar.
          </motion.p>
        </div>
      </div>
    </div>
  );
}
