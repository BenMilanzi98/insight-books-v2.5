# Permission Audit

## Tax
Defined: tax.view, tax.update, tax.export, tax.settle.  
taxManagement.*: none (introduce with alias → tax.*).  
Settle route does not require tax.settle.

## Reversals
Page/list middleware: journalEntries.view.  
Execute middleware: journalEntries.update.  
V2 reverse: journal.reverse.  
Client UI checks accounting.view / reports.view / mixed — inconsistent with middleware.

## Wave 1–2 actions
1. Alias taxManagement.view|update|export|settle ↔ tax.*
2. Align reverse execute with journal.reverse (or dedicated transactions.reverse aliased)
3. Auditors remain read-only
