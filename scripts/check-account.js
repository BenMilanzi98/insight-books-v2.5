/**
 * Check if a specific account exists
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkAccount() {
  try {
    const accountId = process.argv[2] || 'cmi8m5cd00016jqj9f0td44m1';
    
    console.log(`\n🔍 Checking account: ${accountId}\n`);
    
    const account = await prisma.account.findUnique({
      where: { id: accountId },
      select: {
        id: true,
        accountCode: true,
        accountName: true,
        accountType: true,
        isActive: true
      }
    });
    
    if (account) {
      console.log('✅ Account found:');
      console.log(`   Code: ${account.accountCode}`);
      console.log(`   Name: ${account.accountName}`);
      console.log(`   Type: ${account.accountType}`);
      console.log(`   Active: ${account.isActive}`);
    } else {
      console.log('❌ Account NOT FOUND');
      console.log('\n   Available Income/Revenue accounts:');
      
      const accounts = await prisma.account.findMany({
        where: {
          accountType: { in: ['Income', 'Revenue'] },
          isActive: true
        },
        select: {
          id: true,
          accountCode: true,
          accountName: true,
          accountType: true
        },
        orderBy: { accountCode: 'asc' },
        take: 10
      });
      
      accounts.forEach(acc => {
        console.log(`   - ${acc.id}: ${acc.accountCode} - ${acc.accountName} (${acc.accountType})`);
      });
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkAccount();
