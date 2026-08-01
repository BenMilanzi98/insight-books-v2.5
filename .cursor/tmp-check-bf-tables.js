const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const tables = await p.$queryRaw`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename IN ('PlanningBudget','LegacyBudget','Budget','BudgetLine','PlanningForecast')
    ORDER BY tablename`;
  const migrations = await p.$queryRaw`
    SELECT migration_name, finished_at FROM "_prisma_migrations"
    WHERE migration_name LIKE '%budget_forecast%' OR migration_name LIKE '%Legacy%'
    ORDER BY finished_at DESC NULLS LAST
    LIMIT 10`;
  console.log(JSON.stringify({ tables, migrations }, null, 2));
  console.log('has budget model', typeof p.budget?.findMany);
  console.log('has legacyBudget', typeof p.legacyBudget?.findMany);
  await p.$disconnect();
})().catch(async (e) => {
  console.error(e);
  await p.$disconnect();
  process.exit(1);
});
