// The preview before saving — their template, filled with made-up problems.
//
// Up to here the client has only seen empty boxes, so a wrong column or a
// finding card missing a field turns up in their first real report, months
// later. One extra step, printed with three invented findings, moves that to
// minute five.
//
// Nothing here is saved. The findings are obviously made up and say so.
//
// Content only: the door wraps it, so the sheet sits in the same frame the
// check screen did rather than in a second kind of panel.

import { motion } from 'motion/react';
import TemplateSheet from '../TemplateSheet';
import { madeUpFacts, MADE_UP_FINDINGS } from './madeUpReport';
import type { EditableTemplate } from '../reportShared';

export default function MadeUpPreview({ template, caption = true }: {
  template: EditableTemplate;
  /** Off where the pane above already says it is made up. Two lines saying
   *  "none of this is saved" one under the other is neither of them read. */
  caption?: boolean;
}) {
  const facts = madeUpFacts({ title: template.name, entity: template.brand }, template.scaleMap);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className="mx-auto w-full max-w-3xl"
    >
      {caption && (
        <p className="pb-3 text-[0.75rem] text-ink-400">
          Made-up data · {MADE_UP_FINDINGS.length} invented findings · none of it is saved
        </p>
      )}
      <TemplateSheet
        template={template}
        fill={{ facts, cards: MADE_UP_FINDINGS, findingScale: template.findingScale, scaleMap: template.scaleMap }}
        bannerFooter={[
          { label: 'Brand', value: template.brand || 'Irame' },
          { label: 'Generated On', value: 'Made-up date' },
          { label: 'Findings', value: `${MADE_UP_FINDINGS.length} made up` },
        ]}
      />
    </motion.div>
  );
}
