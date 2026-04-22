-- Allow the same email in different tenants; enforce uniqueness on (tenantId, email) only.
-- PostgreSQL: multiple (NULL, email) rows are allowed under a UNIQUE constraint on (tenantId, email).

DROP INDEX IF EXISTS "User_email_key";

CREATE UNIQUE INDEX "User_tenantId_email_key" ON "User" ("tenantId", "email");
