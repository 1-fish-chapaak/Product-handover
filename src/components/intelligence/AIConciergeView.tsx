import { useState } from 'react';
import { motion } from 'motion/react';
import {
  FileSearch, Table2, Workflow,
  Search, Sparkles, Bot, Info,
} from 'lucide-react';
import type { View } from '../../hooks/useAppState';
import GlowCard from '../shared/GlowCard';

interface Props {
  setView: (v: View) => void;
}

interface Tool {
  id: string;
  icon: typeof FileSearch;
  title: string;
  description: string;
  tags: { label: string; color: string }[];
  beta?: boolean;
  view?: string;
}

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
    view: 'ai-concierge-workflow-builder',
  },
];

export default function AIConciergeView({ setView }: Props) {
  const [search, setSearch] = useState('');

  const filtered = tools.filter(
    (t) =>
      t.title.toLowerCase().includes(search.toLowerCase()) ||
      t.description.toLowerCase().includes(search.toLowerCase()) ||
      t.tags.some((tag) => tag.label.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="h-full overflow-y-auto relative bg-canvas">
      {/* Hero */}
      <div className="border-b border-canvas-border bg-canvas-elevated">
        <div className="p-8">
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
          >
            <div className="flex items-center gap-3 mb-1">
              <div className="w-10 h-10 rounded-xl bg-brand-600 flex items-center justify-center">
                <Bot size={20} className="text-white" />
              </div>
              <div>
                <h1 className="text-[1.75rem] font-semibold text-ink-900">
                  AI Concierge
                </h1>
                <p className="text-[0.875rem] text-ink-500 leading-relaxed">
                  Specialized AI tools for document analysis and data extraction.
                </p>
              </div>
            </div>
          </motion.div>

          {/* Search */}
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, delay: 0.05, ease: [0.2, 0, 0, 1] }}
            className="mt-6 max-w-md"
          >
            <div className="relative">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-500" />
              <input
                type="text"
                placeholder="Search tools..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 h-10 rounded-md border border-canvas-border bg-canvas-elevated text-[0.8125rem] text-ink-800 placeholder:text-ink-400 focus:outline-none focus:ring-4 focus:ring-brand-600/20 focus:border-brand-600 transition-colors"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-500 hover:text-ink-700 transition-colors cursor-pointer"
                >
                  <span className="text-xs">Clear</span>
                </button>
              )}
            </div>
          </motion.div>
        </div>
      </div>

      {/* Info Note */}
      <div className="px-8 pt-6 pb-2">
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, delay: 0.1, ease: [0.2, 0, 0, 1] }}
          className="flex items-start gap-3 px-5 py-4 rounded-xl bg-brand-50 border border-brand-100"
        >
          <Info size={18} className="text-brand-600 mt-0.5 shrink-0" />
          <p className="text-[0.8125rem] text-brand-700 leading-relaxed">
            Looking for <span className="font-semibold">RACM generation</span>? It's now embedded in{' '}
            <span className="font-semibold">Governance &gt; RACM</span>. Data profiling and anomaly detection
            is available directly in <span className="font-semibold">IRA AI chat</span>.
          </p>
        </motion.div>
      </div>

      {/* Tool Grid */}
      <div className="p-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filtered.map((tool, i) => {
            const Icon = tool.icon;

            return (
              <motion.div
                key={tool.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.2,
                  delay: i * 0.04,
                  ease: [0.2, 0, 0, 1],
                }}
              >
                <GlowCard
                  onClick={() => {
                    if (tool.view) setView(tool.view as View);
                  }}
                  className="bg-canvas-elevated border border-canvas-border"
                >
                  <div className="p-6">
                    {/* Header row */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="w-11 h-11 rounded-xl bg-brand-50 flex items-center justify-center">
                        <Icon size={20} className="text-brand-700" />
                      </div>
                      {tool.beta && (
                        <span className="inline-flex items-center px-2 h-6 rounded-full bg-mitigated-50 text-mitigated-700 text-[0.75rem] font-medium">
                          Beta
                        </span>
                      )}
                    </div>

                    {/* Title */}
                    <h3 className="text-[0.9375rem] font-bold text-text mb-1.5 flex items-center gap-2">
                      {tool.title}
                      {tool.view && (
                        <Sparkles size={12} className="text-primary/40" />
                      )}
                    </h3>

                    {/* Description */}
                    <p className="text-[0.75rem] text-text-secondary leading-relaxed mb-4">
                      {tool.description}
                    </p>

                    {/* Tags */}
                    <div className="flex flex-wrap gap-1.5">
                      {tool.tags.map((tag) => (
                        <span
                          key={tag.label}
                          className={`px-2.5 py-0.5 rounded-full text-[0.75rem] font-semibold ${tag.color}`}
                        >
                          {tag.label}
                        </span>
                      ))}
                    </div>
                  </div>
                </GlowCard>
              </motion.div>
            );
          })}
        </div>

        {filtered.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-16"
          >
            <Search size={32} className="mx-auto text-text-muted/40 mb-3" />
            <p className="text-[0.875rem] text-text-muted">No tools match "{search}"</p>
            <button
              onClick={() => setSearch('')}
              className="mt-2 text-[0.75rem] text-primary hover:underline cursor-pointer"
            >
              Clear search
            </button>
          </motion.div>
        )}
      </div>
    </div>
  );
}
