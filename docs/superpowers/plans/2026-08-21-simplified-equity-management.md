# Simplified Equity Management — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Equity create+post in one step; no approval; owners + contribution + drawing + declare/pay dividend; bank dropdown.

**Spec:** `docs/superpowers/specs/2026-08-21-simplified-equity-management-design.md`

## Tasks

1. Config defaults approvals off + `ensureEquityConfiguration`
2. `createEquityTransaction` always APPROVED; `createAndPostEquityTransaction`
3. Dividend declare/pay auto-post; single-owner allocation; pay declaration
4. API routes: transactions POST posts by default; dividends declare/payDeclaration
5. UI rewrite: Owners | Record | History
6. Tests: create status APPROVED; run workflow tests
