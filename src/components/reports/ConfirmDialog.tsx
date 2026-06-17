// Small confirm / destructive-confirm dialog used across the Reports surfaces.
// Thin adapter over the canonical shared ConfirmationModal (DESIGN.md §7.9.2)
// so every report confirm renders through the one platform primitive — shared
// Button action pair, ink-900/40 backdrop, no close X — while preserving this
// surface's existing prop API so call sites stay unchanged.

import ConfirmationModal from '../shared/ConfirmationModal';

export default function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
}) {
  return (
    <ConfirmationModal
      open={open}
      onClose={onClose}
      onConfirm={onConfirm}
      title={title}
      description={description}
      confirmLabel={confirmLabel}
      cancelLabel={cancelLabel}
      tone={destructive ? 'destructive' : 'primary'}
    />
  );
}
