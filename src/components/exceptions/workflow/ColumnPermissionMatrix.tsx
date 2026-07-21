import { Eye, Pencil, Lock } from 'lucide-react';
import type { ColumnPermission } from './workflowTypes';

function Toggle({ on, onClick, disabled, label }: { on: boolean; onClick: () => void; disabled?: boolean; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={`relative inline-flex w-9 h-[18px] rounded-full transition-colors shrink-0 ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'} ${on ? 'bg-brand-600' : 'bg-canvas-border'}`}
    >
      <span className={`absolute top-0.5 w-[14px] h-[14px] rounded-full bg-white shadow-sm transition-all ${on ? 'left-[20px]' : 'left-0.5'}`} />
    </button>
  );
}

/** RBAC at the column level: pick which columns the assignee sees and whether
 *  each is editable. Editable implies visible. */
export default function ColumnPermissionMatrix({
  permissions, onChange, readOnly = false,
}: {
  permissions: ColumnPermission[];
  onChange?: (next: ColumnPermission[]) => void;
  readOnly?: boolean;
}) {
  const update = (key: string, patch: Partial<ColumnPermission>) => {
    if (readOnly || !onChange) return;
    onChange(permissions.map(p => {
      if (p.key !== key) return p;
      const next = { ...p, ...patch };
      if (!next.visible) next.editable = false; // editable requires visible
      if (next.editable) next.visible = true;
      return next;
    }));
  };

  const visibleCount = permissions.filter(p => p.visible).length;

  return (
    <div className="border border-canvas-border rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-3.5 py-2.5 bg-[#FAFAFB] border-b border-canvas-border">
        <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-ink-500">Column visibility & edit rights</span>
        <span className="text-[0.6875rem] text-ink-500 tabular-nums">{visibleCount}/{permissions.length} visible</span>
      </div>
      <div className="grid grid-cols-[1fr_auto_auto] gap-x-4 px-3.5 py-1.5 text-[0.65625rem] font-semibold uppercase tracking-wide text-ink-400 border-b border-canvas-border">
        <span>Column</span>
        <span className="flex items-center gap-1 justify-self-center w-[80px] justify-center"><Eye size={11} /> Visible</span>
        <span className="flex items-center gap-1 justify-self-center w-[80px] justify-center"><Pencil size={11} /> Editable</span>
      </div>
      <div className="max-h-[260px] overflow-y-auto divide-y divide-canvas-border">
        {permissions.map(p => (
          <div key={p.key} className="grid grid-cols-[1fr_auto_auto] gap-x-4 items-center px-3.5 py-2">
            <span className="text-[0.78125rem] text-ink-800 flex items-center gap-1.5">
              {p.key === 'id' && <Lock size={11} className="text-ink-400" />}
              {p.label}
            </span>
            <span className="justify-self-center w-[80px] flex justify-center">
              <Toggle on={p.visible} disabled={readOnly || p.key === 'id'} onClick={() => update(p.key, { visible: !p.visible })} label={`${p.label} visible`} />
            </span>
            <span className="justify-self-center w-[80px] flex justify-center">
              {/* Editable can be toggled even when not yet visible — turning it on
                  auto-enables Visible for the column (handled in `update`). */}
              <Toggle on={p.editable} disabled={readOnly} onClick={() => update(p.key, { editable: !p.editable })} label={`${p.label} editable`} />
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
