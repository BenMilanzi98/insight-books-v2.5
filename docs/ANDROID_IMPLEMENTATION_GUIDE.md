# InsightBooks Africa — Android App Implementation Guide

**Audience:** Antigravity (development team)  
**Purpose:** Single source of truth for building the InsightBooks Africa Flutter/Android app.  
**Web reference:** This project (insight-books-v2.0).  
**App location:** The Android app will live in its **own directory on the desktop** (e.g. `~/Desktop/insightbooks-android`), separate from the web repo.

---

## 1. Project overview

### 1.1 What InsightBooks is

- **Product:** Multi-tenant accounting, invoicing, POS, HR, and business management for Africa (Malawi and beyond).
- **Web stack:** Next.js, Prisma, PostgreSQL. Tenants use subdomains or paths; roles include Master Admin, Business Owner, Staff, Client.
- **Mobile goal:** Native Android app that reuses the same API, same features and routes (where applicable), and same branding so users get a consistent experience.

### 1.2 Base API URL

All API calls use this base (configurable per environment):

```text
https://development.insightbooksafrica.com
```

Production base URL should be configurable (e.g. `https://app.insightbooksafrica.com` or your production domain).

---

## 2. Brand & theme (logo-based)

Use these values so the app matches the web app and logo.

### 2.1 Primary palette

| Role            | Hex       | Usage |
|-----------------|-----------|--------|
| **Primary**     | `#3B82F6` | Main buttons, links, active nav, app bar accent |
| **Primary dark**| `#2563EB` | Pressed/hover states for primary |
| **Secondary**  | `#6366F1` | POS, secondary actions, charts |
| **Accent**      | `#60A5FA` | Highlights, inactive icon tint when needed |

### 2.2 UI surfaces (sidebar / nav)

| Role        | Hex       | Usage |
|-------------|-----------|--------|
| **Nav background**     | `#0F172A` | Main drawer/sidebar background |
| **Nav gradient end**   | `#111827` | Bottom of sidebar gradient |
| **Nav active border**  | `#3182CE` | Left border for active item |
| **Nav item text**      | `#D1D5DB` | Default nav label |
| **Nav active text**    | `#60A5FA` | Active nav label |

### 2.3 Semantic colors

| Role      | Hex       | Usage |
|-----------|-----------|--------|
| **Success** | `#22C55E` | Payments, confirmations, positive amounts |
| **Warning** | `#F59E0B` | Trial, alerts, caution |
| **Error**   | `#EF4444` | Errors, destructive actions, negative amounts |
| **Info**    | `#3B82F6` | Info messages, links |

### 2.4 Feature accent colors (optional)

Use these for feature icons or section headers so they match the web sidebar:

- Dashboard: `#3B82F6`
- POS: `#6366F1`
- Quotations: `#14B8A6`
- Invoicing: `#A855F7`
- Expenses: `#F43F5E`
- Payments: `#22C55E`
- Reports: `#3B82F6`
- Clients: `#8B5CF6`
- Stock: `#EAB308`
- Purchases: `#EF4444`
- HR: `#06B6D4`
- Accounting (COA, Journal, etc.): `#06B6D4`, `#84CC16`, `#F97316`, `#EC4899`, `#0F766E` (per sub-item on web)

### 2.5 Neutrals

- Background: `#F9FAFB` (light), `#111827` (dark)
- Card/surface: `#FFFFFF` (light), `#1F2937` (dark)
- Border: `#E5E7EB` (light), `#374151` (dark)
- Text primary: `#111827` (light), `#F9FAFB` (dark)
- Text secondary: `#6B7280` (light), `#9CA3AF` (dark)

### 2.6 Logo

- Web app uses `/logo.png` (project root `public/`).
- Use the same asset for splash and app bar; support optional tenant `logoUrl` from API when in tenant context.

---

## 3. Authentication

### 3.1 Login (tenant/user)

