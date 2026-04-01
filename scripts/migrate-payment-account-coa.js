const { Client } = require('pg');

const DATABASE_URL = process.argv[2] || process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('Usage: node scripts/migrate-payment-account-coa.js <DATABASE_URL>');
  console.error('  e.g. node scripts/migrate-payment-account-coa.js "postgresql://user:pass@host:5432/db"');
  process.exit(1);
}

const STATEMENTS = [
  {
    label: 'Add coaAccountId column to PaymentAccount',
    sql: `ALTER TABLE "PaymentAccount" ADD COLUMN IF NOT EXISTS "coaAccountId" TEXT;`,
  },
  {
    label: 'Create index on coaAccountId',
    sql: `CREATE INDEX IF NOT EXISTS "PaymentAccount_coaAccountId_idx" ON "PaymentAccount"("coaAccountId");`,
  },
  {
    label: 'Add foreign key to Account',
    sql: `
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'PaymentAccount_coaAccountId_fkey'
        ) THEN
          ALTER TABLE "PaymentAccount"
            ADD CONSTRAINT "PaymentAccount_coaAccountId_fkey"
            FOREIGN KEY ("coaAccountId") REFERENCES "Account"("id")
            ON DELETE SET NULL ON UPDATE CASCADE;
        END IF;
      END
      $$;
    `,
  },
];

async function run() {
  const client = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  try {
    await client.connect();
    console.log('Connected to database.\n');

    for (const { label, sql } of STATEMENTS) {
      process.stdout.write(`  ${label} ... `);
      await client.query(sql);
      console.log('OK');
    }

    console.log('\nMigration complete. PaymentAccount.coaAccountId is now available.');
  } catch (err) {
    console.error('\nMigration failed:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
