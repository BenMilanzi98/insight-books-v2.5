# Simplified Loan Readiness — Implementation Plan

**Spec:** `docs/superpowers/specs/2026-08-21-simplified-loan-readiness-design.md`

1. Config ensure ACTIVE + GET auto-ensure  
2. BigInt-safe serializers; `runAssessment` one-shot  
3. Assessments POST `action: 'run'`  
4. Rewrite `/loan-readiness` UI  
5. Smoke test / vitest for serialization + createLoanRequest JSON
