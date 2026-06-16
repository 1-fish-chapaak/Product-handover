import { useState, type ElementType } from 'react';
import { motion } from 'motion/react';
import {
  FileSearch, Table2, Workflow, Search,
  LineChart, Image as ImageIcon, Mic, Stethoscope,
} from 'lucide-react';
import type { View } from '../../hooks/useAppState';
import { useToast } from '../shared/Toast';
import FloatingLines from '../shared/FloatingLines';
import ListToolbar from '../shared/ListToolbar';
import EmptyState from '../shared/EmptyState';

interface Props {
  setView: (v: View) => void;
  onLaunchWorkflowBuilder?: (prompt: string) => void;
}

interface ToolTag {
  label: string;
  /** Tailwind bg + text classes, e.g. "bg-sky-100 text-sky-700". */
  color: string;
}

interface Tool {
  id: string;
  icon: ElementType;
  title: string;
  description: string;
  tags: ToolTag[];
  beta?: boolean;
  view?: string;
  isWorkflowLauncher?: boolean;
  /** No tool screen yet — clicking shows a "coming soon" toast. */
  comingSoon?: boolean;
}

const BETA_TAG: ToolTag = { label: 'Beta', color: 'bg-mitigated-50 text-mitigated-700' };

const tools: Tool[] = [
  {
    id: 'forensics',
    icon: FileSearch,
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
    title: 'Table Extractor',
    description: 'Extract structured tables from PDFs and images with AI',
    tags: [
      { label: 'Data', color: 'bg-sky-100 text-sky-700' },
      { label: 'Extraction', color: 'bg-teal-100 text-teal-700' },
    ],
    view: 'ai-concierge-table-extractor',
  },
  {
    id: 'workflow-builder',
    icon: Workflow,
    title: 'Workflow Builder',
    description: 'Design a custom audit workflow from a prompt: upload data, map columns, run.',
    tags: [
      { label: 'Workflow', color: 'bg-violet-100 text-violet-700' },
      { label: 'Audit', color: 'bg-indigo-100 text-indigo-700' },
      { label: 'Builder', color: 'bg-fuchsia-100 text-fuchsia-700' },
    ],
    beta: true,
    // After the ChatView convergence, the workflow builder lives inside
    // the chat surface. Click routes through onLaunchWorkflowBuilder('').
    isWorkflowLauncher: true,
  },
  // New v1 tools — tool screens not built yet, so they show a "coming soon"
  // toast on click (to be built out one at a time later).
  {
    id: 'insights-anomaly',
    icon: LineChart,
    title: 'Insights & Anomaly Report',
    description: 'Automated statistical profiling, anomaly detection, and heuristic reports',
    tags: [
      { label: 'EDA', color: 'bg-sky-100 text-sky-700' },
      { label: 'Analytics', color: 'bg-indigo-100 text-indigo-700' },
      { label: 'Data', color: 'bg-teal-100 text-teal-700' },
    ],
    comingSoon: true,
  },
  {
    id: 'image-analytics',
    icon: ImageIcon,
    title: 'Image Analytics',
    description: 'AI-powered image chat, comparison, and compliance auditing',
    tags: [
      { label: 'Image', color: 'bg-violet-100 text-violet-700' },
      { label: 'Audit', color: 'bg-indigo-100 text-indigo-700' },
      { label: 'Compare', color: 'bg-sky-100 text-sky-700' },
    ],
    comingSoon: true,
  },
  {
    id: 'speech-auditor',
    icon: Mic,
    title: 'Speech Auditor',
    description: 'AI-powered call recording analysis with transcription, sentiment, and audit reports',
    tags: [
      { label: 'Speech', color: 'bg-fuchsia-100 text-fuchsia-700' },
      { label: 'Audit', color: 'bg-indigo-100 text-indigo-700' },
      { label: 'Sentiment', color: 'bg-teal-100 text-teal-700' },
    ],
    comingSoon: true,
  },
  {
    id: 'medical-report-reader',
    icon: Stethoscope,
    title: 'Medical Report Reader',
    description: 'AI-powered forensic medical report analysis for insurance fraud detection',
    tags: [
      { label: 'Medical', color: 'bg-teal-100 text-teal-700' },
      { label: 'Forensics', color: 'bg-risk-50 text-risk-700' },
      { label: 'Insurance', color: 'bg-sky-100 text-sky-700' },
    ],
    comingSoon: true,
  },
];

