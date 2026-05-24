export interface ReportQueryAtr {
  title: string;
  summary: string;
  findings: string[];
  observations: string[];
  /** Rich markdown answer — rendered in the query card via renderAssistantText,
   *  the same renderer the chat uses for Q&A answers. */
  answer: string;
}

export const REPORT_QUERIES_ATR: Record<string, ReportQueryAtr> = {
  Q01: {
    title: 'Detects duplicate invoice entries by vendor, date, and amount to streamline audit review and assign case identifiers.',
    summary: 'The workflow identified 140 duplicate invoice entries across vendors, each grouped into case IDs. Duplicates represent ~95.6M in invoice value, with some cases exceeding 24.2M for a single vendor-date-amount combination.',
    findings: [
      '140 rows across 6 columns — 70 distinct duplicate cases (each with duplicate_count = 2).',
      'Total duplicated INVOICE_VALUE: 95,631,064.00 (mean: 683,079.00 per invoice).',
      'VENDOR_002: highest total at 32,676,258.0. VENDOR_006: most frequent with 16 records.',
      'Largest single case: CASE_000007 at 24,231,986.0 in duplicated value.',
      'Invoice values range from 62.79 to 12,115,993.00 — both small and very high-value invoices affected.',
    ],
    observations: [
      'Widespread duplicates across vendors — some with particularly high exposure in both frequency and value.',
      'Each case has exactly two matching invoices — auditors can quickly validate which to keep or reverse.',
      'Multi-million cases represent significant financial risk — should be prioritized in review workflows.',
    ],
    answer: `Scanned the AP invoice ledger and surfaced **140 duplicate invoice entries**, grouped into **70 distinct cases** that each pair two matching invoices. Together these duplicates carry **₹95.6M** in invoice value, averaging ₹6.83L per invoice.

> Sample-data preview: figures are from the connected sandbox source. Re-run against the production SAP AP module before promoting any case to a formal finding.

### Where to look first

- **VENDOR_002** holds the highest exposure at **₹32.68M** in duplicated value.
  - **VENDOR_006** is the most frequent offender, with 16 duplicate records — treat it as a control gap, not a one-off reversal.
- **CASE_000007** is the single largest case at **₹24.23M** — triage this one before anything else.
- Invoice values span ₹62.79 to ₹1.21Cr, so low-value noise and high-value risk are mixed together.

Every case has exactly two matching invoices, so an auditor can quickly decide which to keep and which to reverse. Promote a case to a finding from the \`Flagged cases\` table, or open the [duplicate-payment SOP](#) for the standard remediation path.`,
  },
  Q02: {
    title: 'Identifies unauthorized vendor master changes without proper approval workflow in the last 90 days.',
    summary: 'Vendor master data analysis revealed 47 changes in 90 days. 12 lacked dual-approval — 8 involved bank account modifications (highest fraud risk category).',
    findings: [
      '12 changes made without approval records in the workflow system.',
      '8 changes involved bank account modifications — highest payment fraud risk.',
      'VENDOR_015: 4 unauthorized changes within a single week (potential control bypass).',
    ],
    observations: [
      'Bank account field changes represent critical payment fraud risk — requires immediate remediation.',
      'Control gaps may exist during off-hours processing windows.',
    ],
    answer: `Vendor master analysis flagged **47 changes over the last 90 days**. **12 were applied without the required dual-approval**, and **8 of those touched bank account fields** — the highest payment-fraud risk category.

> Bank-account changes with no approval record are the most exploitable gap here. Treat the eight flagged records as priority-one until each is matched to an approved request.

### What to verify

- **VENDOR_015** received **4 unauthorized changes inside a single week** — a concentration that reads less like error and more like a control bypass.
- The remaining unauthorized changes are spread thin, but each one still needs an approved change request matched to it.
- Gaps appear to cluster in **off-hours processing windows** — check whether approval enforcement weakens outside business hours.

Confirm every bank-account modification against its originating request before sign-off, and open the \`Vendor changes\` table to assign a risk owner where one is missing.`,
  },
  RA01: {
    title: 'Risk identification across P2P, O2C, R2R, and S2C business processes — 12 critical risks mapped to 87 controls.',
    summary: 'Enterprise risk assessment identified 12 risks across 4 business processes. 2 critical risks (RSK-004 Fictitious vendors, RSK-007 Malware via portals) remain uncontrolled with zero mapped controls. Estimated uncontrolled exposure: 18L.',
    findings: [
      'RSK-004 (Fictitious vendor registration) and RSK-007 (Malware via vendor portals) have zero controls mapped.',
      'P2P process carries 75% of total risk exposure — highest concentration in any single process.',
      'Risk RSK-003 (Duplicate payments) has 3 controls but effectiveness rating below 60%.',
      'S2C risks are under-assessed — only 3 of 14 controls tested to date.',
    ],
    observations: [
      'Uncontrolled critical risks represent highest-priority remediation items for Q1.',
      'P2P concentration risk suggests need for diversified control strategies.',
      'AI-powered detection workflows reduced false positive rate from 6.5% to 4.2% — recommend expansion.',
    ],
    answer: `The enterprise risk assessment mapped **12 risks across 4 business processes** (P2P, O2C, R2R, S2C) against 87 controls. Two of them — **RSK-004 (fictitious vendor registration)** and **RSK-007 (malware via vendor portals)** — currently have **zero controls mapped**. Estimated uncontrolled exposure: **₹18L**.

> The two uncontrolled critical risks are the highest-priority remediation items for Q1. Everything else can queue behind them.

### Concentration to watch

- **P2P carries 75% of total risk exposure** — the heaviest concentration in any single process; diversified controls would reduce that fragility.
- **RSK-003 (duplicate payments)** has 3 controls but an effectiveness rating **below 60%** — controls exist, but they are not doing the job.
- **S2C is under-assessed** — only 3 of 14 controls tested so far.

On the positive side, AI-powered detection workflows have already pulled the false-positive rate from 6.5% to 4.2%; expanding them is a sound next step. Promote a risk to a tracked finding from the \`Risk register\`.`,
  },
  RA02: {
    title: 'Mitigation strategy effectiveness analysis — 3 partially mitigated high risks require additional compensating controls.',
    summary: '18 mitigation strategies reviewed. 3 classified as ineffective — all relate to manual detective controls in P2P that fail under high-volume processing (>500 transactions/day).',
    findings: [
      'Manual three-way match process fails at scale — 8% error rate above 500 daily transactions.',
      'Vendor onboarding KYC control relies on single-person verification — no dual-approval in place.',
      'Compensating control for SOD violations (monthly review) has 45-day average lag.',
    ],
    observations: [
      'Automation of manual detective controls could reduce error rates to below 1%.',
      'Real-time monitoring workflows would replace delayed monthly reviews.',
    ],
    answer: `A review of **18 mitigation strategies** classified **3 as ineffective**. All three are **manual detective controls in P2P** that break down under high-volume processing — above roughly **500 transactions per day**.

> The common thread is manual effort at scale. Automating these three controls likely matters more than adding new ones.

### Where the controls fail

- The **manual three-way match** runs an **8% error rate** once daily volume passes 500 transactions.
- **Vendor onboarding KYC** relies on **single-person verification** — there is no dual-approval step.
- The compensating control for SOD violations is a **monthly review with a 45-day average lag** — slow enough that a violation can clear payment before it is caught.

Automating the manual detective controls could cut error rates **below 1%**, and real-time monitoring would replace the delayed monthly review outright. The \`Control gaps\` table has the per-control detail.`,
  },
  CE01: {
    title: 'Control testing results across 87 controls — 48/54 tested controls rated effective, 6 require remediation.',
    summary: 'Control effectiveness assessment across all business processes. 89% of tested controls rated effective. 2 material weaknesses identified in P2P journal entry approval and R2R reconciliation process.',
    findings: [
      'CTR-012 (Journal entry approval): Override detected in 7 instances — material weakness.',
      'CTR-031 (GL reconciliation): 3 accounts with unreconciled differences >30 days.',
      'P2P automated controls (CTR-001 to CTR-005) all rated highly effective — AI detection at 95.8% accuracy.',
      '33 controls still untested — S2C process has lowest coverage at 21%.',
    ],
    observations: [
      'Automated controls significantly outperform manual ones — 98% vs 82% effectiveness rate.',
      'S2C control testing must be prioritized before June 30 deadline.',
      'Recommend converting 5 manual detective controls to automated preventive controls.',
    ],
    answer: `Control effectiveness testing covered the tested portion of the 87-control library: **48 of 54 tested controls rated effective (89%)**. Two **material weaknesses** surfaced — one in P2P journal-entry approval, one in R2R reconciliation.

> Two material weaknesses is two too many ahead of the SOX filing. Each needs a named remediation owner and a date before June 30.

### Material weaknesses

- **CTR-012 (journal-entry approval)** — approval override detected in **7 instances**. This is the headline weakness.
- **CTR-031 (GL reconciliation)** — **3 accounts** carry unreconciled differences older than **30 days**.

Automated controls clearly outperform manual ones — **98% vs 82% effectiveness** — and P2P's automated set (CTR-001 to CTR-005) runs at 95.8% detection accuracy. The real gap is coverage: **33 controls remain untested**, and **S2C sits at just 21%**. Prioritise S2C testing before the deadline, and consider converting five manual detective controls to automated preventive ones. The \`Control test log\` has the full breakdown.`,
  },
  WA01: {
    title: 'Workflow execution performance metrics — 115 runs across 8 active workflows with 94.2% accuracy rate.',
    summary: '8 active AI workflows processed 115 runs this quarter. Duplicate Invoice Detector leads with 45 runs and 96% precision. Processing time improved 14% after model retrain. Vendor Master Monitor caught 2 critical unauthorized changes.',
    findings: [
      'Duplicate Invoice Detector: 45 runs, 96% precision, saved 2.4L this month.',
      'Three-Way PO Match: 87% auto-match rate, 5% unmatched requiring manual review.',
      'Vendor Master Monitor: 2 unauthorized bank changes blocked before payment.',
      'SOD Violation Detector: 12 violations found across 2,341 users — 4 critical.',
    ],
    observations: [
      'Model retrain reduced false positive rate from 6.5% to 4.2% — 35% reduction in auditor review time.',
      'Workflow scheduling optimization could reduce processing queue by 2 hours.',
      'Recommend adding anomaly detection layer to Three-Way PO Match for variance prediction.',
    ],
    answer: `Eight active AI workflows processed **115 runs** this quarter at a blended **94.2% accuracy rate**, with processing time **down 14% after the model retrain**.

> Performance is healthy. The opportunity now is tuning — trimming review time and queue lag rather than fixing failures.

### How the workflows performed

- **Duplicate Invoice Detector** — 45 runs, **96% precision**, ₹2.4L saved this month. The strongest performer.
- **Three-Way PO Match** — **87% auto-match rate**; the remaining 5% needs manual review.
- **Vendor Master Monitor** — blocked **2 unauthorized bank changes** before payment cleared.
- **SOD Violation Detector** — surfaced 12 violations across 2,341 users, **4 of them critical**.

The retrain cut the false-positive rate from 6.5% to 4.2%, a **35% reduction in auditor review time**. Two further moves are worth it: optimise scheduling to shave roughly 2 hours off the processing queue, and add an anomaly-detection layer to the \`Three-Way PO Match\` for variance prediction.`,
  },
  WA02: {
    title: 'Exception trend analysis — 23 exceptions flagged across workflows, 8 resolved automatically by AI.',
    summary: '23 exceptions flagged this quarter. AI auto-resolved 35% without human intervention. 3 escalated to senior audit — all related to vendor bank account modifications exceeding risk threshold.',
    findings: [
      '8 exceptions auto-resolved via AI confidence scoring (>95% match confidence).',
      '3 escalated cases all involved bank account field changes — pattern suggests targeted testing needed.',
      'Average exception resolution time: 4.2 hours (down from 8.1 hours last quarter).',
    ],
    observations: [
      'Auto-resolution rate trending upward — target 50% by Q2.',
      'Bank account modification exceptions should trigger enhanced verification workflow.',
    ],
    answer: `**23 exceptions** were flagged across the workflows this quarter. AI **auto-resolved 8 of them (35%)** with no human intervention; **3 were escalated** to senior audit.

> Every one of the three escalations involved a vendor **bank-account change** above the risk threshold. That is a pattern, not a coincidence.

### What the exceptions show

- The 8 auto-resolved cases all cleared a **95%+ match-confidence** bar — the confidence scoring is doing its job.
- The 3 escalated cases share a single trait: **bank-account field changes**. They warrant targeted testing as a group.
- Average resolution time fell to **4.2 hours**, down from 8.1 hours last quarter.

Auto-resolution is trending up, and a 50% target by Q2 is realistic. In the meantime, bank-account modification exceptions should route automatically into an enhanced verification workflow. The \`Exception log\` carries each case.`,
  },
  EX01: {
    title: 'Board-level GRC posture summary — compliance at 94.2%, 2 material weaknesses, 18L uncontrolled exposure.',
    summary: 'Enterprise GRC posture is strong at 94.2% compliance with improving trajectory. Two material weaknesses require board attention. AI-powered workflows saved 24L YTD through automated detection and prevention.',
    findings: [
      'Compliance score improved from 91.8% to 94.2% quarter-over-quarter.',
      'DEF-002 (Journal entry approval override) — remediation due in 6 days.',
      'AI workflows saved 24L in cost avoidance — 2.4L from duplicate invoice blocking alone.',
      'Team utilization at 74% — Tushar Goel over-allocated at 120% in April.',
    ],
    observations: [
      'On track for Q1 SOX filing deadline March 31.',
      'Budget utilization at 67% — within planned range.',
      'Recommend board approval for additional AI workflow investment in S2C process.',
    ],
    answer: `The enterprise GRC posture is strong: **94.2% compliance**, up from 91.8% the prior quarter, on an improving trajectory. AI-powered workflows have saved **₹24L year-to-date** through automated detection and prevention.

> The posture is good, but it is not yet clean — two material weaknesses still need board attention.

### For the board's attention

- **DEF-002 (journal-entry approval override)** — remediation is **due in 6 days**.
- AI workflows account for **₹24L in cost avoidance**, ₹2.4L of it from duplicate-invoice blocking alone.
- **Team utilisation sits at 74%**, but Tushar Goel was over-allocated at **120% in April** — a resourcing risk worth surfacing.

The audit is on track for the **Q1 SOX filing on March 31**, and budget utilisation (67%) is within plan. The recommendation to carry forward: board approval for further AI-workflow investment in S2C, where control coverage is weakest.`,
  },
};
