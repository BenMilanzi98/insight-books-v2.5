/**
 * Script to reset admin password
 * Usage: node scripts/reset-admin-password.js <email> <newPassword>
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const bcrypt = require('bcryptjs');

async function resetAdminPassword(email, newPassword) {
  try {
    console.log(`\n🔐 Resetting password for: ${email}`);
    
    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() }
    });
    
    if (!user) {
      console.error('❌ User not found!');
      process.exit(1);
    }
    
    console.log(`✅ User found: ${user.name} (ID: ${user.id})`);
    
    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 12);
    
    // Update password
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword }
    });
    
    console.log(`\n✅ Password reset successfully!`);
    console.log(`📧 Email: ${email}`);
    console.log(`🔑 New password: ${newPassword}`);
    
  } catch (error) {
    console.error('❌ Error resetting password:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Get email and new password from command line
const email = process.argv[2];
const newPassword = process.argv[3];

if (!email || !newPassword) {
  console.log('\n📝 Usage: node scripts/reset-admin-password.js <email> <newPassword>');
  console.log('\nExample:');
  console.log('   node scripts/reset-admin-password.js admin@insightbooks.com MyNewPassword123');
  process.exit(1);
}

resetAdminPassword(email, newPassword);