// Concierge-only card — mirrors the shared ReportCard chrome (icon tile, title,
// description, footer pills) but keeps the per-tag COLORED pills, and the "+N"
// overflow reveals the hidden tags on hover / keyboard focus.
function ToolCard({
  icon: Icon, title, description, tags, index = 0, onClick,
}: {
  icon: ElementType;
  title: string;
  description: string;
  tags: ToolTag[];
  index?: number;
  onClick?: () => void;
}) {
  const MAX = 3;
  const shown = tags.slice(0, MAX);
  const hidden = tags.slice(MAX);
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0, transition: { delay: index * 0.04, duration: 0.3, ease: [0.22, 1, 0.36, 1] } }}
      whileHover={{ y: -3, transition: { duration: 0.18, ease: 'easeOut' } }}
      onClick={onClick}
      className="bg-canvas-elevated border border-canvas-border hover:border-brand-300 rounded-[12px] p-5 shadow-[0_1px_2px_rgba(15,8,30,0.04)] hover:shadow-[0_12px_32px_rgba(15,8,30,0.08)] transition-[box-shadow,border-color] duration-200 group cursor-pointer flex flex-col min-h-[176px]"
    >
      <div className="flex items-start mb-4">
        <span className="w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0 bg-brand-50 transition-transform duration-200 group-hover:scale-[1.06]">
          <Icon size={16} className="text-brand-700" strokeWidth={1.75} />
        </span>
      </div>

      <h3 className="text-[15px] leading-[1.35] font-semibold text-text group-hover:text-primary transition-colors mb-1.5 truncate" title={title}>
        {title}
      </h3>
      <p className="text-[12px] text-text-secondary leading-[1.55] line-clamp-2" title={description}>
        {description}
      </p>

      <div className="mt-auto pt-4 flex items-center gap-1.5 min-w-0">
        <div className="flex items-center gap-1.5 min-w-0 overflow-hidden">
          {shown.map((t) => (
            <span key={t.label} className={`inline-flex items-center h-6 px-2.5 rounded-full text-[11px] font-semibold whitespace-nowrap shrink-0 ${t.color}`}>
              {t.label}
            </span>
          ))}
        </div>
        {hidden.length > 0 && (
          <span className="relative group/more shrink-0">
            <span
              tabIndex={0}
              role="button"
              aria-label={`Also tagged: ${hidden.map((t) => t.label).join(', ')}`}
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center h-6 px-2 rounded-full border border-canvas-border bg-canvas-elevated text-[11px] font-medium text-ink-500 tabular-nums cursor-default transition-colors group-hover/more:border-brand-300 group-hover/more:text-brand-700 focus-visible:outline-none focus-visible:border-brand-300 focus-visible:text-brand-700"
            >
              +{hidden.length}
            </span>
            {/* Hover/focus reveal — the hidden tags as their colored pills.
                Sits outside the truncating row so it's never clipped. */}
            <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-20 hidden group-hover/more:flex group-focus-within/more:flex items-center gap-1.5 px-2 py-1.5 rounded-lg border border-canvas-border bg-canvas-elevated shadow-[0_12px_32px_rgba(15,8,30,0.16)] whitespace-nowrap">
              {hidden.map((t) => (
                <span key={t.label} className={`inline-flex items-center h-5 px-2 rounded-full text-[11px] font-semibold ${t.color}`}>
                  {t.label}
                </span>
              ))}
            </span>
          </span>
        )}
      </div>
    </motion.div>
  );
}

export default function AIConciergeView({ setView, onLaunchWorkflowBuilder }: Props) {
  const [search, setSearch] = useState('');
  const { addToast } = useToast();

  const filtered = tools.filter(
    (t) =>
      t.title.toLowerCase().includes(search.toLowerCase()) ||
      t.description.toLowerCase().includes(search.toLowerCase()) ||
      t.tags.some((tag) => tag.label.toLowerCase().includes(search.toLowerCase()))
  );

  const launch = (tool: Tool) => {
    if (tool.isWorkflowLauncher) onLaunchWorkflowBuilder?.('');
    else if (tool.view) setView(tool.view as View);
    else if (tool.comingSoon) addToast({ type: 'info', message: `${tool.title} — coming soon` });
  };

  return (
    <div className="h-full flex flex-col overflow-hidden bg-canvas">
      {/* Fixed header strip — full-bleed bg-canvas-elevated band via matching
          negative margins, ambient FloatingLines + serif display H1. Mirrors
          the Reports / Knowledge Hub page recipe. */}
      <div className="px-6 lg:px-12 xl:px-[124px] pt-8 shrink-0">
        <div className="bg-canvas-elevated -mx-6 lg:-mx-12 xl:-mx-[124px] px-6 lg:px-12 xl:px-[124px] -mt-8 pt-8 border-b border-canvas-border relative overflow-hidden">
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
            className="mb-6 min-w-0"
          >
            <h1 className="font-display text-[34px] font-[420] tracking-tight text-ink-900 leading-[1.15]">
              AI Concierge
            </h1>
            <p className="mt-2 text-[0.9375rem] text-ink-500 leading-relaxed max-w-2xl">
              Specialized AI tools for document analysis and data extraction.
            </p>
          </motion.div>
        </div>
      </div>

      {/* Scrolling content region — search toolbar + tool grid. */}
      <div className="px-6 lg:px-12 xl:px-[124px] pb-8 flex-1 min-h-0 overflow-y-auto relative">
        <div className="pt-6">
          <div className="mb-6">
            <ListToolbar
              search={search}
              onSearch={setSearch}
              searchPlaceholder="Search AI tools…"
            />
          </div>

          {filtered.length === 0 ? (
            <EmptyState
              icon={Search}
              title={`No tools match “${search}”`}
              body="Try a different search."
              size="compact"
              action={
                <button
                  onClick={() => setSearch('')}
                  className="text-[0.8125rem] font-semibold text-brand-700 hover:text-brand-800 cursor-pointer"
                >
                  Clear search
                </button>
              }
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filtered.map((tool, i) => (
                <ToolCard
                  key={tool.id}
                  index={i}
                  icon={tool.icon}
                  title={tool.title}
                  description={tool.description}
                  tags={tool.beta ? [BETA_TAG, ...tool.tags] : tool.tags}
                  onClick={() => launch(tool)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
