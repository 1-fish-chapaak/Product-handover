import { type ElementType } from 'react';
import { motion } from 'motion/react';
import {
  Table2, Workflow, ShieldCheck, BarChart3,
  Image as ImageIcon, Mic, HeartPulse, TableProperties,
} from 'lucide-react';
import type { View } from '../../hooks/useAppState';
import { useToast } from '../shared/Toast';
import FloatingLines from '../shared/FloatingLines';

interface Props {
  setView: (v: View) => void;
  onLaunchWorkflowBuilder?: (prompt: string) => void;
}

interface ToolTag {
  label: string;
  /** Legacy per-tag color — retained for reference; tags now render as a
   *  uniform brand chip (bg-brand-50 / text-brand-700). */
  color: string;
}

interface Tool {
  id: string;
  icon: ElementType;
  /** Pastel icon-chip accent — chip background + icon color, per tool. */
  accent: { chip: string; icon: string };
  title: string;
  description: string;
  tags: ToolTag[];
  view?: string;
  isWorkflowLauncher?: boolean;
  /** No tool screen yet — clicking shows a "coming soon" toast. */
  comingSoon?: boolean;
}

const tools: Tool[] = [
  {
    id: 'racm-generator',
    icon: TableProperties,
    // #1 icon-chip unify → revert to per-tool pastel: { chip: 'bg-violet-100', icon: 'text-violet-600' }
    accent: { chip: 'bg-brand-50', icon: 'text-brand-600' },
    title: 'RACM Generator',
    description: 'Generate Risk & Control Matrices from SOP and process documents',
    tags: [
      { label: 'RACM', color: 'bg-violet-100 text-violet-700' },
      { label: 'Risk', color: 'bg-risk-50 text-risk-700' },
      { label: 'SOP', color: 'bg-sky-100 text-sky-700' },
    ],
    view: 'ai-concierge-racm',
  },
  {
    id: 'forensics',
    icon: ShieldCheck,
    // #1 icon-chip unify → revert to per-tool pastel: { chip: 'bg-rose-100', icon: 'text-rose-600' }
    accent: { chip: 'bg-brand-50', icon: 'text-brand-600' },
    title: 'Document Forensics',
    description: 'Detect forgery, tampering, and AI-generated content in documents',
    tags: [
      { label: 'Compliance', color: 'bg-risk-50 text-risk-700' },
      { label: 'Detection', color: 'bg-mitigated-50 text-mitigated-700' },
    ],
    view: 'ai-concierge-forensics',
  },
  {
    id: 'table',
    icon: Table2,
    // #1 icon-chip unify → revert to per-tool pastel: { chip: 'bg-sky-100', icon: 'text-sky-600' }
    accent: { chip: 'bg-brand-50', icon: 'text-brand-600' },
    title: 'Table Extractor',
    description: 'Extract structured tables from PDFs and images with AI',
    tags: [
      { label: 'Data', color: 'bg-sky-100 text-sky-700' },
      { label: 'Extraction', color: 'bg-teal-100 text-teal-700' },
    ],
    view: 'ai-concierge-table-extractor',
  },
  // Workflow Builder tile commented out of the AI Concierge homepage (per request).
  // Workflow building is still reachable inside Ask IRA chat; the launcher wiring
  // (isWorkflowLauncher / onLaunchWorkflowBuilder) is kept for an easy restore.
  /*
  {
    id: 'workflow-builder',
    icon: Workflow,
    accent: { chip: 'bg-fuchsia-100', icon: 'text-fuchsia-600' },
    title: 'Workflow Builder',
    description: 'Design a custom audit workflow from a prompt: upload data, map columns, run.',
    tags: [
      { label: 'Workflow', color: 'bg-violet-100 text-violet-700' },
      { label: 'Audit', color: 'bg-indigo-100 text-indigo-700' },
      { label: 'Builder', color: 'bg-fuchsia-100 text-fuchsia-700' },
    ],
    // After the ChatView convergence, the workflow builder lives inside
    // the chat surface. Click routes through onLaunchWorkflowBuilder('').
    isWorkflowLauncher: true,
  },
  */
  {
    id: 'insights-anomaly',
    icon: BarChart3,
    // #1 icon-chip unify → revert to per-tool pastel: { chip: 'bg-indigo-100', icon: 'text-indigo-600' }
    accent: { chip: 'bg-brand-50', icon: 'text-brand-600' },
    title: 'Insights & Anomaly Report',
    description: 'Automated statistical profiling, anomaly detection, and heuristic reports',
    tags: [
      { label: 'EDA', color: 'bg-sky-100 text-sky-700' },
      { label: 'Analytics', color: 'bg-indigo-100 text-indigo-700' },
      { label: 'Data', color: 'bg-teal-100 text-teal-700' },
    ],
    view: 'ai-concierge-insights',
  },
  {
    id: 'image-analytics',
    icon: ImageIcon,
    // #1 icon-chip unify → revert to per-tool pastel: { chip: 'bg-teal-100', icon: 'text-teal-600' }
    accent: { chip: 'bg-brand-50', icon: 'text-brand-600' },
    title: 'Image Analytics',
    description: 'AI-powered image chat, comparison, and compliance auditing',
    tags: [
      { label: 'Image', color: 'bg-violet-100 text-violet-700' },
      { label: 'Audit', color: 'bg-indigo-100 text-indigo-700' },
      { label: 'Compare', color: 'bg-sky-100 text-sky-700' },
    ],
    view: 'ai-concierge-image',
  },
  {
    id: 'speech-auditor',
    icon: Mic,
    // #1 icon-chip unify → revert to per-tool pastel: { chip: 'bg-amber-100', icon: 'text-amber-600' }
    accent: { chip: 'bg-brand-50', icon: 'text-brand-600' },
    title: 'Speech Auditor',
    description: 'AI-powered call recording analysis with transcription, sentiment, and audit reports',
    tags: [
      { label: 'Speech', color: 'bg-fuchsia-100 text-fuchsia-700' },
      { label: 'Audit', color: 'bg-indigo-100 text-indigo-700' },
      { label: 'Sentiment', color: 'bg-teal-100 text-teal-700' },
    ],
    view: 'ai-concierge-speech',
  },
  {
    id: 'medical-report-reader',
    icon: HeartPulse,
    // #1 icon-chip unify → revert to per-tool pastel: { chip: 'bg-emerald-100', icon: 'text-emerald-600' }
    accent: { chip: 'bg-brand-50', icon: 'text-brand-600' },
    title: 'Medical Report Reader',
    description: 'AI-powered forensic medical report analysis for insurance fraud detection',
    tags: [
      { label: 'Medical', color: 'bg-teal-100 text-teal-700' },
      { label: 'Forensics', color: 'bg-risk-50 text-risk-700' },
      { label: 'Insurance', color: 'bg-sky-100 text-sky-700' },
    ],
    view: 'ai-concierge-medical',
  },
];

