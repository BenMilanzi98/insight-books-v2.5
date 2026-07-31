# Admin API Documentation

This document describes the administrative APIs available in the system. Most of these APIs are located under `app/api/admin`.

## Authentication

All admin APIs require authentication via an `admin_token` cookie. This cookie is set upon successful login.

### Admin Login

- **Endpoint:** `POST /api/admin/auth/login`
- **Request Body:**
  ```json
  {
    "email": "admin@example.com",
    "password": "yourpassword"
  }
  ```
- **Response:**
  ```json
  {
    "success": true,
    "message": "Login successful",
    "admin": {
      "id": "admin-id",
      "email": "admin@example.com",
      "name": "Admin Name",
      "role": "SUPER_ADMIN",
      "permissions": {}
    }
  }
  ```
- **Notes:** Sets an HTTP-only cookie named `admin_token`.

### Admin Logout

- **Endpoint:** `POST /api/admin/auth/logout`
- **Notes:** Clears the `admin_token` cookie.

### Get Current Admin

- **Endpoint:** `GET /api/admin/auth/me`

---

## Tenants Management

### List Tenants

- **Endpoint:** `GET /api/admin/tenants`
- **Response:** Returns a list of all tenants with their subscription status and plan.

### Create Tenant

- **Endpoint:** `POST /api/admin/tenants`
- **Request Body:**
  ```json
  {
    "name": "New Tenant Name"
  }
  ```
- **Notes:** Automatically generates a subdomain, sets up default roles, financial defaults, and a 30-day trial subscription.

### Delete Tenant

- **Endpoint:** `DELETE /api/admin/tenants/delete`
- **Query Params:** `?tenantId=...`

---

## User Management

### List Users

- **Endpoint:** `GET /api/admin/users`
- **Query Params:**
  - `page`: Page number (default: 1)
  - `limit`: Items per page (default: 10)
  - `search`: Search by name, email, or phone
  - `role`: Filter by role name
  - `status`: Filter by status (`active`, `inactive`, `pending`)
  - `tenant`: Filter by tenant name

### Create User

- **Endpoint:** `POST /api/admin/users`
- **Request Body:**
  ```json
  {
    "name": "User Name",
    "email": "user@example.com",
    "phone": "123456789",
    "role": "role-id",
    "status": "active",
    "tenantId": "tenant-id",
    "password": "password123",
    "department": "IT",
    "defaultBranchId": "branch-id",
    "allowedBranchIds": ["branch-id-1", "branch-id-2"]
  }
  ```

---

## Subscriptions

### Main Subscriptions

- **List Subscriptions:** `GET /api/admin/subscriptions`
- **Create/Update Subscription:** `POST /api/admin/subscriptions`
  - **Request Body:** `{ tenantId, plan, amount, currency, status, isActive, isTrial, expiresAt, paymentMethod, notes }`

### EIS Subscriptions

- **List EIS Subscriptions:** `GET /api/admin/eis-subscriptions`
  - **Query Params:** `status` (active, expired, all), `planType` (monthly, yearly, all), `search`.
- **Create EIS Subscription:** `POST /api/admin/eis-subscriptions`
  - **Request Body:** `{ tenantId, plan, amount, currency, status, isActive, expiresAt, paymentMethod, notes }`
  - **Notes:** Plans are `eis-monthly` and `eis-yearly`.

### Branch Subscriptions

- **List Branch Subscriptions:** `GET /api/admin/branch-subscriptions`
  - **Query Params:** `tenantId`.
- **Create Branch Subscription:** `POST /api/admin/branch-subscriptions`
  - **Request Body:** `{ tenantId, branchId, durationDays, amount, currency, notes }`
  - **Notes:** Automatically deactivates previous active subscriptions for the same branch.

---

## System Health & Metrics

### System Health

- **Endpoint:** `GET /api/admin/system-health`
- **Response:** Returns system statistics (total tenants, users, invoices, etc.), database status, performance metrics (CPU, memory), and security metrics.

### Admin Metrics

- **Endpoint:** `GET /api/admin/metrics`

---

## Backups

### List Backups

- **Endpoint:** `GET /api/admin/backups`
- **Response:** Returns a list of available backups (currently mock data).

### Create Backup

- **Endpoint:** `POST /api/admin/backups`
- **Request Body:**
  ```json
  {
    "type": "full",
    "description": "Pre-update backup"
  }
  ```

---

## Audit Logs

### General Audit Logs

- **Endpoint:** `GET /api/admin/audit-logs`
- **Query Params:** `page`, `limit`, `action`.

### Admin Audit Logs

- **Endpoint:** `GET /api/admin/audit/admin-logs`

---

## Roles & Permissions

### List Roles

- **Endpoint:** `GET /api/admin/roles`
- **Query Params:** `tenantId`, `search`.

### Create Role

- **Endpoint:** `POST /api/admin/roles`
- **Request Body:**
  ```json
  {
    "name": "Manager",
    "description": "Tenant manager role",
    "tenantId": "tenant-id",
    "permissions": { ... }
  }
  ```

---

## Settings & Maintenance

### System Settings

- **Endpoint:** `GET /api/admin/settings`
- **Endpoint:** `POST /api/admin/settings`

### Maintenance Mode

- **Endpoint:** `POST /api/admin/maintenance`

---

## Security

### Security Stats

- **Endpoint:** `GET /api/admin/security`
- **Response:** Returns login attempts, active sessions, and security-related logs.

