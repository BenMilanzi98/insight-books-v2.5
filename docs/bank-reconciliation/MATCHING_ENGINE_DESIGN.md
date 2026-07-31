# Matching Engine Design

## Confidence

`EXACT > HIGH > MEDIUM > LOW > CONFLICTED` (+ `MANUAL` for user matches)

Auto-accept threshold from `BankRecConfiguration.autoMatchMinConfidence` (default `HIGH`).

## Match types

| Type | Meaning |
|---|---|
| ONE_TO_ONE | Single statement ↔ single JE line |
| ONE_TO_MANY | One statement ↔ subset of JE lines (sum) |
| MANY_TO_ONE | Multiple statements ↔ one JE line |
| MANY_TO_MANY | Controlled N:N when totals equal |
| PARTIAL | Split allocation; remaining amount tracked |

## Rules (default)

1. Exact reference + amount + date  
2. Exact amount + date  
3. Amount + date tolerance  
4. Amount-only (LOW — review)  
5. 1:N subset sum (MEDIUM)

## Invariants

- Matches never rewrite posted JE lines  
- Remaining amounts on statement rows and allocated book links prevent double-matching  
- Completed recon sessions reject new matches  
