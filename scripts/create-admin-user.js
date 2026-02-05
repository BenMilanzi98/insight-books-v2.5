/**
 * Script to create a new admin user
 * Usage: node scripts/create-admin-user.js <email> <name> <password>
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const bcrypt = require('bcryptjs');

async function createAdminUser(email, name, password) {
  try {
    console.log(`\n👤 Creating admin user...`);
    
    // Find Admin role
    const adminRole = await prisma.role.findFirst({
      where: { name: { contains: 'Admin' } }
    });
    
    if (!adminRole) {
      console.error('❌ Admin role not found!');
      process.exit(1);
    }
    
    console.log(`✅ Found role: ${adminRole.name} (ID: ${adminRole.id})`);
    
    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() }
    });
    
    if (existingUser) {
      console.log('⚠️  User already exists. Updating password...');
      const hashedPassword = await bcrypt.hash(password, 12);
      await prisma.user.update({
        where: { id: existingUser.id },
        data: { password: hashedPassword }
      });
      console.log(`✅ Password updated!`);
      return;
    }
    
    // Get first tenant (or create one)
    let tenant = await prisma.tenant.findFirst();
    
    if (!tenant) {
      console.log('⚠️  No tenant found. Creating default tenant...');
      tenant = await prisma.tenant.create({
        data: {
          name: 'System Admin',
          subdomain: 'admin',
          status: 'active',
          subscriptionPlan: 'enterprise'
        }
      });
      console.log(`✅ Created tenant: ${tenant.name} (ID: ${tenant.id})`);
    }
    
    console.log(`✅ Using tenant: ${tenant.name} (ID: ${tenant.id})`);
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);
    
    // Create user
    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        name: name,
        password: hashedPassword,
        roleId: adminRole.id,
        tenantId: tenant.id,
        isActive: true
      }
    });
    
    console.log(`\n✅ Admin user created successfully!`);
    console.log(`\n📋 User Details:`);
    console.log(`   Email: ${email}`);
    console.log(`   Name: ${name}`);
    console.log(`   Password: ${password}`);
    console.log(`   Role: ${adminRole.name}`);
    console.log(`   Tenant: ${tenant.name}`);
    console.log(`   User ID: ${user.id}`);
    console.log(`\n🔗 Login at: https://insightbooksafrica.com/admin/login`);
    
  } catch (error) {
    console.error('❌ Error creating admin user:', error);
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
  console.log('\n📝 Usage: node scripts/create-admin-user.js <email> <name> <password>');
  console.log('\nExample:');
  console.log('   node scripts/create-admin-user.js admin@insightbooks.com "System Admin" 236810nb');
  process.exit(1);
}

createAdminUser(email, name, password);
