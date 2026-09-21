import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CalendarRange, Check, ChevronDown, ChevronRight, FileText, History, ListChecks, Plus, Trash2, X } from 'lucide-react';
import { useIcfr } from './store';
import { useAuditLog } from '../../context/AdminDataContext';
import { controlConclusion, requiredFilesOf } from './helpers';
import { countryFor, ownersOf } from './auditScope';
import { ConclusionPill } from './parts';
import { Pill } from '../shared/StatusBadge';
import { Dropdown, EmptyState, KeyControlChip, menuItem } from './ControlDossier';
import { attributeStats, auditsForControl, LastRunFact, runsForControl, RunHistoryList } from './ControlLibrary';
import { cn } from '../../lib/cn';
import type { AuditRecord, AuditRound, Control, OperatingStep, RequiredFile } from './types';

/**
 * The engagement-root control page — the LIBRARY lens's own detail view (user
 * ask, 30 Jul). What a control IS (its attributes, and the files each attribute
 * needs as evidence) lives here, always editable, independent of any audit.
 * What it CONCLUDED is read per audit below, not tested here — testing only
 * happens inside an audit, on ControlDossier, which this page links out to.
 *
 * One continuous scroll (user ask): audit runs shown upfront, attributes as a
 * table, testing activity last — no tabs, no side sheet gating any of it.
 */

const ROUND_LABEL: Record<AuditRound, string> = { interim: 'Interim', rollforward: 'Roll-forward', yearend: 'Year-end' };

/** The months a round actually covers, from its ISO window. `periodSpan` beside
 *  it is the CYCLE's label, which every round of a cycle shares — an interim and
 *  a roll-forward of FY26 both read "Jan 2026 – Dec 2026" and the two rows come
 *  out identical. The window is the thing that differs, and it is what the
 *  reader is asking when they look at three runs of the same control. */
const MONTH = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
};
const windowOf = (a: AuditRecord) => (a.windowFrom && a.windowTo ? `${MONTH(a.windowFrom)} – ${MONTH(a.windowTo)}` : a.periodSpan);

/** The files one attribute is proven against — the RACM's Control Evidence,
 *  split per attribute. Edited in place here; uploads are an audit's business
 *  (the TOE step on ControlDossier), so no upload state shows on this page. */
