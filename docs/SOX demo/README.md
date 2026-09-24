# Altura P2P — end-to-end demo run sheet

Everything needed to take a manager from an empty screen to a concluded control test,
on **Procure to Pay** for **Altura Infra Holdings Limited**, FY 2025-26.

Nothing here is invented at the point of use: the trial balance ties to the entity
register, the RACM's risks tie to the controls, and every evidence document ties to
the same invoices, purchase orders and goods receipt notes.

---

## The documents

Everything sits in this one folder: the four source documents loose at the top, then a
folder per tested control, each holding a **TOD** and a **TOE** folder.

| Step | File | What it is |
|---|---|---|
| Entities | `altura-infra-group-org-chart.xlsx` | The 8 group companies, ownership chain, jurisdiction |
| Materiality | `altura-infra-group-trial-balance-fy26.xlsx` | 443 account rows, 8 companies — ties to the register |
| Materiality | `altura-infra-group-general-ledger-fy26.xlsx` | 1,274 journal lines behind those captions |
| Scope | `altura-p2p-racm-fy26.xlsx` | **10 P2P controls**, all 22 required columns, TOD checks + attributes on every row |
| TOD / TOE | `<control>/TOD/` and `<control>/TOE/` | 32 evidence documents for the three tested controls |

### The three controls that get tested

| Control | Nature | Attributes | Outcome |
|---|---|---|---|
| **C069** Three-way match before payment authorisation | Automated | 3 | Effective |
| **C065** Invoice validation before posting | Manual | 2 | Effective |
| **C070** Duplicate invoice detection | Automated | 2 | **2 exceptions → deficiency** |

The other 7 controls stay untested — which is what an audit in progress actually looks like.

---

## The run

### 1 · Create the engagement

**Engagements → New Engagement → SOX / ICFR → Continue.**

**Basics**
- Name: `FY 2025-26 ICFR — Altura Infra Holdings`
- Description: anything
- Group: `Altura Infra Holdings Limited`
- Entities: press **Org Chart** and upload `altura-infra-group-org-chart.xlsx`
  → 8 companies land with their ownership chain.

> The entity names must stay exactly as the chart spells them. Scoping pre-ticks a RACM
> by matching those strings, and a re-typed name leaves every RACM unticked.

**Materiality & TB**
- Upload `altura-infra-group-trial-balance-fy26.xlsx`, and the GL alongside it.
- Answer **Source of the document** for both files — Continue stays greyed until you do.
- Basis: **% of total asset balance** — an infrastructure group is asset-intensive.
- Benchmark: `7607` · Basis %: `1` · PM: `75` · Clearly-trivial: `5`

  That gives **overall ₹76.1 Cr · PM ₹57.1 Cr · CTT ₹3.81 Cr**, and leaves between
  4 and 12 captions above PM per company — so materiality actually decides something.

- Open **What the trial balance says** and drill into a caption to show the ledger lines
  behind it, with the manual journals flagged.

> The benchmark is **not** read from the trial balance. It has to be typed.

**Scope**
- Tick **Procure to Pay**, and the entities you want.
- Press **Upload RACM** on the Procure to Pay row and upload `altura-p2p-racm-fy26.xlsx`.
- Every column maps on its own — no field needs picking. 10 controls, no row held.

> Upload the RACM **from inside this step**. A RACM uploaded from the RACM Library page
> lands as a **Draft**, and scoping will not offer a draft. The Scope-step upload
> publishes it as it creates it.

- Any move off the recommendation needs a typed note before Continue.

**Sampling** → confirm the table. **Review** → **Create FY26 programme**.

### 2 · Create the audit

Open the engagement → **SOX testing** tab → **New audit**.

- Year basis FY, year 2026, round **Interim**, window across the period → Create.

> New audit is disabled until the engagement has at least one control — the RACM has to
> be in first.

### 3 · Test of design

Inside the audit: **Control Library → C069**.

Step ① **Test of design** — for each design element press **Attach evidence** and give it
the matching file from `C069 - Three-way match (automated, effective)/TOD/`:

| Design element | File |
|---|---|
| Process narrative | `C069_process_narrative.pdf` |
| Flowchart | `C069_flowchart.pdf` |
| Walkthrough | `C069_walkthrough.pdf` |
| Policy / SOP | `C069_policy_ap_invoice_processing_sop.pdf` |
| Precision & thresholds | `C069_configuration_extract.pdf` |

Use **Add element** if a kind isn't on the list yet.

On a design check, **Attach your own** takes the auditor's proof — the configuration
extract fits *"Configuration extract"*, the walkthrough fits *"Walkthrough note"*. That
is what the **Basis** line reads from.

Answer each design check, then conclude **Design effective**.

> Steps ②–④ stay locked until a **reviewer approves** the design. Switch persona to the
> reviewer and approve, or TOE cannot start.

### 4 · Population and sample

Step ② Population → step ③ Sample drawing. Draw the sample.

### 5 · Test of operating effectiveness

Step ④. Each attribute lists the evidence it needs. Press **Upload several** and select
**all** the files for that attribute from `C069 - Three-way match (automated, effective)/TOE/`.

They file themselves — every filename scores 100 against its slot, so there is no
mapping to do and no button to press afterwards.

| Attribute | Files to select |
|---|---|
| A — matched to PO and GRN before release | `A1_signed_approval_record.pdf`, `A1_invoice_register_extract.xlsx`, `A1_purchase_order_report.xlsx` |
| B — tolerance breach held | `B1_signed_approval_record.pdf`, `B1_payment_run_report.xlsx`, `B1_exception_and_hold_report.xlsx` |
| C — ran on every PO-based invoice | `C1_signed_approval_record.pdf`, `C1_invoice_register_extract.xlsx`, `C1_purchase_order_report.xlsx` |

Pass each attribute, then conclude. **C069 is effective.**

### 6 · The one that fails

Repeat for **C070** using `C070 - Duplicate detection (FAILS - deficiency)/`.

Its evidence contains two invoices paid twice on an override with no approval on file —
`B1_signed_approval_record.pdf` shows both overrides missing the Head of AP's approval
that SOP-P2P-004 §6.4 requires. Fail attribute B, conclude **not effective**, and carry
it into deficiency management.

The config extract shows why: `DUP-04 — normalise reference before compare: Off`. The
duplicate check compares the invoice number as keyed, so a re-keyed reference slips past.

### 7 · C065 if you want a manual control too

`C065 - Invoice validation (manual, effective)/` — same shape, manual control, reviewer sign-off
rather than system configuration.

---

## Things that will trip you up

1. **A RACM uploaded from the RACM Library is a Draft** and scoping won't offer it.
   Upload from the Scope step, or publish it first.
2. **Materiality is typed, not derived** from the trial balance.
3. **Every scope change needs a note** before Continue un-greys.
4. **TOD must be reviewer-approved**, not merely concluded, before TOE unlocks.
5. **Entity names must match** between the org chart, the TB and the RACM's Entity column.
6. **Evidence files are named deliberately.** Renaming one drops its match score and it
   stops auto-filing.
