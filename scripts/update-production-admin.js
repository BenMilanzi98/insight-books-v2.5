/**
 * Script to update admin user on PRODUCTION database
 * This connects directly to the production database using the DATABASE_URL
 */

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

// Create a new PrismaClient that uses the DATABASE_URL from env
const prisma = new PrismaClient({
  datasourceUrl: process.env.DATABASE_URL
});

async function updateProductionAdmin() {
  try {
    console.log('\n🔐 Setting up production admin user...\n');
    
    const email = 'admin@insightbooks.com';
    const password = '236810nb';
    const hashedPassword = await bcrypt.hash(password, 12);
    
    // Check if admin exists in production
    console.log('📡 Connecting to production database...');
    const existingAdmin = await prisma.admin.findUnique({ 
      where: { email: email.toLowerCase() } 
    });
    
    if (existingAdmin) {
      console.log('✅ Admin found in production. Updating password...');
      await prisma.admin.update({
        where: { id: existingAdmin.id },
        data: { 
          password: hashedPassword,
          isActive: true,
          role: 'SUPER_ADMIN'
        }
      });
      console.log('✅ Admin password updated successfully!');
    } else {
      console.log('📝 Creating new admin user in production...');
      const admin = await prisma.admin.create({
        data: {
          email: email.toLowerCase(),
          name: 'System Admin',
          password: hashedPassword,
          role: 'SUPER_ADMIN',
          isActive: true,
          permissions: {}
        }
      });
      console.log('✅ Admin created:', admin.id);
    }
    
    console.log('\n📋 Production Admin Credentials:');
    console.log(`   Email: ${email}`);
    console.log(`   Password: ${password}`);
    console.log(`   Role: SUPER_ADMIN`);
    console.log('\n🌐 Access production at: https://insightbooksafrica.com/insightbooks/login');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.log('\n💡 Make sure DATABASE_URL is set in your environment');
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

updateProductionAdmin();