function RequiredFilesCell({ control, step, canEdit }: { control: Control; step: OperatingStep; canEdit: boolean }) {
  const { addRequiredFile, renameRequiredFile, removeRequiredFile } = useIcfr();
  const logEvent = useAuditLog();
  const files = requiredFilesOf(step, control);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [adding, setAdding] = useState(false);
  const [newLabel, setNewLabel] = useState('');

  const inputCls = 'w-full h-7 px-2 rounded-lg border border-canvas-border bg-canvas-elevated text-[0.75rem] text-ink-800 placeholder:text-ink-400 focus:outline-none focus:ring-2 focus:ring-brand-200';

  const saveRename = (f: RequiredFile) => {
    const label = draft.trim();
    setEditingId(null);
    // An empty or unchanged name is a cancel, not an edit — nothing to log.
    if (!label || label === f.label) return;
    renameRequiredFile(control.id, step.id, f.id, label);
    logEvent({ action: 'Update', description: `Renamed required file "${f.label}" to "${label}" on attribute ${step.code} (${control.id})`, module: 'SOX ICFR', entity: 'Control' });
  };
  const submitNew = () => {
    const label = newLabel.trim();
    if (!label) return;
    addRequiredFile(control.id, step.id, label);
    logEvent({ action: 'Create', description: `Added required file "${label}" to attribute ${step.code} (${control.id})`, module: 'SOX ICFR', entity: 'Control' });
    setNewLabel(''); setAdding(false);
  };

  // Each file is a token, not a line of prose: it is a NAME of a document, one
  // of several, sitting in a cell beside other cells. Set as lines they read as
  // a paragraph with stray crosses in it; set as chips the cell says how many
  // there are at a glance, and the remove sits on the thing it removes.
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {files.length === 0 && !adding && <span className="text-[0.75rem] text-ink-400">None listed</span>}
      {files.map(f => (
        canEdit && editingId === f.id ? (
          <input key={f.id} autoFocus value={draft} onChange={e => setDraft(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') saveRename(f); if (e.key === 'Escape') setEditingId(null); }}
            onBlur={() => setEditingId(null)}
            aria-label={`Rename required file ${f.label}`}
            className={cn(inputCls, 'w-48')} />
        ) : (
          <span key={f.id} className="inline-flex items-center gap-1.5 h-[1.625rem] pl-2 pr-1.5 rounded-md border border-canvas-border bg-canvas text-[0.71875rem] text-ink-700">
            <FileText size={11} className="shrink-0 text-ink-400" />
            {canEdit ? (
              <button type="button" onClick={() => { setDraft(f.label); setEditingId(f.id); }} title="Rename"
                className="text-left hover:text-brand-700 cursor-pointer">{f.label}</button>
            ) : <span>{f.label}</span>}
            {canEdit && (
              <button type="button"
                onClick={() => { removeRequiredFile(control.id, step.id, f.id); logEvent({ action: 'Delete', description: `Removed required file "${f.label}" from attribute ${step.code} (${control.id})`, module: 'SOX ICFR', entity: 'Control' }); }}
                aria-label={`Remove required file ${f.label}`} title="Remove"
                className="h-4 w-4 shrink-0 inline-flex items-center justify-center rounded text-ink-300 hover:text-risk-600 cursor-pointer"
              ><X size={10} /></button>
            )}
          </span>
        )
      ))}
      {canEdit && (adding ? (
        <input autoFocus value={newLabel} onChange={e => setNewLabel(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') submitNew(); if (e.key === 'Escape') { setAdding(false); setNewLabel(''); } }}
          onBlur={() => { if (!newLabel.trim()) setAdding(false); }}
          placeholder="e.g. Signed approval record" aria-label={`Add a required file to ${step.code}`}
          className={cn(inputCls, 'w-56')} />
      ) : (
        <button type="button" onClick={() => setAdding(true)}
          className="inline-flex items-center gap-1 h-[1.625rem] px-2 rounded-md border border-dashed border-canvas-border text-[0.6875rem] font-semibold text-ink-500 hover:border-brand-300 hover:text-brand-700 hover:bg-brand-50/40 transition-colors cursor-pointer">
          <Plus size={11} /> Add file
        </button>
      ))}
    </div>
  );
}

/** Rows here are records, not doors — nothing opens, so they take the static
 *  variant rather than the register's pointer and hover tint. The cells sit at
 *  the top of the row because a two-line attribute beside three chips has no
 *  shared middle to centre on. */
const attrCell = { paddingTop: 13, paddingBottom: 13, verticalAlign: 'top' as const };

function AttributeTableRow({ control, step, canEdit }: { control: Control; step: OperatingStep; canEdit: boolean }) {
  const { removeAttribute } = useIcfr();
  const logEvent = useAuditLog();
  return (
    <tr className="reg-row reg-static">
      <td style={{ ...attrCell, paddingTop: 15 }}><span className="wp-ref">{step.code}</span></td>
      <td style={attrCell}>
        <div className="text-[0.8125rem] font-medium text-ink-800 leading-snug">{step.description}</div>
      </td>
      {/* Its own column now. Run under the attribute it read as a caption of the
          sentence above it; in a column it reads as what it is — the assertion
          this attribute proves, and how finely. */}
      <td style={attrCell}>
        <div className="text-[0.75rem] text-ink-600">{step.assertion ?? '—'}</div>
        {step.precision && <div className="text-[0.6875rem] text-ink-400 mt-0.5">{step.precision}</div>}
      </td>
      <td style={{ ...attrCell, paddingTop: 11 }}>
        <RequiredFilesCell control={control} step={step} canEdit={canEdit} />
      </td>
      <td style={{ ...attrCell, textAlign: 'right' }}>
        {canEdit && (
          <button
            onClick={() => { removeAttribute(control.id, step.id); logEvent({ action: 'Delete', description: `Removed attribute ${step.code} from ${control.id}`, module: 'SOX ICFR', entity: 'Control' }); }}
            title="Remove attribute" aria-label={`Remove attribute ${step.code}`}
            className="h-7 w-7 inline-flex items-center justify-center rounded-md text-ink-300 hover:bg-risk-50 hover:text-risk-600 transition-colors cursor-pointer"
          ><Trash2 size={13} /></button>
        )}
      </td>
    </tr>
  );
}

/**
 * One owner value, reassignable in place. The label is the fact list's, not
 * this component's.
 *
 * At rest the name is set as text, because that is what it is: a fact about the
 * control, sitting in a list of facts that are read far more often than they
 * are changed. The bordered button it used to wear made two of the eight facts
 * shout, and broke the baseline of the line they sat on. The affordance comes
 * back on hover and focus, where it is asked for. Read-only for anyone who
 * cannot edit, and the name reads identically either way.
 */
function OwnerField({ value, options, canEdit, onChange }: { value: string; options: string[]; canEdit: boolean; onChange: (v: string) => void }) {
  if (!canEdit) return <>{value}</>;
  return (
    <Dropdown
      triggerClass="-ml-1.5 px-1.5 py-0.5 inline-flex items-center gap-1 rounded-md border border-transparent text-[0.8125rem] font-medium text-ink-800 hover:border-canvas-border hover:bg-canvas-elevated hover:text-brand-700 transition-colors cursor-pointer"
      trigger={value}
    >
      {close => (
        <>
          {options.map(o => (
            <button key={o} className={menuItem} onClick={() => { if (o !== value) onChange(o); close(); }}>
              {o === value && <Check size={12} className="text-brand-600" />}
              <span className={o === value ? 'font-semibold' : undefined}>{o}</span>
            </button>
          ))}
        </>
      )}
    </Dropdown>
  );
}

/** The open / close control for the header's detail half. It sits at the end of
 *  the activity line — where the sentence stops and the reader is already asking
 *  for the rest — and stays in that one place whether it reads more or less, so
 *  the thing that opened the detail is the thing that closes it. The chevron
 *  turns with the state; the word carries the underline, not the arrow. */
function MoreLink({ open, onClick }: { open: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={open}
      className="group shrink-0 inline-flex items-center gap-0.5 font-medium text-brand-700 hover:text-brand-800 transition-colors cursor-pointer rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"
    >
      <span className="underline underline-offset-2 decoration-brand-300 group-hover:decoration-brand-500 transition-colors">{open ? 'less' : 'more'}</span>
      <ChevronDown size={13} className={cn('text-brand-500 transition-transform duration-200 ease-out', open && 'rotate-180')} />
    </button>
  );
}

/**
 * A section opener on this page.
 *
 * The three sections below the header used to be three 13px bold lines — the
 * same weight as half the text under them, so nothing opened and the whole page
 * sat at one tonal value (the same failure the header's own comment records).
 * They open in the serif instead: the page title is already Source Serif, and
 * DESIGN.md gives the serif to heroes and section openers. One line of plain
 * English says what the section is for; the count and any action sit on the
 * right, where they don't compete with the name.
 */
function SectionHead({ title, note, right }: { title: string; note?: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-6 mb-3.5">
      <div className="min-w-0">
        <h2 className="font-display text-[1.0625rem] leading-tight text-ink-900">{title}</h2>
        {note && <p className="mt-1 text-[0.75rem] text-ink-500 leading-relaxed max-w-[74ch]">{note}</p>}
      </div>
      {right && <div className="shrink-0 flex items-center gap-3">{right}</div>}
    </div>
  );
}

/** One named field, read as "name: value". Short facts that need their name
 *  said, sitting under the activity rather than in the line beside the title —
 *  a run of bare values up there made an auditor guess which word was the
 *  frequency and which the nature. */
function Field({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <span className="inline-flex items-baseline gap-1.5">
      <span className="text-ink-400">{label}:</span>
      <span className="font-medium text-ink-800">{value}</span>
    </span>
  );
}

export default function ControlLibraryDetail() {
  const { eng, role, selectedControlId, back, openControl, openAudit, addAttribute, updateControlMeta } = useIcfr();
  const logEvent = useAuditLog();
  const [newAttr, setNewAttr] = useState('');
  /** The header's detail half — activity and fields — open by default. */
  const [detailOpen, setDetailOpen] = useState(true);
  const [addingAttr, setAddingAttr] = useState(false);

  const control = eng.controls.find(c => c.id === selectedControlId);
  if (!control) return <div className="text-ink-500">Control not found. <button onClick={back} className="text-brand-700 font-semibold cursor-pointer">Back to Control Library</button></div>;
  const country = countryFor(eng.id, control);

  // Attributes are what the control gets tested against, so writing them is the
  // auditor's — matching the store's own guard. The owner reads them; a pen here
  // would let the first line set the questions its own work is marked on.
  const canEdit = role === 'auditor';
  const detailOwners = ownersOf(control);
  // Auditor only, matching the store's own guard on updateControlMeta. Rendering
  // the dropdown for the risk owner would offer a click that silently does
  // nothing — and who answers for a control is the audit's call, not theirs.
  const canReassign = role === 'auditor';
  // Everyone already named on the engagement, in either capacity — reassignment
  // is between people who exist, not an invitation to invent one.
  const ownerNames = Array.from(new Set(eng.controls.flatMap(c => { const o = ownersOf(c); return [o.controlOwner, o.processOwner]; }))).sort();
  const { attrs, files } = attributeStats(control);
  const audits = auditsForControl(eng, control);
  const runs = runsForControl(eng.runs, control.id);

  const submitAttr = () => {
    const text = newAttr.trim();
    if (!text) return;
    addAttribute(control.id, text);
    logEvent({ action: 'Create', description: `Added test attribute to ${control.id}`, module: 'SOX ICFR', entity: 'Control' });
    setNewAttr(''); setAddingAttr(false);
  };

  return (
    <div>
      {/* identity header — same as the audit-level control page's, minus every
          testing/status element: no court badge, no overall-status bar, no
          working paper button, no RAG tiles. Those are testing concepts, and
          testing only happens inside an audit. Not its own card — this page is
          one continuous surface, just a rule below to close the header off. */}
      {/*
        A record header.

        Three shapes came before this one and each failed the same way. One
        wrapping 11.5px line that mixed a two-word process with a sentence of
        risk. Then a label rail down the left, which read as a form and pushed
        the audit runs below the fold. Then a full-width properties bar, which
        aligned with the page but gave eight facts eight uppercase labels — and
        those labels, all 10px and all grey, became the loudest repeated thing
        on the screen, so nothing led and the whole header sat at one tonal
        value.

        What this page is, is a record. So it is built like one. The name of the
        record leads, in the size and the face that says so. Underneath it, one
        quiet line of the facts an auditor recognises on sight — a frequency
        does not need to be labelled "frequency". Below the rule, the three
        things that DO need naming, because they are three different SOX
        artefacts and they look alike as paragraphs: the objective, the risk,
        and the activity.

        Eight labels became three. The title carries the weight.
      */}
      {/* The header is its own band: white, fenced top and bottom, running to
          both screen edges while its content stays on the page's own column.
          Negative margins only reach the container's gutter, and this container
          is centred at 1320px — so the white is painted by a layer that
          overshoots on both sides instead, and the scroll parent clips it
          (SoxClassicApp, overflow-x-hidden). */}
      <header className="relative pt-5 pb-5 mb-6">
        <div aria-hidden className="absolute inset-y-0 left-[-50vw] right-[-50vw] bg-canvas-elevated border-b border-canvas-border" />
        <div className="relative">
        {/* The control TITLE is the headline (17 Sep): the RACM now names a
            control as well as describing it, and its name is what belongs at the
            top of its own page. The objective reads as one more fact below. Full
            width (feedback #27) — the old 64ch cap wrapped a long heading with
            half the header empty. */}
        <h1 className="leadsheet-title text-[1.625rem] leading-[1.25] text-ink-900">{control.description}</h1>

        {/* One line, no labels. Judgements are chips because they are somebody's
            call; the rest is plain text because it is just what the control is. */}
        <div className="mt-3 flex items-center gap-2.5 flex-wrap text-[0.78125rem] text-ink-500">
          <KeyControlChip control={control} canEdit={canEdit} />
          {control.riskRating && <Pill tone={control.riskRating === 'High' ? 'risk' : control.riskRating === 'Medium' ? 'mitigated' : 'draft'}>{control.riskRating} risk</Pill>}
          <span aria-hidden className="w-px h-3.5 bg-canvas-border" />
          {/* Which matrix this control answers to. A RACM is named by its
              process (Racm.tsx keys them `sox-racm-{eng}-{process}`), so the
              name is the process — labelled, because "Treasury" on its own
              reads as a location rather than as the register the control is
              scoped through. */}
          <span className="inline-flex items-center gap-1.5">
            <span className="text-ink-400">RACM</span>
            <span className="font-medium text-ink-800">{control.process}</span>
          </span>
          <span aria-hidden className="w-px h-3.5 bg-canvas-border" />
          {/* both names — the accountable one and the one you actually ask.
              Reassignable here rather than only at creation: people move roles
              mid-cycle, and a control still addressed to whoever held the job
              in April sends every request into an empty inbox. */}
          <span className="inline-flex items-center gap-1.5">
            <span className="text-ink-400">Control owner</span>
            <OwnerField value={detailOwners.controlOwner} options={ownerNames} canEdit={canReassign}
              onChange={v => { updateControlMeta(control.id, { owner: v }); logEvent({ action: 'Update', description: `Reassigned control owner for ${control.id} to ${v}`, module: 'SOX ICFR', entity: 'Control' }); }} />
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="text-ink-400">Process owner</span>
            <OwnerField value={detailOwners.processOwner} options={ownerNames} canEdit={canReassign}
              onChange={v => { updateControlMeta(control.id, { processOwner: v }); logEvent({ action: 'Update', description: `Reassigned process owner for ${control.id} to ${v}`, module: 'SOX ICFR', entity: 'Control' }); }} />
          </span>
        </div>

        {/* The detail half of the band, read the way the audit control page
            reads it (feedback #27): the risk the control answers, then how it is
            performed. Closed it is one line that stops where the row does; open
            it runs on and the rest follows. Either way the toggle sits at the
            end of that first line, in the one place — a chevron in front of the
            label asked the reader to find the control before they knew there was
            more to read. */}
        <div className="mt-4 text-[0.8125rem] leading-[1.7] text-ink-600">
          <p className={cn('min-w-0', !detailOpen && 'flex items-baseline')}>
            <span className="font-semibold text-ink-900 shrink-0 whitespace-nowrap">Risk {control.riskId}</span>
            <span className="text-ink-300 mx-1.5 shrink-0">·</span>
            {/* The risk's short name here, its sentence behind the disclosure. */}
            <span className={cn('min-w-0', !detailOpen && 'truncate')}>{control.riskTitle ?? control.riskDescription}</span>
            <span className="shrink-0 ml-1.5"><MoreLink open={detailOpen} onClick={() => setDetailOpen(o => !o)} /></span>
          </p>
          <AnimatePresence initial={false}>
            {detailOpen && (
              <motion.div
                key="detail"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
                className="overflow-hidden"
              >
                {control.riskTitle && (
                  <p className="mt-2">
                    <span className="font-semibold text-ink-900">Risk description</span>
                    <span className="text-ink-300 mx-1.5">·</span>
                    {control.riskDescription}
                  </p>
                )}
                <p className="mt-2">
                  <span className="font-semibold text-ink-900">Control description</span>
                  <span className="text-ink-300 mx-1.5">·</span>
                  {control.controlActivity}
                </p>
                {/* The short facts, each said with its name (user ask). They used
                    to run bare beside the title — "Payments · Financial · Manual
                    · Preventive · Monthly" asks the reader to know the schema by
                    heart. */}
                <div className="mt-3.5 flex flex-wrap items-baseline gap-x-6 gap-y-2">
                  <Field label="Sub-process" value={control.subProcess} />
                  <Field label="Class" value={control.clazz} />
                  <Field label="Nature" value={control.nature} />
                  <Field label="Type" value={control.type} />
                  <Field label="Frequency" value={control.frequency} />
                  <Field label="Assertions" value={control.assertions.join(', ')} />
                  {control.rootCause && <Field label="Root cause" value={control.rootCause} />}
                  {control.objective && <Field label="Objective" value={control.objective} />}
                  <Field label="Entity" value={control.entities?.length ? control.entities.join(', ') : control.entity} />
                  {control.effectiveDate && <Field label="Effective date" value={control.effectiveDate} />}
                  {/* The label carries the source: a stored country means a file
                      named one, and only then can it differ from its entity's. */}
                  {country.source !== 'none' && <Field label={country.source === 'file' ? 'Country (from the file)' : 'Country'} value={country.value} />}
                  {control.testingStrategy && <Field label="Testing strategy" value={control.testingStrategy} />}
                  {/* The source file's own columns. We have no field for these and
                      nothing reads them — they are shown because the client put
                      them in their matrix for a reason. */}
                  {Object.entries(control.extras ?? {}).map(([k, v]) => <Field key={k} label={k} value={v} />)}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        </div>
      </header>

      {/* Three sections, well apart. The gap between them is what tells a
          reader they have finished one thing and started another — at the 20px
          they used to sit at, the page read as one long column of small bold
          lines. */}
      <div className="space-y-9 pb-16">

      {/* audit runs — shown upfront, not behind a tab or a drawer: each audit
          this control sits in, and what THAT audit concluded (a frozen
          snapshot once superseded, live otherwise). A divided list rather than
          a grid of thin tiles: there are rarely more than three, a tile that
          holds a period and a pill is mostly empty, and a list can carry the
          window each round actually covers. */}
      <section>
        <SectionHead
          title="Audit runs"
          note="Where this control has been picked up for testing. Each audit concludes on its own evidence."
          right={audits.length > 0 && <span className="text-[0.75rem] text-ink-400 tabular-nums">{audits.length} audit{audits.length === 1 ? '' : 's'}</span>}
        />
        {audits.length === 0 ? (
          <EmptyState
            icon={<CalendarRange size={18} />}
            title="Not in any audit yet"
            hint="Attributes and their required files can still be edited here — testing starts once an audit picks this control up."
          />
        ) : (
          <div className="rounded-xl border border-canvas-border bg-canvas-elevated divide-y divide-canvas-border overflow-hidden">
            {audits.map(a => {
              const row = a.archive?.conclusions.find(r => r.controlId === control.id);
              const concl = row ? row.conclusion : controlConclusion(control);
              return (
                <button key={a.id} onClick={() => { openAudit(a.id); openControl(control.id); }}
                  className="group w-full flex items-center gap-4 px-4 py-3 text-left hover:bg-brand-50/40 transition-colors cursor-pointer">
                  <span className="min-w-0 flex-1">
                    <span className="block text-[0.8125rem] font-semibold text-ink-900 group-hover:text-brand-700 transition-colors tabular-nums">{a.period}</span>
                    <span className="block text-[0.75rem] text-ink-500 tabular-nums mt-0.5">
                      {ROUND_LABEL[a.round]} · {windowOf(a)} · {a.archive ? 'closed' : 'live'}
                    </span>
                  </span>
                  <ConclusionPill c={concl} />
                  <ChevronRight size={15} className="shrink-0 text-ink-300 group-hover:text-brand-600 transition-colors" />
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* attributes — as a table. Structure, not testing: always editable
          here regardless of any audit's progress */}
      <section>
        <SectionHead
          title="Attributes"
          note="What the control is tested against. Required files come from the RACM's Control Evidence column, split per attribute by Ira — every audit's TOE asks for these uploads."
          right={<>
            <span className="text-[0.75rem] text-ink-400 tabular-nums whitespace-nowrap">
              {attrs} attribute{attrs === 1 ? '' : 's'} · {files} file{files === 1 ? '' : 's'}
            </span>
            {canEdit && (addingAttr ? (
              <span className="flex items-center gap-2">
                <input autoFocus value={newAttr} onChange={e => setNewAttr(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') submitAttr(); if (e.key === 'Escape') { setAddingAttr(false); setNewAttr(''); } }}
                  placeholder="e.g. Approval evidenced before the transaction posts"
                  className="w-80 h-9 px-3 rounded-lg border border-canvas-border bg-canvas-elevated text-[0.78125rem] focus:outline-none focus:ring-2 focus:ring-brand-200" />
                <button disabled={!newAttr.trim()} onClick={submitAttr} className="h-9 px-3 rounded-lg bg-brand-600 text-white text-[0.75rem] font-semibold disabled:opacity-40 enabled:hover:bg-brand-700 transition-colors cursor-pointer">Add</button>
              </span>
            ) : (
              <button onClick={() => setAddingAttr(true)} className="h-8 px-3 inline-flex items-center gap-1.5 rounded-lg border border-canvas-border bg-canvas-elevated text-[0.71875rem] font-semibold text-ink-700 hover:border-brand-300 hover:text-brand-700 transition-colors cursor-pointer">
                <Plus size={12} /> Add attribute
              </button>
            ))}
          </>}
        />
        {control.operating.steps.length > 0 ? (
          <div className="reg-wrap">
            <table className="w-full border-collapse">
              <thead className="reg-head">
                <tr>
                  <th style={{ width: 68 }}>Code</th>
                  {/* Fixed, so the sentence stops where a sentence should rather
                      than stretching a short attribute across half the screen;
                      the slack goes to the files, which can use it. */}
                  <th style={{ width: 430 }}>Attribute</th>
                  <th style={{ width: 190 }}>Assertion</th>
                  <th>Required files</th>
                  <th style={{ width: 52 }} />
                </tr>
              </thead>
              <tbody>
                {control.operating.steps.map(s => <AttributeTableRow key={s.id} control={control} step={s} canEdit={canEdit} />)}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            icon={<ListChecks size={18} />}
            title="No attributes yet"
            hint="An attribute is one thing a tester checks on every sampled item. They arrive with the RACM, or you can write them here."
          />
        )}
      </section>

      {/* testing activity — the full run history, on the page itself, not
          behind a side sheet (user ask, 30 Jul) */}
      <section>
        <SectionHead
          title="Testing activity"
          note="Every control test, workflow run and AI validation that has touched this control, newest first."
          right={runs.length > 0 && <LastRunFact c={control} runs={runs} />}
        />
        {runs.length === 0 ? (
          <EmptyState
            icon={<History size={18} />}
            title="Nothing has been run on this control yet"
            hint="A control test, a workflow run or an AI validation all land here."
          />
        ) : <RunHistoryList c={control} runs={runs} />}
      </section>
      </div>
    </div>
  );
}