- **Web route:** `/auth/login`
- **API:** `POST /api/auth/login`
- **Body:** `{ "email": string, "password": string }`
- **Success:** Returns session/token (cookie or JSON); store token securely and use for `Authorization` or cookie on subsequent requests.
- **Redirect:** Authenticated → `/dashboard`; not authenticated → `/auth/login`.

### 3.2 Other auth endpoints (align with web)

- Forgot password: `POST /api/auth/forgot-password` (or equivalent used by web).
- Reset password: use the same API as `auth/reset-password`.
- Signup: `POST /api/auth/signup` (or equivalent) if you support self-signup.
- Logout: `POST /api/auth/logout` (or GET, same as web).

### 3.3 Token handling

- Store token in secure storage (e.g. flutter_secure_storage).
- Send token on every API request (header or cookie, same as web).
- On 401: clear storage and navigate to login.
- Optional: support “remember me” (longer-lived token) if the API supports it.

---

## 4. Features and routes (mirror of web app)

Below are the **exact** feature names and paths used in the web app. Implement screens that map to these paths and call the same backend APIs the web uses.

### 4.1 Dashboard

| Feature   | Web route    | Description |
|-----------|--------------|-------------|
| Dashboard | `/dashboard` | Main dashboard: revenue, expenses, P&L, charts, recent transactions, quick actions. |

**API (examples):** Dashboard summary, reports overview, recent transactions (use same endpoints as web `app/dashboard/page.js`).

---

### 4.2 Core business (invoicing, sales, clients)

| Feature           | Web route            | Description |
|-------------------|----------------------|-------------|
| POS               | `/pos`               | Point of sale: products, cart, payment, receipt, link to invoice. |
| Quotations        | `/quotations`        | List, create, edit quotations; convert to invoice; search, filter, pagination. |
| Invoicing         | `/invoice`           | Create/list invoices, status, PDF, payment linking. |
| Credit & Debit Notes | `/credit-debit-notes` | Credit and debit notes. |
| Client Management | `/clients`           | Add/edit client, client ledger, search, filter. |

---

### 4.3 Expenses & payments

| Feature    | Web route   | Description |
|------------|-------------|-------------|
| Expenses   | `/expenses` | Add expense, category, attach receipt, filter by date/category. |
| Payments   | `/payments` | Record payments, payment methods, transaction history. |
| Payments (management) | `/payments/management` | Payment management views. |

---

### 4.4 Reports & budgeting

| Feature    | Web route | Description |
|------------|-----------|-------------|
| Reports    | `/reports` | Financial reporting (P&L, Balance Sheet, Cash Flow, export). |
| Budget     | `/budget` | Create budget, track, variance. |
| Budget (detail) | `/budget/[id]` | Single budget detail. |
| Budget reports  | `/budget/reports` | Budget reports. |

---

### 4.5 Stock & purchases

| Feature   | Web route              | Description |
|-----------|------------------------|-------------|
| Stock     | `/stock`               | Inventory, low stock alerts, warehouse. |
| Purchases | `/purchases/suppliers` | Suppliers list/management. |
| Purchase orders | `/purchases/orders` | Purchase orders. |
| Bills     | `/purchases/bills`     | Supplier bills. |
| Purchases payments | `/purchases/payments` | Purchase-related payments. |
| Receipts  | `/purchases/receipts`  | Goods received. |

---

### 4.6 Accounting

| Feature           | Web route                  | Description |
|-------------------|----------------------------|-------------|
| General Ledger    | `/general-ledger`          | General ledger. |
| Chart of Accounts | `/chart-of-accounts`       | COA management. |
| Accounting periods| `/accounting-periods`      | Open/close periods. |
| Journal entries   | `/journal-entries`         | List journal entries. |
| Journal (new)     | `/journal-entries/new`     | New journal entry. |
| Journal (edit)    | `/journal-entries/edit/[id]` | Edit journal entry. |
| Journal (view)    | `/journal-entries/[id]`    | View journal entry. |
| Trial Balance     | `/trial-balance`           | Trial balance. |
| Capital Account   | `/capital-account`         | Capital account. |
| Capital Transfers | `/capital-account/transfers` | Capital transfers. |
| Reversals         | `/transactions/reversals`  | Transaction reversals. |
| Receivables       | `/accounting/receivables`  | Receivables. |
| Payables          | `/accounting/payables`    | Payables. |

