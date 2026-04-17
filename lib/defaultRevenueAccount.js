/**
 * Resolve the tenant's default revenue / sales account for services and POS-style lines.
 * Prefers CoA code 4000, then 4100, then any active Income or Revenue account.
 *
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {string} tenantId
 * @returns {Promise<string|null>} account id
 */
export async function resolveDefaultRevenueAccountId(prisma, tenantId) {
  if (!tenantId) return null;

  const norm = (c) => String(c ?? "").trim();

  const candidates = await prisma.account.findMany({
    where: { tenantId, isActive: true },
    select: { id: true, accountCode: true, accountType: true },
    take: 400,
    orderBy: { accountCode: "asc" },
  });

  let hit = candidates.find((a) => norm(a.accountCode) === "4000");
  if (!hit) hit = candidates.find((a) => norm(a.accountCode) === "4100");
  if (!hit) {
    hit = candidates.find((a) => {
      const t = (a.accountType || "").toLowerCase();
      return t.includes("income") || t.includes("revenue");
    });
  }
  return hit?.id ?? null;
}
