# Tax Report Audit

## Exists
- /api/reports/tax-summary
- Per-type reports under tax-types/[id]/reports
- GL TAXES report paths
- reversed-taxes export OK

## Broken
UI links /api/reports/tax-summary/export — endpoint missing (tax.export gated).

## Missing
Filing/VAT return views, return↔transaction recon, subledger↔GL recon.

## Classification
EXTEND tax-summary; REIMPLEMENT export; Wave 5 recon engines.