---

### 4.7 HR & payroll

| Feature        | Web route               | Description |
|----------------|-------------------------|-------------|
| HR (overview)  | `/hr`                   | HR & payroll home. |
| Employees      | `/hr/employees`         | Employee management. |
| Leave          | `/hr/leave`             | Leave management. |
| Attendance     | `/hr/attendance`        | Attendance tracking. |
| Performance    | `/hr/performance`       | Performance management. |
| Payroll        | `/hr/payroll`           | Payroll processing. |
| Payroll create | `/hr/payroll/create`    | Create payroll run. |
| PAYE Summary   | `/hr/payroll/paye-summary` | PAYE summary (e.g. MRA). |
| Benefits       | `/hr/benefits`          | Benefits & allowances. |
| Pension (NPS)  | `/hr/pension`           | Pension. |
| Gratuity       | `/hr/gratuity`          | Gratuity management. |
| Salary advances| `/hr/advances`          | Salary advances. |
| HR Reports     | `/hr/reports`           | HR reports. |

---

### 4.8 Tax & configuration

| Feature     | Web route    | Description |
|-------------|--------------|-------------|
| Tax types   | `/tax-types` | Tax creation, assignment, reports. |
| Customization | `/customization` | System customization (business info, taxes, etc.). |
| Financial setup | `/financial-setup` | Financial setup. |
| Opening balances | `/financial-setup/opening-balances` | Opening balances. |

---

### 4.9 User & role management

| Feature   | Web route | Description |
|-----------|-----------|-------------|
| Users & roles | `/users` | User creation, role assignment, permissions, RBAC. |

---

### 4.10 Branches & assets

| Feature   | Web route           | Description |
|-----------|---------------------|-------------|
| Branches  | `/branches`         | Branch creation, assignment, comparison. |
| Branch migrate | `/branches/migrate` | Branch migration. |
| Asset management | `/asset-management` | Assets, depreciation, liabilities. |

---

### 4.11 Subscription & account

| Feature    | Web route       | Description |
|------------|-----------------|-------------|
| Subscription | `/subscription` | Current plan, trial, upgrade. |
| Profile    | `/profile`     | User profile. |
| Settings   | `/settings`    | App/settings. |

---

### 4.12 InsightBooks (admin / tenant management)

These routes are for **Master Admin** or **InsightBooks** back-office. Include only if the mobile app is intended to support admin users.

| Feature       | Web route                       | Description |
|---------------|----------------------------------|-------------|
| Admin dashboard | `/insightbooks/dashboard`      | Admin dashboard. |
| Tenant management | `/insightbooks/tenant-management` | Tenant CRUD, subscription status. |
| User management  | `/insightbooks/user-management`  | Admin user management. |
| Global settings  | `/insightbooks/global-settings`  | Global settings. |
| Affiliate system | `/insightbooks/affiliate-system` | Affiliate management. |
| Billing         | `/insightbooks/billing`         | Billing overview. |
| Billing overview | `/insightbooks/billing/overview` | Billing overview. |
| Subscriptions   | `/insightbooks/billing/subscriptions` | Subscription management. |
| Billing invoices| `/insightbooks/billing/invoices` | Billing invoices. |
| Billing payments| `/insightbooks/billing/payments` | Billing payments. |
| Email management| `/insightbooks/email-management` | Bulk email. |
| Audit           | `/insightbooks/audit`           | Audit. |
| Audit logs      | `/insightbooks/audit-logs`      | Audit logs. |
| Security        | `/insightbooks/security`        | Security. |
| Admin login     | `/insightbooks/login`           | Admin login (`POST /api/admin/auth/login`). |

