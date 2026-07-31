# Load Test Data Strategy

**Purpose:** Realistic dataset sizes for benchmarks without production data leak.

**Options:**
1. Anonymized production subset (legal approval)
2. Synthetic seed at [WORKLOAD_MODEL.md](./WORKLOAD_MODEL.md) SME volumes (ASSUMED)
3. Golden datasets from [quality-assurance/GOLDEN_ACCOUNTING_DATASETS.md](../quality-assurance/GOLDEN_ACCOUNTING_DATASETS.md)

**Minimum row targets (ASSUMED SME):** ~300k journals, ~1.8M lines — see workload model.

**Status:** PENDING seed script for load env.

**Links:** [CAPACITY_TEST_PLAN.md](./CAPACITY_TEST_PLAN.md)
