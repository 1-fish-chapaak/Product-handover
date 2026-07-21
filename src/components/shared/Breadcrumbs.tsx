import { Home } from 'lucide-react';
import type { View } from '../../hooks/useAppState';

interface BreadcrumbItem {
  label: string;
  view?: View;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  onNavigate: (view: View) => void;
}

export default function Breadcrumbs({ items, onNavigate }: BreadcrumbsProps) {
  return (
    <nav className="flex items-center gap-1.5 font-mono text-[0.75rem] mb-4">
      <button
        onClick={() => onNavigate('home')}
        className="text-ink-500 hover:text-ink-800 transition-colors cursor-pointer p-1 rounded hover:bg-brand-50"
      >
        <Home size={13} />
      </button>
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <span className="text-ink-300">/</span>
          {item.view && i < items.length - 1 ? (
            <button
              onClick={() => onNavigate(item.view!)}
              className="text-ink-500 hover:text-ink-800 transition-colors cursor-pointer"
              style={{ fontWeight: 400 }}
            >
              {item.label}
            </button>
          ) : (
            <span className="text-ink-900" style={{ fontWeight: 540 }}>{item.label}</span>
          )}
        </div>
      ))}
    </nav>
  );
}
