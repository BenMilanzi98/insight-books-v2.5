# Appwrite + InsightBooks

## 1. Add Appwrite client config

### To `appwrite/.env`

The repo root **`.env.example`** holds the **Appwrite server** config (all `_APP_*` variables). Your **`appwrite/.env`** should already match that. Add the **client** variables below so the InsightBooks app can talk to your Appwrite instance:

```env
# InsightBooks app → Appwrite client (Database / Auth / Storage)
NEXT_PUBLIC_APPWRITE_PROJECT_ID=69b33941000f435cc9df
NEXT_PUBLIC_APPWRITE_PROJECT_NAME=insightbooks
NEXT_PUBLIC_APPWRITE_ENDPOINT=http://localhost:9090/v1
```

One-liner to append them (run from repo root):

```bash
cat >> appwrite/.env << 'EOF'

# InsightBooks app → Appwrite client
NEXT_PUBLIC_APPWRITE_PROJECT_ID=69b33941000f435cc9df
NEXT_PUBLIC_APPWRITE_PROJECT_NAME=insightbooks
NEXT_PUBLIC_APPWRITE_ENDPOINT=http://localhost:9090/v1
EOF
```

### Optional: project root `.env`

If the Next.js app will call Appwrite (e.g. for storage or auth), add the same three `NEXT_PUBLIC_APPWRITE_*` variables to the **project root `.env`**. Do **not** remove or change `DATABASE_URL` there (see section 2).

---

## 2. Why the app cannot use “Appwrite as DATABASE_URL”

- **InsightBooks** uses **Prisma** with **PostgreSQL** (`DATABASE_URL`). All data (tenants, users, invoices, payroll, etc.) lives in PostgreSQL.
- **Appwrite Database** is a separate product: it exposes a **REST/SDK API** (collections and documents), not a PostgreSQL connection string. Prisma cannot connect to Appwrite.
- So **do not change `DATABASE_URL`** to an Appwrite URL. There is no such URL; the app would break. Keep `DATABASE_URL` pointing at your PostgreSQL database.

**Summary:** Keep all existing config in `.env` and **leave `DATABASE_URL` as your PostgreSQL URL**. Use the Appwrite vars above only for optional Appwrite features (e.g. file storage, Appwrite Auth), not as the main app database.

---

## 3. Pushing current data into Appwrite (migration)

To have the same data in Appwrite as in PostgreSQL you would need to:

1. **Export** from PostgreSQL (e.g. per-table CSV or JSON).
2. **Create** Appwrite collections that match your logical entities (e.g. Tenant, User, Invoice).
3. **Transform** each row into Appwrite document format and **import** via the Appwrite API (e.g. with a Node script using the Appwrite SDK).

That is a one-off migration project: schema design in Appwrite, mapping from Prisma models, and scripts. It does **not** replace Prisma in the codebase unless you also **rewrite** all database access (every `prisma.*` call) to use the Appwrite SDK instead. Until that rewrite is done, the **system must keep using PostgreSQL** (current `DATABASE_URL`) so nothing breaks.

---

## 4. Checklist

- [ ] Append the three `NEXT_PUBLIC_APPWRITE_*` variables to `appwrite/.env`.
- [ ] (Optional) Add the same three to the project root `.env` if the Next.js app will call Appwrite.
- [ ] **Do not** change `DATABASE_URL` in `.env` to Appwrite; keep it as your PostgreSQL URL.
- [ ] For a full “push DB to Appwrite” migration, plan separate export → Appwrite schema → import and, if desired, a later code change from Prisma to Appwrite SDK.
