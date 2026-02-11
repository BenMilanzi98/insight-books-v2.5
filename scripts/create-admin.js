/**
 * Script to create a new Admin user (for admin panel)
 * Usage: node scripts/create-admin.js <email> <name> <password>
 * 
 * This creates an Admin record in the Admin table, which is separate from the User table.
 * Admin users can access the /admin/* routes.
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const bcrypt = require('bcryptjs');

async function createAdmin(email, name, password) {
  try {
    console.log(`\n👤 Creating admin user...`);
    
    // Check if admin already exists
    const existingAdmin = await prisma.admin.findUnique({
      where: { email: email.toLowerCase() }
    });
    
    if (existingAdmin) {
      console.log('⚠️  Admin already exists. Updating password...');
      const hashedPassword = await bcrypt.hash(password, 12);
      await prisma.admin.update({
        where: { id: existingAdmin.id },
        data: { 
          password: hashedPassword,
          isActive: true
        }
      });
      console.log(`✅ Password updated!`);
      console.log(`\n📋 Admin Details:`);
      console.log(`   Email: ${email}`);
      console.log(`   Name: ${existingAdmin.name}`);
      console.log(`   Role: ${existingAdmin.role}`);
      console.log(`   Admin ID: ${existingAdmin.id}`);
      console.log(`\n🔗 Login at: https://insightbooksafrica.com/admin/login`);
      return;
    }
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);
    
    // Create admin
    const admin = await prisma.admin.create({
      data: {
        email: email.toLowerCase(),
        name: name,
        password: hashedPassword,
        role: 'Super Admin',
        permissions: {},
        isActive: true
      }
    });
    
    console.log(`\n✅ Admin user created successfully!`);
    console.log(`\n📋 Admin Details:`);
    console.log(`   Email: ${email}`);
    console.log(`   Name: ${name}`);
    console.log(`   Password: ${password}`);
    console.log(`   Role: Super Admin`);
    console.log(`   Admin ID: ${admin.id}`);
    console.log(`\n🔗 Login at: https://insightbooksafrica.com/admin/login`);
    
  } catch (error) {
    console.error('❌ Error creating admin user:', error);
    if (error.code === 'P2002') {
      console.error('   Email already exists in the database.');
    }
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Get parameters from command line
const email = process.argv[2];
const name = process.argv[3];
const password = process.argv[4];

if (!email || !name || !password) {
  console.log('\n📝 Usage: node scripts/create-admin.js <email> <name> <password>');
  console.log('\nExample:');
  console.log('   node scripts/create-admin.js admin@insightbooks.com "System Admin" yourpassword123');
  console.log('\nNote: This creates an Admin record (for /admin/* routes), not a User record.');
  process.exit(1);
}

createAdmin(email, name, password);
