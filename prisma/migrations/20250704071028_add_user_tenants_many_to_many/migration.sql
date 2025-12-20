-- CreateTable
CREATE TABLE "_UserTenants" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_UserTenants_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_UserTenants_B_index" ON "_UserTenants"("B");

-- AddForeignKey
ALTER TABLE "_UserTenants" ADD CONSTRAINT "_UserTenants_A_fkey" FOREIGN KEY ("A") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_UserTenants" ADD CONSTRAINT "_UserTenants_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
