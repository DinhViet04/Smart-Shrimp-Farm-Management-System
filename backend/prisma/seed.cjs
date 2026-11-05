require('dotenv/config');

const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');

const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
const required = ['SEED_ADMIN_EMAIL', 'SEED_ADMIN_PASSWORD'];
const missing = required.filter((name) => !process.env[name]);
if (!connectionString) missing.unshift('DIRECT_URL hoặc DATABASE_URL');
if (missing.length) {
  throw new Error(`Thiếu biến môi trường cho seed: ${missing.join(', ')}`);
}

const email = process.env.SEED_ADMIN_EMAIL.trim().toLowerCase();
const password = process.env.SEED_ADMIN_PASSWORD;
const fullName = process.env.SEED_ADMIN_NAME?.trim() || 'System Administrator';

if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  throw new Error('SEED_ADMIN_EMAIL không hợp lệ');
}
if (password.length < 12) {
  throw new Error('SEED_ADMIN_PASSWORD phải có ít nhất 12 ký tự');
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

async function main() {
  const passwordHash = await bcrypt.hash(password, 12);
  const admin = await prisma.user.upsert({
    where: { email },
    update: {
      fullName,
      role: 'ADMIN',
      isActive: true,
    },
    create: {
      email,
      fullName,
      password: passwordHash,
      role: 'ADMIN',
      isActive: true,
    },
    select: { id: true, email: true, role: true },
  });

  console.log(`Seeded bootstrap admin: ${admin.email} (${admin.role})`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
