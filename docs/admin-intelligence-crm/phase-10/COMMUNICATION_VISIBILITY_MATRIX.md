# Communication Visibility Matrix

| Message type | Customer portal (future) | Support agent | Manager | CS portfolio | Auditor |
|--------------|--------------------------|---------------|---------|--------------|---------|
| CUSTOMER_MESSAGE | Yes (own) | Yes | Yes | Summary | Read |
| PUBLIC_AGENT_REPLY | Yes | Yes | Yes | Summary | Read |
| INTERNAL_NOTE | **Never** | Yes | Yes | No by default | Read if permitted |
| RESTRICTED_INTERNAL_NOTE | **Never** | Need permission | Need permission | No | Need permission |
| SYSTEM_EVENT | Filtered | Yes | Yes | Limited | Read |

Enforcement at API layer — never CSS-only.