// Concierge tool card — flat editorial (DESIGN.md §5/§7.17): canvas-elevated
// sheet, 1px hairline that tints brand-200 on hover, flat at rest with a single
// sanctioned diffuse lift on hover (§4); keyboard-operable via role=button. Uniform brand-tinted tag chips
// (bg-brand-50 / text-brand-700). No glass, gradient, or glow.
function ToolCard({
  icon: Icon, accent, title, description, index = 0, onClick, // #5: 'tags' removed (hidden on launcher) — revert: re-add `tags,`
}: {
  icon: ElementType;
  accent: { chip: string; icon: string };
  title: string;
  description: string;
  // #5: tags hidden on launcher — revert: restore the line  tags: ToolTag[];
  index?: number;
  onClick?: () => void;
}) {
  // #2 keyboard a11y (role=button + tabIndex + Enter/Space) · #3 flat-at-rest (no resting shadow; sanctioned diffuse hover lift) · #8 token tidiness (rounded-lg, brand-200 hover).
  // Revert: remove role/tabIndex/onKeyDown and restore the className below to:
  // "bg-canvas-elevated border border-canvas-border hover:border-brand-300 rounded-lg p-5 shadow-[0_1px_2px_rgba(15,8,30,0.04)] hover:shadow-[0_12px_32px_rgba(15,8,30,0.08)] transition-[box-shadow,border-color] duration-200 group cursor-pointer flex flex-col min-h-[176px]"
  return (
    <motion.div
      role="button"
      tabIndex={0}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0, transition: { delay: index * 0.04, duration: 0.3, ease: [0.22, 1, 0.36, 1] } }}
      whileHover={{ y: -3, transition: { duration: 0.18, ease: 'easeOut' } }}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick?.(); } }}
      className="bg-canvas-elevated border border-canvas-border hover:border-brand-200 rounded-lg p-5 hover:shadow-[0_8px_24px_rgba(15,8,30,0.04)] transition-[box-shadow,border-color] duration-200 group cursor-pointer flex flex-col min-h-[176px]"
    >
      <div className="flex items-start mb-4">
        <span className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${accent.chip} transition-transform duration-200 group-hover:scale-[1.06]`}>
          <Icon size={16} className={accent.icon} strokeWidth={1.75} />
        </span>
      </div>

      {/* #6 two-line titles → revert: replace line-clamp-2 with truncate */}
      <h3 className="text-[0.9375rem] leading-[1.35] font-semibold text-text group-hover:text-primary transition-colors mb-1.5 line-clamp-2" title={title}>
        {title}
      </h3>
      <p className="text-[0.75rem] text-text-secondary leading-[1.55] line-clamp-2" title={description}>
        {description}
      </p>

      {/* #5 tags hidden on the launcher (each tool's `tags` data is kept for revert).
          Restore: uncomment this block AND re-add `tags` to ToolCard's props/type + the `tags={tool.tags}` call-site prop.
      <div className="mt-auto pt-4 flex flex-wrap gap-1.5">
        {tags.map((t) => (
          <span
            key={t.label}
            className="inline-flex items-center rounded-md bg-brand-50 px-2.5 py-1.5 text-[0.6875rem] font-semibold text-brand-700 whitespace-nowrap"
          >
            {t.label}
          </span>
        ))}
      </div>
      */}
    </motion.div>
  );
}

export default function AIConciergeView({ setView, onLaunchWorkflowBuilder }: Props) {
  const { addToast } = useToast();

  const launch = (tool: Tool) => {
    if (tool.isWorkflowLauncher) onLaunchWorkflowBuilder?.('');
    else if (tool.view) setView(tool.view as View);
    else if (tool.comingSoon) addToast({ type: 'info', message: `${tool.title} — coming soon` });
  };

  return (
    <div className="h-full flex flex-col overflow-hidden bg-canvas">
      {/* Fixed header strip — full-bleed bg-canvas-elevated band via matching
          negative margins, ambient FloatingLines + serif display H1. Mirrors
          the Reports / Knowledge Hub page recipe (DESIGN.md §7.4 / §7.17). */}
      <div className="px-6 lg:px-12 xl:px-[124px] pt-8 shrink-0">
        <div className="bg-canvas-elevated -mx-6 lg:-mx-12 xl:-mx-[124px] px-6 lg:px-12 xl:px-[124px] -mt-8 pt-8 pb-6 min-h-[148px] border-b border-canvas-border relative overflow-hidden">
          <FloatingLines
            enabledWaves={['top', 'bottom']}
            lineCount={3}
            lineDistance={10}
            bendRadius={5}
            bendStrength={-0.3}
            interactive
            parallax
            color="#6a12cd"
            opacity={0.05}
          />
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="min-w-0"
          >
            <h1 className="font-display text-[2.125rem] font-[420] tracking-tight text-ink-900 leading-[1.15]">
              AI Concierge
            </h1>
            <p className="mt-2 text-[0.8125rem] text-ink-500 leading-relaxed max-w-md">
              AI-powered tools for auditing, compliance, and data analysis.
            </p>
          </motion.div>
        </div>
      </div>

      {/* Scrolling content region — tool grid. */}
      <div className="px-6 lg:px-12 xl:px-[124px] pb-8 flex-1 min-h-0 overflow-y-auto relative">
        <div className="pt-6">
          {/* #4 flat grid — lone last card stays LEFT-aligned (per request; not centered/stretched). */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {tools.map((tool, i) => (
              <ToolCard
                key={tool.id}
                index={i}
                icon={tool.icon}
                accent={tool.accent}
                title={tool.title}
                description={tool.description}
                // #5: tags hidden on launcher — revert: restore  tags={tool.tags}
                onClick={() => launch(tool)}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
