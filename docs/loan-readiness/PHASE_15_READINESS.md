# Phase 15 Readiness (Security / Approvals / Audit hardening)

Phase 14 exposes surfaces for Phase 15 review:

- `loanReadiness.*` permissions and separation of duties  
- Document / collateral sensitivity (checklist structure; storage hardening pending)  
- Score-model governance and override approval path  
- Lender/product criteria source labelling  
- AI commentary review gate  
- Immutable assessment snapshots + audit metadata  
- Export controls for lender packs  
- Cross-business rejection on all services  
- Feature flags for controlled disable  

## Remaining blockers for Phase 15

- Platform-wide malware scanning / signed download links for sensitive uploads  
- Full SoD enforcement (preparer ≠ sole approver) as hard policy  
- Data-retention automation for ownership / ID documents  
- Background covenant monitoring jobs with alert permissions  
