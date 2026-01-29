const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkTaxData() {
  try {
    const taxTypes = await prisma.taxType.findMany({
      include: {
        account: true
      }
    });
    
    console.log('--- Tax Types ---');
    for (const tt of taxTypes) {
      console.log(`Name: ${tt.taxName}, Code: ${tt.taxCode}, Status: ${tt.status}, Account: ${tt.account?.accountCode}, ID: ${tt.id}`);
      
      const transactions = await prisma.transaction.findMany({
        where: {
          status: 'posted',
          lines: {
            some: {
              accountId: tt.accountId
            }
          }
        },
        include: {
          lines: {
            where: {
              accountId: tt.accountId
            }
          }
        }
      });
      
      console.log(`Found ${transactions.length} transactions for this tax type`);
      if (transactions.length > 0) {
        transactions.slice(0, 2).forEach(tx => {
          console.log(`  Tx: ${tx.id}, Date: ${tx.date}, Source: ${tx.sourceType}, Amount: ${tx.lines[0].debitAmount || tx.lines[0].creditAmount}`);
        });
      }
    }
  } catch (err) {
    console.error(err);
  } finally {
    await prisma.$disconnect();
  }
}

checkTaxData();

