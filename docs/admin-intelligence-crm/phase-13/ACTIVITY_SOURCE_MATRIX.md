# Activity Source Matrix

| Source | Producer today | Creates CrmActivity | Wave | Class |
|--------|----------------|---------------------|------|-------|
| Manual admin Task create | `createTask` / Opportunity tasks | No (CrmTask only) | 1 migrate | EXTEND |
| Manual Note create | `createNote` | No (CrmNote only) | 1 link | EXTEND |
| Timeline projection | `appendTimelineEvent` | No (event ≠ Activity) | 1 clarify | CORRECT_AND_REUSABLE boundary |
| Follow-Up create | — | No | 1 | NOT_FOUND |
| Call plan / manual log | — | No | 2 | NOT_FOUND |
| Email draft / SMTP send | — | No | 2 | NOT_FOUND |
| Meeting create | — | No | 3 | NOT_FOUND |
| Calendar internal event | — | No | 3 | NOT_FOUND |
| Reminder fire | — | No (must not) | 4 | NOT_FOUND — reminder ≠ Activity |
| Automation trigger | — | No | 4 foundations | NOT_FOUND |
| Lead assignment | `assignment.js` | No auto Task today | 4 optional trigger | PARTIAL |
| Opportunity stage entry | `transitionOpportunityStage` | No checklist Task today | 4 optional trigger | PARTIAL |
| CS playbook / CsTask | CS plane | No | — | WRONG_DOMAIN / FORBIDDEN |
| Support ticket / SLA calendar | Support plane | No | — | WRONG_DOMAIN / FORBIDDEN |
| Email / WhatsApp inbound Lead | Foundations | No | — | NOT_AVAILABLE |
| Analytics events / POS sales | Ops / Tenant | No | — | WRONG_DOMAIN |
| Fabricated engagement import | — | No | — | FORBIDDEN |

**Rule:** One Activity record; many timeline projections. Never invent Activity volume from NOT_AVAILABLE or WRONG_DOMAIN sources.

