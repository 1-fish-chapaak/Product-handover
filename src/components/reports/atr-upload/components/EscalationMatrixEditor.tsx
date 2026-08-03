import { useState, useMemo, type ReactNode } from 'react';
import { Minus, Plus, RotateCcw, Trash2, BellRing, TriangleAlert, RefreshCw, Mail, CalendarClock, ShieldCheck, ChevronDown, Check, Users, ArrowLeft } from 'lucide-react';
import { Button } from '../../../shared/Button';
import DatePicker from '../../../shared/DatePicker';
import EscalationTimeline from './EscalationTimeline';
import {
  type EscalationMatrixConfig,
  ESCALATION_EMPLOYEES,
  employeeById,
  cloneDefaultMatrix,
  computeEscalationSchedule,
  deriveEscalationState,
  parseDueDate,
  ccNames,
} from '../escalationMatrix';

// ─── small controls ───

const CARD = 'rounded-[12px] border border-canvas-border bg-canvas-elevated p-3.5';

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-[22px] w-[38px] shrink-0 items-center rounded-full transition-colors cursor-pointer ${checked ? 'bg-brand-600' : 'bg-ink-300'}`}
    >
      <span className={`inline-block h-[16px] w-[16px] rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-[19px]' : 'translate-x-[3px]'}`} />
    </button>
  );
}

// Compact − N + stepper for day offsets.
function Stepper({ value, onChange, min = 0, max = 60, suffix }: { value: number; onChange: (v: number) => void; min?: number; max?: number; suffix?: string }) {
  const set = (v: number) => onChange(Math.max(min, Math.min(max, v)));
  return (
    <div className="inline-flex items-center rounded-[8px] border border-canvas-border overflow-hidden bg-canvas">
      <button type="button" aria-label="Decrease" onClick={() => set(value - 1)} disabled={value <= min} className="w-7 h-7 inline-flex items-center justify-center text-ink-500 hover:text-ink-900 hover:bg-canvas-elevated disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"><Minus size={13} /></button>
      <span className="min-w-[46px] px-1 text-center text-[12.5px] font-semibold text-ink-800 tabular-nums select-none">{value}{suffix ? <span className="text-ink-400 font-normal">{suffix}</span> : null}</span>
      <button type="button" aria-label="Increase" onClick={() => set(value + 1)} disabled={value >= max} className="w-7 h-7 inline-flex items-center justify-center text-ink-500 hover:text-ink-900 hover:bg-canvas-elevated disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"><Plus size={13} /></button>
    </div>
  );
}

