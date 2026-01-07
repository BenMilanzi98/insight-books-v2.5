const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function setupAdmin() {
  try {
    console.log('Setting up admin account...');

    // Check if admin already exists
    const existingAdmin = await prisma.admin.findUnique({
      where: { email: 'admin@insightbooks.com' }
    });

    // Hash the password
    const hashedPassword = await bcrypt.hash('admin123', 10);

    if (existingAdmin) {
      // Update the password
      await prisma.admin.update({
        where: { email: 'admin@insightbooks.com' },
        data: {
          password: hashedPassword,
          isActive: true
        }
      });
      console.log('Admin account password updated successfully!');
    } else {
      // Create admin account
      const admin = await prisma.admin.create({
        data: {
          email: 'admin@insightbooks.com',
          name: 'System Administrator',
          password: hashedPassword,
          role: 'Super Admin',
          permissions: {
            "all": true,
            "users": true,
            "tenants": true,
            "system": true,
            "billing": true,
            "security": true
          },
          isActive: true
        }
      });
      console.log('Admin account created successfully!');
    }

    console.log('Email: admin@insightbooks.com');
    console.log('Password: admin123');
    console.log('⚠️  Please change the password after first login!');

  } catch (error) {
    console.error('Error setting up admin account:', error);
  } finally {
    await prisma.$disconnect();
  }
}

setupAdmin();