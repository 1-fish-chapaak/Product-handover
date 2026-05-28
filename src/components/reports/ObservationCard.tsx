import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'motion/react';
import {
  X, MoreVertical, Edit3, Eye, EyeOff, Trash2, ChevronLeft, ChevronRight, Paperclip,
} from 'lucide-react';
import {
  isImageMime,
  formatFileSize,
  attachmentVisual,
  type ObservationAttachment,
} from './AddObservationModal';

export type ObservationCardData = {
  id: string;
  obsId: string;
  title: string;
  description: string;
  attachments?: ObservationAttachment[];
  attachmentHidden?: boolean;
};

// Action menu — kebab on the right of the meta row. Portal-positioned so it
// escapes ancestor overflow-hidden / stacking contexts.
export function ObservationActionsMenu({
  hasAttachment,
  attachmentHidden,
  onEdit,
  onToggleAttachment,
  onDelete,
}: {
  hasAttachment: boolean;
  attachmentHidden: boolean;
  onEdit: () => void;
  onToggleAttachment: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});
  const menuRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const handleMouseDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (menuRef.current?.contains(target)) return;
      if (triggerRef.current?.contains(target)) return;
      setOpen(false);
    };
    const close = () => setOpen(false);
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [open]);

  const handleToggle = () => {
    const next = !open;
    if (next && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const estimatedHeight = hasAttachment ? 160 : 120;
      const spaceBelow = window.innerHeight - rect.bottom;
      const flipUp = spaceBelow < estimatedHeight + 16;
      const style: React.CSSProperties = {
        position: 'fixed',
        right: window.innerWidth - rect.right,
        zIndex: 1000,
      };
      if (flipUp) {
        style.bottom = window.innerHeight - rect.top + 6;
      } else {
        style.top = rect.bottom + 6;
      }
      setMenuStyle(style);
    }
    setOpen(next);
  };

  return (
    <>
      <button
        ref={triggerRef}
        onClick={handleToggle}
        title="More options"
        aria-label="More options"
        className="w-8 h-8 flex items-center justify-center rounded-[8px] text-text-muted hover:text-primary hover:bg-primary-xlight transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40 focus-visible:ring-offset-1"
      >
        <MoreVertical size={16} />
      </button>
      {open && createPortal(
        <div
          ref={menuRef}
          style={menuStyle}
          className="w-[210px] bg-white border border-border-light rounded-[8px] shadow-xl py-1"
        >
          <button
            onClick={() => { setOpen(false); onEdit(); }}
            className="flex items-center gap-2 w-full text-left px-3 py-2 text-[12px] text-text-secondary hover:bg-primary-xlight hover:text-primary cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40 focus-visible:ring-inset"
          >
            <Edit3 size={14} />
            Edit observation
          </button>
          {hasAttachment && (
            <button
              onClick={() => { setOpen(false); onToggleAttachment(); }}
              className="flex items-center gap-2 w-full text-left px-3 py-2 text-[12px] text-text-secondary hover:bg-primary-xlight hover:text-primary cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40 focus-visible:ring-inset"
            >
              {attachmentHidden ? <Eye size={14} /> : <EyeOff size={14} />}
              {attachmentHidden ? 'Show attachment' : 'Hide attachment'}
            </button>
          )}
          <div className="my-1 border-t border-border-light/60" />
          <button
            onClick={() => { setOpen(false); onDelete(); }}
            className="flex items-center gap-2 w-full text-left px-3 py-2 text-[12px] text-risk-700 hover:bg-risk-50 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40 focus-visible:ring-inset"
          >
            <Trash2 size={14} />
            Delete observation
          </button>
        </div>,
        document.body,
      )}
    </>
  );
}

