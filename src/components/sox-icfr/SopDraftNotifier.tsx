/**
 * Tells the reader an SOP draft they left running is ready (7 Oct, stage 5).
 *
 * Mounted once beside the notification centre, so it hears the draft finish on
 * whatever page the reader went to. Renders nothing; delivers one app-wide
 * notification per draft, whose link reopens it in the RACM Library.
 *
 * TDZ note: reads sox-icfr exports only inside the effect.
 */
import { useEffect, useRef } from 'react';
import { useNotify } from '../../notifications/NotificationContext';
import { sopDrafts, subscribeSopDrafts } from './sopBackgroundDrafts';

export default function SopDraftNotifier() {
  const notify = useNotify();
  const told = useRef(new Set<string>());
  useEffect(() => subscribeSopDrafts(() => {
    for (const d of sopDrafts()) {
      if (d.status !== 'ready' || told.current.has(d.id)) continue;
      told.current.add(d.id);
      notify({
        eventId: 'WFL-15', actor: 'Ira',
        title: `Draft RACM ready — ${d.file.name}`,
        message: `Ira finished extracting the ${d.process} RACM${d.entity ? ` for ${d.entity}` : ''}. Open it to check the flowchart and the rows.`,
        facts: [{ label: 'File', value: d.file.name }, { label: 'Process', value: d.process }],
        recipients: [{ name: 'You', role: 'Uploader' }],
        link: { view: 'racm-library', ref: { kind: 'racm-draft', id: d.id } }, linkLabel: 'Open draft',
        operationKey: d.id,
      });
    }
  }), [notify]);
  return null;
}
