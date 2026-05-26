# Configurable Engagement V3

## Purpose

This module implements the pattern-driven Configurable Engagement V3 platform for Irame. It replaces the fixed RACM/control-testing engagement flow with a configurable system supporting three locked engagement patterns.

## Pattern-Driven Approach

One internal object (`Engagement`) supports multiple execution patterns. The pattern type determines user-facing labels, workspace tabs, setup fields, execution flow, review rules, output types, and closure rules.

## Supported Patterns

| Pattern | Display Label | Use Cases |
|---------|--------------|-----------|
| Compliance Control Testing | Engagement | SOX, IFC, ICOFR, SOC 1/2, GDPR |
| Internal Audit Assignment | Audit Assignment | Process audits, SOP reviews, plant audits |
| Workflow Automation Project | Project | Vendor reconciliation, expense validation, MIS |

## Why This Module Is Isolated

- Old Engagement Execution V2 (`src/components/engagement-execution-v2/`) remains untouched and functional.
- This module is not yet wired into the app routing or Process Hub.
- No existing modules (RACM, Control Library, Risk Register, Sidebar, Reports) are modified.
- Feature flag or hidden route will be added in a later step.

## File Structure

```
src/components/engagement-configurable/
  configurableEngagementTypes.ts   — Core types, enums, interfaces
  engagementPatterns.ts            — Pattern metadata definitions
  mockConfigurableEngagementData.ts — Mock data (3 example engagements)
  configurableEngagementState.ts   — Display helpers + draft validation
  README.md                        — This file
```

## What Not To Change Yet

- Do not modify Process Hub routing.
- Do not modify RACM, Control Library, Risk Register, Sidebar, or Reports.
- Do not delete old Engagement Execution V2 files.
- Do not wire this module into App.tsx until explicitly instructed.

## Implementation Sequence

1. Type skeleton + pattern definitions + mock data + helpers (this step)
2. Creation wizard UI
3. Workspace shell with pattern-driven tabs
4. Compliance workspace tabs (reusing V2 concepts)
5. Internal Audit workspace tabs
6. Automation Project workspace tabs
7. Routing integration + Process Hub wiring
8. Feature flag removal + production readiness

## Reference

See `docs/CONFIGURABLE_ENGAGEMENT_V3_MEMORY.md` for full product rules, validation logic, and implementation protocol.
