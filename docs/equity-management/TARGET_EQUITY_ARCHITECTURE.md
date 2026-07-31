# Target Equity Architecture

See also [`EQUITY_DATA_FLOW_MAP.md`](./EQUITY_DATA_FLOW_MAP.md).

## Layers

1. **EqV2Configuration** — legal structure + equity model gates workflows  
2. **EqV2PartyRelationship** — business-scoped owner/partner/shareholder  
3. **EqV2ShareClass / EqV2OwnershipHolding** — versioned ownership (never overwrite)  
4. **EqV2EquityTransaction** — approved financial/ownership events  
5. **Posting Engine** — only path to JournalEntry  
6. **Equity subledger** — derived from posted transactions + JE linkage  
7. **Reports** — SOCE / BS consume GL (Phase 7); Capital Account statement from EqV2  

## Non-goals retained

Year-end CYE → RE transfer is Phase 12.
