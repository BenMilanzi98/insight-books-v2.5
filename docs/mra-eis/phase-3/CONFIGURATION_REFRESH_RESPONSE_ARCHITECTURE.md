# Configuration Refresh Response Architecture

**Phase:** 3 — Target Architecture
**Date:** 2026-07-22

On shouldDownloadLatestConfig: persist response → classify current tx per verified semantics → mark stale → pause new sends → sync → remap → activate → resume. Do not guess acceptance of triggering sale.

---
*Phase 3 architecture. No MRA API calls. No production EIS implementation. No posted Journals modified.*
