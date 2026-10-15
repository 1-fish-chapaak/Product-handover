// Custom templates mirrored from the staging Reports → Templates tab
// (auditify-staging.az.irame.ai/reports?tab=templates). Staging lists these
// from its backend; the prototype seeds them so the Custom gallery matches.
// Only the first two section names were visible on staging's cards, so each
// seed carries just those.
import type { EditableTemplate } from '../components/reports/reportShared';

const BUILDER_DESC = 'Report format composed in the report builder.';

const seed = (
  n: number,
  name: string,
  desc: string,
  sections: [string, string],
  engagementName?: string,
): EditableTemplate => ({
  id: `ct-staging-${String(n).padStart(2, '0')}`,
  name,
  desc,
  category: 'Custom',
  icon: 'file-text',
  sections: sections.map(s => ({ name: s, icon: 'file-text' })),
  ...(engagementName ? { engagementId: `eng-staging-${n}`, engagementName } : {}),
});

export const SEED_CUSTOM_TEMPLATES: EditableTemplate[] = [
  seed(1, 'Sample audit report.pptx format', 'Format read from Sample audit report.pptx.', ['Cover page', 'Disclaimer / report usage limitation']),
  seed(2, 'Kapil Test 1st Oct .pptx format', 'Format read from Consolidated Final Procurement V4.pptx.', ['Cover page', 'Disclaimer / report usage limitation']),
  seed(3, '30 Sep', '', ['Ruchi Soya Industries Limited', 'Need to restrict creation of duplicate material codes in SAP'], 'Nilesh Test 21 Sep'),
  seed(4, '21 Sep Template test nilesh', BUILDER_DESC, ['Ruchi Soya Industries Limited', 'Table of Content']),
  seed(5, 'PDF Test 12 Nilesh 12 Sep', BUILDER_DESC, ['Cover page', 'Contents'], 'Custom Report Testing Nilesh'),
  seed(6, 'PPT Test 12 Nilesh 12Sep', BUILDER_DESC, ['IRA Features Overview', '1. Comprehensive Data Handling']),
  seed(7, 'Paytm E-Commerce Private Limited', BUILDER_DESC, ['Introduction', 'A. Introduction, scope of work, approach and limitation'], 'nilesh'),
  seed(8, 'Nilesh PPT Test 10 12 Sep', BUILDER_DESC, ['Observation rating criteria (Branch audits)', 'Current year observation summary']),
  seed(9, 'Testing 12th sepNIlesh', BUILDER_DESC, ['Ruchi Soya Industries Limited', 'Table of Content']),
  seed(10, 'Custom Report Testing Nilesh — 11 Sep 2026, 11:52:29', BUILDER_DESC, ['Introduction', 'Audit Report']),
  seed(11, 'Custom Report Testing Nilesh — 11 Sep 2026, 11:52:29', BUILDER_DESC, ['Introduction', 'Audit Report']),
  seed(12, 'Custom Report Testing Nilesh — 11 Sep 2026, 11:52:29', BUILDER_DESC, ['Introduction', 'Custom Report Testing Nilesh — 11 Sep 2026, 11:52:29']),
  seed(13, 'Ruchi Soya Industries Limited', BUILDER_DESC, ['Ruchi Soya Industries Limited', 'Observation:']),
  seed(14, 'Ruchi Soya Industries Limited', BUILDER_DESC, ['Ruchi Soya Industries Limited', 'Ruchi Soya Industries Limited']),
  seed(15, 'Nilesh PPT test 8', BUILDER_DESC, ['Observation rating criteria (Branch audits)', 'Current year observation summary']),
  seed(16, 'PPT Part 2 Test 7 Nilesh', BUILDER_DESC, ['Cover page', 'Table of contents']),
  seed(17, 'PPT Test Nilesh 6', BUILDER_DESC, ['Table of contents', 'Introduction / Background']),
  seed(18, 'Section Change Nilesh Test 5', BUILDER_DESC, ['Introduction', 'Executive summary']),
  seed(19, 'Test 4 Report Nilesh on11 sep', BUILDER_DESC, ['Introduction', 'A. Introduction, scope of work, approach and limitation']),
  seed(20, 'Fiday Test Nilesh 3rd Report', BUILDER_DESC, ['Contents', '1. Executive summary and audit opinion']),
  seed(21, 'New YELLOW TEMPLATE', BUILDER_DESC, ['Introduction', 'INFOSYS LIMITED']),
  seed(22, 'Internal Audit Report', BUILDER_DESC, ['Introduction', 'INFOSYS LIMITED']),
];
