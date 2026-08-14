# Cost of Goods rename + P&L CIT — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans.

**Goal:** Rename Cost of Sales → Cost of Goods (incl. CoA), keep 5110 under Cost of Goods on P&L, and auto-post CIT for NPBT → NPAT.

**Architecture:** Display/structure renames + IS match/slim fixes; new `citProvisionService` upserts CitProvision journals from enabled MW-CIT tax; P&L labels NPBT/CIT/NPAT.

**Tech Stack:** Existing CoA structure, Accounting V2 posting, tax management catalog.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-08-14-cogs-rename-pl-cit-design.md`
- Keep internal `COST_OF_SALES` category keys; change labels
- CIT option B: auto-post; closed period = display only
- Cash P&L: no CIT post

---

### Task 1: Rename CoA / labels
- Modify: `lib/coaSystemStructureTree.js`, blueprint files, IS line label, heal helper
- Test: structure name assertions if present

### Task 2: P&L COGS not in OpEx
- Modify: `reportDefinitions.js` match rules, `financialStatementService.js` slim keep/labels
- Ensure 511x → cost-of-sales

### Task 3: CIT resolve + post + P&L lines
- Create: `lib/accountingV2/reporting/citProvisionService.js`
- Wire: periodized/accrual IS generate after NPBT
- Labels: Net Profit Before Tax / Corporate Income Tax / Net Profit After Tax

### Task 4: Verify
- Unit tests for rename helpers + CIT amount math + idempotent sourceId
