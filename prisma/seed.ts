import "dotenv/config";
import argon2 from "argon2";

import { PrismaPg } from "@prisma/adapter-pg";

import { AppRole, PrismaClient } from "../generated/prisma/client";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required to run the seed script.");
}

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

const prisma = new PrismaClient({ adapter });

async function main() {
  const password = await argon2.hash("1234");

  const admin = await prisma.user.upsert({
    where: { username: "admin" },
    update: {
      name: "Admin",
      email: "admin@gmial.com",
      role: AppRole.ADMIN,
      isActive: true,
      defaultBranchId: null,
      displayName: "Admin",
    },
    create: {
      name: "Admin",
      displayName: "Admin",
      username: "admin",
      email: "admin@gmial.com",
      role: AppRole.ADMIN,
      isActive: true,
      defaultBranchId: null,
    },
  });

  await prisma.account.upsert({
    where: { id: `${admin.id}-credentials` },
    update: {
      providerId: "credential",
      accountId: admin.id,
      password,
    },
    create: {
      id: `${admin.id}-credentials`,
      providerId: "credential",
      accountId: admin.id,
      userId: admin.id,
      password,
    },
  });

  console.log("Bootstrap seed complete. Admin login: admin@gmial.com / 1234.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
