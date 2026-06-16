import { PrismaClient, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const email = 'alaa@gmail.com';
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return;
  }
  await prisma.user.create({
    data: {
      email,
      passwordHash: await bcrypt.hash('alaa1919', 10),
      role: UserRole.ADMIN,
      firstName: 'Admin',
    },
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