// Multi-select dropdown of named employees (name + position clearly shown).
function EmployeePicker({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const [open, setOpen] = useState(false);
  const toggle = (id: string) => onChange(value.includes(id) ? value.filter(x => x !== id) : [...value, id]);
  return (
    <div>
      <div className="flex flex-wrap gap-1.5 items-center">
        {value.map(id => {
          const e = employeeById(id);
          if (!e) return null;
          return (
            <span key={id} className="inline-flex items-center gap-1.5 h-[26px] pl-2.5 pr-1.5 rounded-full text-[11px] font-semibold bg-brand-50 text-brand-700 border border-brand-200">
              {e.name} <span className="font-normal text-brand-500">· {e.position}</span>
              <button type="button" aria-label={`Remove ${e.name}`} onClick={() => toggle(id)} className="w-4 h-4 inline-flex items-center justify-center rounded-full hover:bg-brand-100 cursor-pointer"><Minus size={11} /></button>
            </span>
          );
        })}
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen(o => !o)}
          className="inline-flex items-center gap-1 h-[26px] px-2.5 rounded-full text-[11px] font-semibold border border-canvas-border bg-canvas text-ink-600 hover:border-brand-200 cursor-pointer"
        >
          <Users size={12} aria-hidden="true" /> {value.length ? 'Add recipient' : 'Select recipients'} <ChevronDown size={12} className={`transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
        </button>
      </div>
      {open && (
        <div className="mt-2 rounded-[9px] border border-canvas-border bg-canvas-elevated shadow-sm overflow-hidden">
          {ESCALATION_EMPLOYEES.map(e => {
            const on = value.includes(e.id);
            return (
              <button
                key={e.id}
                type="button"
                onClick={() => toggle(e.id)}
                className={`w-full flex items-center gap-2 px-3 py-2 text-left cursor-pointer transition-colors ${on ? 'bg-brand-50/60' : 'hover:bg-canvas'}`}
              >
                <span className={`w-4 h-4 rounded-[5px] border flex items-center justify-center shrink-0 ${on ? 'bg-brand-600 border-brand-600 text-white' : 'border-canvas-border'}`}>{on && <Check size={11} />}</span>
                <span className="min-w-0 flex-1">
                  <span className="text-[12.5px] font-semibold text-ink-800">{e.name}</span>
                  <span className="text-[11px] text-ink-500"> · {e.position}</span>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SectionHead({ icon: Icon, tint, title, hint, action }: { icon: typeof Mail; tint: string; title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="flex items-center gap-2.5 mb-2.5">
      <span className={`w-7 h-7 rounded-[8px] flex items-center justify-center shrink-0 ${tint}`}><Icon size={14} aria-hidden="true" /></span>
      <div className="min-w-0 flex-1">
        <h4 className="text-[12.5px] font-semibold text-ink-900 leading-tight">{title}</h4>
        {hint && <p className="text-[11px] text-ink-400 leading-snug">{hint}</p>}
      </div>
      {action}
    </div>
  );
}

// Default sample due date for the preview — 30 days out.
function defaultSampleISO(): string {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return d.toISOString().slice(0, 10);
}

/**
 * Full Escalation Matrix editor. Holds a working draft (Cancel discards, Save
 * commits) and renders a live schedule preview off a sample due date so the user
 * sees exactly what the cadence produces before applying it to the report.
 */
/**
 * The Escalation Matrix editor, rendered as a full-frame panel that swaps in over
 * the ATR-upload modal (no nested modal). `onApply` commits the draft; `onCancel`
 * returns to the wizard with the previous config intact.
 */
export default function EscalationMatrixEditor({ config, onApply, onCancel }: {
  config: EscalationMatrixConfig;
  onApply: (next: EscalationMatrixConfig) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState<EscalationMatrixConfig>(() => JSON.parse(JSON.stringify(config)));
  const [sampleISO, setSampleISO] = useState<string>(defaultSampleISO);

  const patch = (p: Partial<EscalationMatrixConfig>) => setDraft(d => ({ ...d, ...p }));

  // initial triggers (days-before list; 0 = on due date)
  const setTrigger = (i: number, v: number) => patch({ initialTriggers: draft.initialTriggers.map((t, idx) => idx === i ? v : t) });
  const removeTrigger = (i: number) => patch({ initialTriggers: draft.initialTriggers.filter((_, idx) => idx !== i) });
  const addTrigger = (v: number) => {
    if (draft.initialTriggers.includes(v)) return;
    patch({ initialTriggers: [...draft.initialTriggers, v].sort((a, b) => b - a) });
  };
  // "+ Add trigger" — append a fresh editable row using the smallest unused
  // days-before value (mirrors the "+ Add reminder" affordance below).
  const addCustomTrigger = () => {
    let v = 1;
    while (draft.initialTriggers.includes(v)) v++;
    patch({ initialTriggers: [...draft.initialTriggers, v].sort((a, b) => b - a) });
  };

  // reminders
  const setReminder = (i: number, v: number) => patch({ reminders: draft.reminders.map((r, idx) => idx === i ? v : r) });
  const addReminder = () => patch({ reminders: [...draft.reminders, 2] });
  const removeReminder = (i: number) => patch({ reminders: draft.reminders.filter((_, idx) => idx !== i) });

  // escalations
  const setEsc = (i: number, p: Partial<{ offsetDays: number; cc: string[] }>) =>
    patch({ escalations: draft.escalations.map((e, idx) => idx === i ? { ...e, ...p } : e) });
  const addEsc = () => patch({ escalations: [...draft.escalations, { offsetDays: 2, cc: ['emp-mgr', 'emp-hia'] }] });
  const removeEsc = (i: number) => patch({ escalations: draft.escalations.filter((_, idx) => idx !== i) });

  const setRecurring = (p: Partial<EscalationMatrixConfig['recurring']>) => patch({ recurring: { ...draft.recurring, ...p } });

  const sampleDue = useMemo(() => parseDueDate(sampleISO), [sampleISO]);
  const schedule = useMemo(() => sampleDue ? computeEscalationSchedule(sampleDue, draft) : [], [sampleDue, draft]);
  const state = useMemo(() => sampleDue ? deriveEscalationState(sampleDue, draft, new Date()) : null, [sampleDue, draft]);

  const previewNotes = useMemo(() => {
    const notes: string[] = [];
    if (draft.reminderDaily) notes.push(`Reminders send every ${draft.weekdaysOnly ? 'weekday' : 'day'} until the exception is handled.`);
    if (draft.recurring.enabled) notes.push(`Then repeats every ${draft.recurring.everyDays} day${draft.recurring.everyDays === 1 ? '' : 's'} to ${ccNames(draft.recurring.cc)}, until the status is updated.`);
    return notes;
  }, [draft]);

  const disabled = !draft.enabled;
  const dim = disabled ? 'opacity-45 pointer-events-none' : '';
  const QUICK_TRIGGERS = [7, 3, 1, 0];

  return (
    <div className="flex flex-col h-full min-h-0 bg-canvas-elevated">
      {/* Header — a back affordance replaces the wizard chrome while editing */}
      <header className="shrink-0 flex items-center gap-3 px-6 pt-3.5 pb-3 border-b border-canvas-border">
        <button onClick={onCancel} className="w-8 h-8 -ml-1 rounded-full text-ink-500 hover:text-ink-800 hover:bg-draft-50 flex items-center justify-center cursor-pointer shrink-0" aria-label="Back to upload">
          <ArrowLeft size={17} />
        </button>
        <div className="w-9 h-9 rounded-[10px] bg-brand-50 text-brand-700 flex items-center justify-center shrink-0"><CalendarClock size={16} /></div>
        <div className="min-w-0">
          <h2 className="text-[0.9375rem] font-semibold text-ink-900 leading-tight">Escalation Matrix</h2>
          <p className="text-[0.75rem] text-ink-500 leading-snug">Configure the mailer cadence that chases every open exception in this report.</p>
        </div>
      </header>

      {/* Body */}
      <div className="flex-1 min-h-0 overflow-hidden px-6 py-4">
        <div className="grid lg:grid-cols-[1fr_360px] gap-5 h-full min-h-0">
        {/* ── Editor ── */}
        <div className="min-h-0 overflow-y-auto pr-1 -mr-1 space-y-3.5">
          {/* master switch */}
          <div className="flex items-center gap-3 rounded-[12px] border border-canvas-border bg-canvas px-3.5 py-3">
            <span className={`w-8 h-8 rounded-[9px] flex items-center justify-center shrink-0 ${draft.enabled ? 'bg-brand-50 text-brand-700' : 'bg-paper-100 text-ink-400'}`}><CalendarClock size={16} aria-hidden="true" /></span>
            <div className="min-w-0 flex-1">
              <div className="text-[12.5px] font-semibold text-ink-900">Escalation mailers</div>
              <div className="text-[11px] text-ink-500">{draft.enabled ? 'On — open items are chased on this cadence.' : 'Off — no reminders or escalations are sent.'}</div>
            </div>
            <Toggle checked={draft.enabled} onChange={v => patch({ enabled: v })} label="Enable escalation mailers" />
          </div>

          {/* initial triggers */}
          <div className={`${CARD} ${dim}`}>
            <SectionHead icon={Mail} tint="bg-brand-50 text-brand-700" title="Initial trigger" hint="Heads-up mails before the due date — add as many as you need."
              action={<button type="button" onClick={addCustomTrigger} className="inline-flex items-center gap-1 h-7 px-2 rounded-[7px] text-[11px] font-semibold text-brand-700 bg-brand-50 hover:bg-brand-100 cursor-pointer"><Plus size={12} /> Add trigger</button>} />
            <div className="space-y-2">
              {draft.initialTriggers.map((t, i) => (
                <div key={i} className="flex items-center gap-2.5">
                  <span className="inline-flex items-center justify-center h-[22px] px-2 rounded-[6px] text-[11px] font-bold bg-brand-50 text-brand-700 tabular-nums shrink-0">{t === 0 ? 'Due' : `T-${t}`}</span>
                  <Stepper value={t} onChange={v => setTrigger(i, v)} min={0} max={60} suffix="d" />
                  <span className="text-[12px] text-ink-600">{t === 0 ? 'on the due date' : 'before the due date'}</span>
                  <button type="button" aria-label={`Remove trigger ${i + 1}`} onClick={() => removeTrigger(i)} className="ml-auto w-7 h-7 inline-flex items-center justify-center rounded-[7px] text-ink-400 hover:text-risk-700 hover:bg-risk-50 cursor-pointer"><Trash2 size={13} /></button>
                </div>
              ))}
              {draft.initialTriggers.length === 0 && <p className="text-[11.5px] text-ink-400">No pre-due heads-up — the first mail is the initial reminder.</p>}
            </div>
            <div className="flex items-center gap-1.5 flex-wrap mt-2.5 pt-2.5 border-t border-canvas-border">
              <span className="text-[11px] text-ink-400">Quick add:</span>
              {QUICK_TRIGGERS.map(v => (
                <button key={v} type="button" disabled={draft.initialTriggers.includes(v)} onClick={() => addTrigger(v)}
                  className="inline-flex items-center h-[24px] px-2 rounded-full text-[11px] font-semibold border border-canvas-border bg-canvas text-ink-600 hover:border-brand-300 hover:text-brand-700 disabled:opacity-35 disabled:cursor-not-allowed cursor-pointer">
                  {v === 0 ? 'On due date' : `${v} day${v === 1 ? '' : 's'}`}
                </button>
              ))}
            </div>
          </div>

          {/* reminders */}
          <div className={`${CARD} ${dim}`}>
            <SectionHead icon={BellRing} tint="bg-mitigated-50 text-mitigated-700" title="Reminder cadence" hint={draft.reminderDaily ? 'A reminder every day until the exception is handled.' : 'R1 counts from the due date; each later reminder from the previous one.'} />
            <label className="flex items-center gap-3 rounded-[9px] border border-canvas-border bg-canvas px-3 py-2.5 mb-2.5 cursor-pointer">
              <Toggle checked={draft.reminderDaily} onChange={v => patch({ reminderDaily: v })} label="Continuous daily reminders" />
              <span className="text-[12px] text-ink-700">Send a reminder <b>every day until the exception is handled</b>.</span>
            </label>
            {!draft.reminderDaily && (
              <>
                <div className="flex items-center justify-end mb-2">
                  <button type="button" onClick={addReminder} className="inline-flex items-center gap-1 h-7 px-2 rounded-[7px] text-[11px] font-semibold text-brand-700 bg-brand-50 hover:bg-brand-100 cursor-pointer"><Plus size={12} /> Add reminder</button>
                </div>
                <div className="space-y-2">
                  {draft.reminders.map((r, i) => (
                    <div key={i} className="flex items-center gap-2.5">
                      <span className="inline-flex items-center justify-center h-[22px] px-2 rounded-[6px] text-[11px] font-bold bg-mitigated-50 text-mitigated-700 tabular-nums shrink-0">R{i + 1}</span>
                      <span className="text-[12px] text-ink-500">{i === 0 ? 'Due' : `R${i}`} +</span>
                      <Stepper value={r} onChange={v => setReminder(i, v)} min={1} max={30} suffix="d" />
                      {draft.reminders.length > 1 && (
                        <button type="button" aria-label={`Remove reminder ${i + 1}`} onClick={() => removeReminder(i)} className="ml-auto w-7 h-7 inline-flex items-center justify-center rounded-[7px] text-ink-400 hover:text-risk-700 hover:bg-risk-50 cursor-pointer"><Trash2 size={13} /></button>
                      )}
                    </div>
                  ))}
                  {draft.reminders.length === 0 && <p className="text-[11.5px] text-ink-400">No reminders — items go straight to escalation.</p>}
                </div>
              </>
            )}
          </div>

          {/* escalations */}
          <div className={`${CARD} ${dim}`}>
            <SectionHead icon={TriangleAlert} tint="bg-risk-50 text-risk-700" title="Escalation cadence" hint="Esc-1 counts from the last reminder; pick the named recipients cc'd at each rung."
              action={<button type="button" onClick={addEsc} className="inline-flex items-center gap-1 h-7 px-2 rounded-[7px] text-[11px] font-semibold text-brand-700 bg-brand-50 hover:bg-brand-100 cursor-pointer"><Plus size={12} /> Add</button>} />
            <div className="space-y-2.5">
              {draft.escalations.map((e, i) => (
                <div key={i} className="rounded-[9px] border border-canvas-border bg-canvas p-2.5">
                  <div className="flex items-center gap-2.5 mb-2">
                    <span className="inline-flex items-center justify-center h-[22px] px-2 rounded-[6px] text-[11px] font-bold bg-risk-50 text-risk-700 tabular-nums shrink-0">Esc-{i + 1}</span>
                    <span className="text-[12px] text-ink-500">{i === 0 ? 'last reminder' : `Esc-${i}`} +</span>
                    <Stepper value={e.offsetDays} onChange={v => setEsc(i, { offsetDays: v })} min={1} max={30} suffix="d" />
                    {draft.escalations.length > 1 && (
                      <button type="button" aria-label={`Remove escalation ${i + 1}`} onClick={() => removeEsc(i)} className="ml-auto w-7 h-7 inline-flex items-center justify-center rounded-[7px] text-ink-400 hover:text-risk-700 hover:bg-risk-50 cursor-pointer"><Trash2 size={13} /></button>
                    )}
                  </div>
                  <div className="text-[11px] font-semibold text-ink-500 mb-1.5">Cc recipients</div>
                  <EmployeePicker value={e.cc} onChange={cc => setEsc(i, { cc })} />
                </div>
              ))}
              {draft.escalations.length === 0 && <p className="text-[11.5px] text-ink-400">No escalations configured.</p>}
            </div>
          </div>

          {/* recurring */}
          <div className={`${CARD} ${dim}`}>
            <SectionHead icon={RefreshCw} tint="bg-risk-50 text-risk-700" title="Recurring escalation" hint="After the last rung, keep chasing until the status is updated."
              action={<Toggle checked={draft.recurring.enabled} onChange={v => setRecurring({ enabled: v })} label="Enable recurring escalation" />} />
            <div className={draft.recurring.enabled ? '' : 'opacity-45 pointer-events-none'}>
              <div className="flex items-center gap-2.5 mb-2.5">
                <span className="text-[12px] text-ink-700">Repeat every</span>
                <Stepper value={draft.recurring.everyDays} onChange={v => setRecurring({ everyDays: v })} min={1} max={30} suffix="d" />
                <span className="text-[12px] text-ink-500">(incrementing the escalation number)</span>
              </div>
              <div className="text-[11px] font-semibold text-ink-500 mb-1.5">Cc recipients</div>
              <EmployeePicker value={draft.recurring.cc} onChange={cc => setRecurring({ cc })} />
            </div>
          </div>

          {/* delivery rules */}
          <div className={`${CARD} ${dim}`}>
            <SectionHead icon={ShieldCheck} tint="bg-compliant-50 text-compliant-700" title="Delivery rules" />
            <div className="space-y-2.5">
              <label className="flex items-center gap-3 cursor-pointer">
                <Toggle checked={draft.weekdaysOnly} onChange={v => patch({ weekdaysOnly: v })} label="Weekdays only" />
                <span className="text-[12px] text-ink-700">Mailers on <b>weekdays only</b> — weekend dates roll to Monday.</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <Toggle checked={draft.activeEmployeesOnly} onChange={v => patch({ activeEmployeesOnly: v })} label="Active employees only" />
                <span className="text-[12px] text-ink-700">Send only to <b>active employees</b> — skip deactivated recipients.</span>
              </label>
            </div>
          </div>
        </div>

        {/* ── Live preview ── */}
        <div className="min-h-0 flex flex-col rounded-[12px] border border-canvas-border bg-canvas overflow-hidden">
          <div className="shrink-0 px-3.5 pt-3.5 pb-3 border-b border-canvas-border">
            <div className="flex items-center gap-2 mb-2">
              <CalendarClock size={14} className="text-brand-700" aria-hidden="true" />
              <h4 className="text-[12.5px] font-semibold text-ink-900">Schedule preview</h4>
            </div>
            <label className="block text-[11px] font-semibold text-ink-500 mb-1">Sample due date</label>
            <DatePicker value={sampleISO} onChange={e => setSampleISO(e.target.value)} className="w-full h-9 px-3 bg-canvas-elevated border border-canvas-border rounded-[8px] text-[13px] text-ink-800 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-500/10 transition-all" aria-label="Sample due date for the preview" />
            {state && (
              <p className="mt-2 text-[11px] text-ink-500">
                {schedule.length} mailer{schedule.length === 1 ? '' : 's'} scheduled · <span className={state.overdue ? 'text-risk-700 font-semibold' : 'text-ink-600 font-medium'}>{state.firedCount} would have fired by today</span>
              </p>
            )}
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto px-3.5 py-3.5">
            {draft.enabled ? (
              <EscalationTimeline events={schedule} nextSeq={state?.next?.seq} notes={previewNotes} />
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center gap-2 text-ink-400">
                <CalendarClock size={22} aria-hidden="true" />
                <p className="text-[12px]">Escalation mailers are off.</p>
              </div>
            )}
          </div>
        </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="shrink-0 flex items-center gap-3 border-t border-canvas-border px-6 py-3">
        <Button variant="ghost" size="md" leftIcon={<RotateCcw size={14} />} onClick={() => setDraft(cloneDefaultMatrix())}>Reset to default</Button>
        <div className="flex-1" />
        <Button variant="outline" size="md" onClick={onCancel}>Cancel</Button>
        <Button variant="primary" size="md" onClick={() => onApply(draft)}>Apply configuration</Button>
      </footer>
    </div>
  );
}