// Observation card — meta row, title, description, attachment thumbnails /
// chips, lightbox for image attachments.
export default function ObservationCard({
  obs,
  index,
  onEdit,
  onToggleAttachment,
  onDelete,
  attached = true,
}: {
  obs: ObservationCardData;
  index: number;
  onEdit: () => void;
  onToggleAttachment: () => void;
  onDelete: () => void;
  attached?: boolean;
}) {
  const attachments = obs.attachments ?? [];
  const visibleAttachments = obs.attachmentHidden ? [] : attachments;
  const imageAttachments = visibleAttachments.filter(a => isImageMime(a.mimeType));
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const baseDelay = index * 0.08;

  // Overflow handling — if there are more than 6 attachments, render the
  // first 5 inline plus a "+N" tile that opens a small list.
  const OVERFLOW_THRESHOLD = 6;
  const overflowing = visibleAttachments.length > OVERFLOW_THRESHOLD;
  const renderableAttachments = useMemo(
    () => (overflowing ? visibleAttachments.slice(0, 5) : visibleAttachments),
    [overflowing, visibleAttachments],
  );
  const overflowItems = overflowing ? visibleAttachments.slice(5) : [];
  const [overflowOpen, setOverflowOpen] = useState(false);
  const overflowRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!overflowOpen) return;
    const handle = (e: MouseEvent) => {
      if (overflowRef.current && !overflowRef.current.contains(e.target as Node)) {
        setOverflowOpen(false);
      }
    };
    window.addEventListener('mousedown', handle);
    return () => window.removeEventListener('mousedown', handle);
  }, [overflowOpen]);

  useEffect(() => {
    if (lightboxIndex === null) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightboxIndex(null);
      if (e.key === 'ArrowRight') {
        setLightboxIndex(i => (i === null ? i : (i + 1) % imageAttachments.length));
      }
      if (e.key === 'ArrowLeft') {
        setLightboxIndex(i => (i === null ? i : (i - 1 + imageAttachments.length) % imageAttachments.length));
      }
    };
    window.addEventListener('keydown', handler);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', handler);
      document.body.style.overflow = prevOverflow;
    };
  }, [lightboxIndex, imageAttachments.length]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: baseDelay, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className={`relative bg-white overflow-hidden ${attached ? 'border-x border-b border-border-light' : 'border border-border-light rounded-[12px]'}`}
    >
      <div className="px-6 py-5">
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: baseDelay + 0.15, duration: 0.35 }}
          className="flex items-center justify-between mb-4 gap-4"
        >
          <div className="flex items-center gap-2.5 text-[11px] min-w-0">
            <span className="font-bold text-primary uppercase tracking-wider shrink-0">{obs.obsId}</span>
            <span className="w-px h-3 bg-border-light shrink-0" />
            <span className="font-medium text-text-muted uppercase tracking-wider shrink-0">Observation</span>
          </div>
          <ObservationActionsMenu
            hasAttachment={attachments.length > 0}
            attachmentHidden={!!obs.attachmentHidden}
            onEdit={onEdit}
            onToggleAttachment={onToggleAttachment}
            onDelete={onDelete}
          />
        </motion.div>

        <motion.h3
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: baseDelay + 0.2, duration: 0.35 }}
          className="text-[15px] font-semibold text-text leading-[1.5] mb-5"
        >
          {obs.title}
        </motion.h3>

        {obs.description && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: baseDelay + 0.4, duration: 0.4 }}
            className="text-[13px] text-text-secondary leading-relaxed mb-4 whitespace-pre-wrap"
          >
            {obs.description}
          </motion.p>
        )}

        {visibleAttachments.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: baseDelay + 0.5, duration: 0.35 }}
            className="flex flex-wrap gap-2.5"
          >
            {renderableAttachments.map((att) => {
              if (isImageMime(att.mimeType)) {
                const imageIdx = imageAttachments.findIndex(a => a.id === att.id);
                return (
                  <motion.button
                    key={att.id}
                    type="button"
                    onClick={() => setLightboxIndex(imageIdx)}
                    whileHover={{ scale: 1.02 }}
                    title={`${att.name} — click to view full size`}
                    aria-label={`Open ${att.name} in full screen`}
                    className="block w-[88px] h-[88px] rounded-[12px] border border-border-light overflow-hidden bg-paper-50 cursor-zoom-in hover:border-primary/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40 focus-visible:ring-offset-1"
                  >
                    <img src={att.dataUrl} alt={att.name} className="w-full h-full object-cover" />
                  </motion.button>
                );
              }
              const { Icon, tone } = attachmentVisual(att.mimeType);
              const inlineMime = att.mimeType === 'application/pdf';
              return (
                <a
                  key={att.id}
                  href={att.dataUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  download={inlineMime ? undefined : att.name}
                  title={`${att.name} — ${formatFileSize(att.size)}`}
                  className="inline-flex items-center gap-2 max-w-[260px] h-[36px] px-2.5 bg-paper-50 border border-border-light rounded-[8px] hover:border-primary/40 hover:bg-white transition-colors group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40 focus-visible:ring-offset-1"
                >
                  <Icon size={14} className={`shrink-0 ${tone}`} />
                  <span className="text-[12px] text-text font-medium truncate group-hover:text-primary">{att.name}</span>
                  <span className="text-[10px] text-text-muted tabular-nums shrink-0">{formatFileSize(att.size)}</span>
                </a>
              );
            })}
            {overflowing && (
              <div ref={overflowRef} className="relative">
                <button
                  type="button"
                  onClick={() => setOverflowOpen(o => !o)}
                  aria-label={`Show ${overflowItems.length} more attachments`}
                  className="w-[88px] h-[88px] rounded-[12px] border border-border-light bg-paper-50 hover:border-primary/40 hover:bg-white transition-colors inline-flex flex-col items-center justify-center gap-1 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40 focus-visible:ring-offset-1"
                >
                  <span className="font-display text-[18px] leading-none font-semibold text-ink-900 tabular-nums">+{overflowItems.length}</span>
                  <span className="text-[10px] text-ink-500 uppercase tracking-wider">more</span>
                </button>
                {overflowOpen && (
                  <div className="absolute top-full left-0 mt-2 z-30 w-[280px] bg-white border border-border-light rounded-[8px] shadow-xl py-1 max-h-[280px] overflow-y-auto">
                    <div className="px-3 py-2 text-[10px] font-bold text-text-muted uppercase tracking-wider border-b border-border-light/60">
                      {overflowItems.length} more {overflowItems.length === 1 ? 'attachment' : 'attachments'}
                    </div>
                    <ul className="py-1">
                      {overflowItems.map(att => {
                        const isImage = isImageMime(att.mimeType);
                        const { Icon, tone } = attachmentVisual(att.mimeType);
                        if (isImage) {
                          const imageIdx = imageAttachments.findIndex(a => a.id === att.id);
                          return (
                            <li key={att.id}>
                              <button
                                type="button"
                                onClick={() => { setOverflowOpen(false); setLightboxIndex(imageIdx); }}
                                className="flex items-center gap-2.5 w-full text-left px-3 py-2 hover:bg-primary-xlight/40 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40 focus-visible:ring-inset"
                              >
                                <div className="w-7 h-7 rounded border border-border-light overflow-hidden bg-white shrink-0">
                                  <img src={att.dataUrl} alt="" className="w-full h-full object-cover" />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="text-[12px] text-text font-medium truncate">{att.name}</div>
                                  <div className="text-[10px] text-text-muted tabular-nums">{formatFileSize(att.size)}</div>
                                </div>
                              </button>
                            </li>
                          );
                        }
                        const inlineMime = att.mimeType === 'application/pdf';
                        return (
                          <li key={att.id}>
                            <a
                              href={att.dataUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              download={inlineMime ? undefined : att.name}
                              onClick={() => setOverflowOpen(false)}
                              className="flex items-center gap-2.5 px-3 py-2 hover:bg-primary-xlight/40 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40 focus-visible:ring-inset"
                            >
                              <div className={`w-7 h-7 rounded border border-border-light bg-white inline-flex items-center justify-center shrink-0 ${tone}`}>
                                <Icon size={14} />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="text-[12px] text-text font-medium truncate">{att.name}</div>
                                <div className="text-[10px] text-text-muted tabular-nums">{formatFileSize(att.size)}</div>
                              </div>
                            </a>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </motion.div>
        )}

        {attachments.length === 0 && (
          <div className="flex items-center gap-1.5 text-[11px] text-ink-400">
            <Paperclip size={12} strokeWidth={1.75} />
            <span>No attachments</span>
          </div>
        )}
      </div>

      {lightboxIndex !== null && imageAttachments[lightboxIndex] && createPortal(
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={() => setLightboxIndex(null)}
          className="fixed inset-0 z-[1100] bg-ink-900/85 flex items-center justify-center p-8 cursor-zoom-out"
        >
          <button
            onClick={(e) => { e.stopPropagation(); setLightboxIndex(null); }}
            aria-label="Close preview"
            className="absolute top-5 right-5 inline-flex items-center justify-center w-10 h-10 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors cursor-pointer backdrop-blur-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
          >
            <X size={20} />
          </button>
          {imageAttachments.length > 1 && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setLightboxIndex(i => (i === null ? i : (i - 1 + imageAttachments.length) % imageAttachments.length));
                }}
                aria-label="Previous image"
                className="absolute left-5 top-1/2 -translate-y-1/2 inline-flex items-center justify-center w-10 h-10 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors cursor-pointer backdrop-blur-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
              >
                <ChevronLeft size={20} />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setLightboxIndex(i => (i === null ? i : (i + 1) % imageAttachments.length));
                }}
                aria-label="Next image"
                className="absolute right-5 top-1/2 -translate-y-1/2 inline-flex items-center justify-center w-10 h-10 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors cursor-pointer backdrop-blur-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
              >
                <ChevronRight size={20} />
              </button>
            </>
          )}
          <motion.img
            key={imageAttachments[lightboxIndex].id}
            initial={{ scale: 0.96, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            src={imageAttachments[lightboxIndex].dataUrl}
            alt={imageAttachments[lightboxIndex].name}
            onClick={(e) => e.stopPropagation()}
            className="max-w-[90vw] max-h-[90vh] object-contain rounded-[12px] shadow-2xl cursor-default"
          />
          <div className="absolute bottom-5 left-1/2 -translate-x-1/2 flex items-center gap-2 text-[12px] text-white/80 px-3 py-1.5 rounded-full bg-white/5 backdrop-blur-sm">
            <span>{obs.obsId}</span>
            <span className="text-white/40">·</span>
            <span>{imageAttachments[lightboxIndex].name}</span>
            {imageAttachments.length > 1 && (
              <>
                <span className="text-white/40">·</span>
                <span className="tabular-nums">{lightboxIndex + 1} / {imageAttachments.length}</span>
              </>
            )}
          </div>
        </motion.div>,
        document.body,
      )}
    </motion.div>
  );
}
