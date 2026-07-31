# Adoption State Matrix

| State | Requires | Live today |
|-------|----------|------------|
| NOT_ENTITLED | Entitlement resolution | Partial (plan data) |
| ENTITLED_NOT_AVAILABLE | Flag/env | Partial |
| AVAILABLE_NOT_DISCOVERED | Discovery event (non-value) | NOT_INSTRUMENTED |
| DISCOVERED_NOT_CONFIGURED | Discovery + missing config | NOT_INSTRUMENTED |
| CONFIGURATION_STARTED / CONFIGURED_NOT_USED | Config events | NOT_INSTRUMENTED |
| FIRST_VALUE_ACHIEVED | First-value fact | NOT_INSTRUMENTED |
| REPEAT_VALUE_ACHIEVED | Repeat-value rule | NOT_INSTRUMENTED |
| RECENTLY_ACTIVE / CONSISTENTLY_ACTIVE | Cadence-aware activity | NOT_INSTRUMENTED |
| DECLINING_USAGE / INACTIVE / DISCONTINUED | History | NOT_INSTRUMENTED |
| NOT_APPLICABLE | Feature N/A to tenant | Catalogue |
| UNKNOWN | Failed/missing evidence | Gate |

Page view must not advance past discovery. Missing producers → UNKNOWN / NOT_INSTRUMENTED — never fake CONSISTENTLY_ACTIVE.
