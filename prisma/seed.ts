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

  async function upsertCredentialUser(input: {
    name: string;
    username: string;
    email: string;
    phone: string;
    role: AppRole;
  }) {
    const user = await prisma.user.upsert({
      where: {
        username: input.username,
      },
      update: {
        name: input.name,
        displayName: input.name,
        username: input.username,
        displayUsername: input.username,
        email: input.email,
        phone: input.phone,
        role: input.role,
        isActive: true,
        defaultBranchId: null,
      },
      create: {
        name: input.name,
        displayName: input.name,
        username: input.username,
        displayUsername: input.username,
        email: input.email,
        phone: input.phone,
        role: input.role,
        isActive: true,
        defaultBranchId: null,
      },
    });

    await prisma.account.upsert({
      where: {
        id: `${user.id}-credentials`,
      },
      update: {
        providerId: "credential",
        accountId: user.id,
        password,
      },
      create: {
        id: `${user.id}-credentials`,
        providerId: "credential",
        accountId: user.id,
        userId: user.id,
        password,
      },
    });
  }

  await upsertCredentialUser({
    name: "Admin",
    username: "admin",
    email: "admin@gmail.com",
    phone: "0923456789",
    role: AppRole.ADMIN,
  });

  await upsertCredentialUser({
    name: "Sales",
    username: "sales",
    email: "sales@gmail.com",
    phone: "0912345678",
    role: AppRole.SALES,
  });

  console.log("Bootstrap seed complete.");
  console.log("Admin login: admin / admin@gmail.com / 0923456789 / 1234");
  console.log("Sales login: sales / sales@gmail.com / 0912345678 / 1234");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
