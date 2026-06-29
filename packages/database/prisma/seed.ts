/**
 * Database Seed Script - Super Administrator Account
 *
 * This script creates the default Super Administrator account for the platform.
 * It is executed during initial setup via `prisma db seed` or `pnpm db:seed`.
 *
 * The Super Administrator account has unrestricted access to all administration
 * features including:
 *   - Platform Configuration & Secrets Management
 *   - User Management
 *   - Roles & Permissions
 *   - System Settings
 *   - Audit Logs
 *   - Feature Flags
 *   - Billing & Subscription Management
 *   - Deployments
 *   - AI Providers
 *   - Monitoring & Diagnostics
 *   - All future administration modules
 *
 * The account is active by default and does not require email verification.
 * Password is hashed using bcrypt with a salt factor of 10 (same as auth service).
 *
 * To modify the default administrator credentials, update the SUPER_ADMIN_EMAIL
 * and SUPER_ADMIN_PASSWORD constants below, then re-run the seed.
 */

import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

// Default Super Administrator credentials
const SUPER_ADMIN_EMAIL = 'waylm228@gmail.com';
const SUPER_ADMIN_PASSWORD = 'E35e617309041963';
const SUPER_ADMIN_NAME = 'Super Administrator';
const BCRYPT_SALT_ROUNDS = 10;

async function main(): Promise<void> {
  console.log('Seeding database...');

  // Hash password using bcrypt (same mechanism as auth service)
  const passwordHash = await bcrypt.hash(SUPER_ADMIN_PASSWORD, BCRYPT_SALT_ROUNDS);

  // Upsert the super admin user to avoid duplicates
  const superAdmin = await prisma.user.upsert({
    where: { email: SUPER_ADMIN_EMAIL },
    update: {
      role: 'SUPER_ADMIN',
      name: SUPER_ADMIN_NAME,
      // Only update password hash if user already exists to maintain credentials
      passwordHash,
    },
    create: {
      email: SUPER_ADMIN_EMAIL,
      name: SUPER_ADMIN_NAME,
      passwordHash,
      role: 'SUPER_ADMIN',
    },
  });

  console.log(`Super Administrator account seeded: ${superAdmin.email} (ID: ${superAdmin.id})`);
  console.log('Database seeding completed.');
}

main()
  .catch((error) => {
    console.error('Error seeding database:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