---

### 4.13 Client portal (for “Client” role)

| Feature   | Web route   | Description |
|-----------|-------------|-------------|
| Dashboard | `/dashboard`| Client dashboard. |
| My Invoices | `/invoices`| Client’s invoices. |
| Payment history | `/payments` | Client’s payments. |
| My Quotes | `/quotes`   | Client’s quotations. |

---

## 5. API usage (how the web app does it)

- **Base URL:** `https://development.insightbooksafrica.com` (or env).
- **Auth:** Session cookie or Bearer token (match web). Send on every request.
- **Tenant context:** Web uses tenant from session/subdomain; API often infers tenant from authenticated user. Do not send tenant ID unless the API explicitly requires it.
- **Endpoints:** Reuse the same Next.js API routes the web uses (e.g. under `/api/...`). Discover exact paths from the web codebase (e.g. `app/api/`, `fetch('/api/...')` in `app/` and `components/`).

Recommended: maintain a short **API checklist** (e.g. in the Android repo) listing each screen and the endpoints it calls (e.g. `GET /api/sales`, `POST /api/invoice`, etc.) as you implement them.

---

## 6. Navigation and roles

- **Post-login:** Main scaffold with drawer (or bottom nav) + app bar + content. Match the web sidebar structure where possible.
- **Sidebar/nav:** Icons + labels; active state (e.g. left border `#3182CE`, text `#60A5FA`); optional collapsible on tablet.
- **Role-based visibility:** Show only menu items the user is allowed to see (same permissions as web: e.g. `invoices.view`, `expenses.view`, `reports.view`, `users.view`, etc.). Get permissions from the same auth/me or user API the web uses.
- **Guards:** Protect routes so unauthenticated users are sent to login; optional role/permission checks before opening a feature.

---

## 7. Technical stack and architecture (recommendations)

- **Flutter** (latest stable) + Dart.
- **Architecture:** Clean Architecture with feature-based modules (e.g. `core/`, `features/auth/`, `features/dashboard/`, etc.).
- **State:** Riverpod or Bloc.
- **HTTP:** Dio or `http` with a single client; interceptors for auth, errors, and (in dev) logging.
- **Routing:** Named routes and a central router; optional deep links for web parity (e.g. `/invoice`, `/pos`).

---

## 8. UI/UX (align with web)

- Fintech-style: cards, 8pt grid, rounded corners (e.g. 12–20px), soft shadows, subtle gradients.
- Reusable components: primary/secondary buttons, cards, form fields, dropdowns, data tables, loaders, snackbars, dialogs.
- Loading: skeleton loaders where the web uses them.
- Empty and error states: illustrations or clear copy; retry where appropriate.
- Optional: dark mode using the dark palette above.

---

## 9. Security and robustness

- Secure token storage; clear on logout.
- 401 → logout and redirect to login.
- Handle network errors and 5xx with retry or message.
- Do not log or store passwords.

---

## 10. App location and repo

- The **Android app codebase** should live in its **own directory** (e.g. on the desktop: `~/Desktop/insightbooks-android`), **not** inside the web project `insight-books-v2.0`.
- This keeps mobile and web separate while sharing the same API and this guide as the single reference for features, routes, and theme.

---

## 11. Deliverables (summary)

- Flutter app that:
  - Uses the **theme and colors** in §2.
  - Implements **features and routes** listed in §4 and calls the same APIs as the web.
  - Uses **auth** in §3 and **API base** in §1.2.
  - Supports **role-based** nav and **guards** as in §6.
  - Is **maintainable** (Clean Architecture, feature modules, shared core).
  - Is **responsive** and **accessible** where applicable.

Use this document as the contract between the web project (insight-books-v2.0) and the Android implementation (Antigravity). For exact API payloads and response shapes, refer to the web app’s `app/api/` and the `fetch` calls in `app/` and `components/`.
