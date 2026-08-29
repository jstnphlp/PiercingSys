import { loadEnvConfig } from "@next/env";
import { PrismaPg } from "@prisma/adapter-pg";
import { createClient, type User } from "@supabase/supabase-js";

import { PrismaClient } from "../src/generated/prisma/client";

loadEnvConfig(process.cwd());

function required(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required to seed the owner account.`);
  }
  return value;
}

function isLocalUrl(value: string) {
  const hostname = new URL(value).hostname;
  return hostname === "127.0.0.1" || hostname === "localhost" || hostname === "::1";
}

async function main() {
  const databaseUrl = required("DATABASE_URL");
  const supabaseUrl = required("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = required("SUPABASE_SERVICE_ROLE_KEY");
  const email = required("PRISMA_SEED_EMAIL").toLowerCase();
  const password = required("PRISMA_SEED_PASSWORD");

  if (password.length < 8) {
    throw new Error("PRISMA_SEED_PASSWORD must contain at least 8 characters.");
  }

  if (
    (!isLocalUrl(supabaseUrl) || !isLocalUrl(databaseUrl)) &&
    process.env.PRISMA_SEED_ALLOW_REMOTE !== "true"
  ) {
    throw new Error(
      "Remote Prisma seeding is blocked. Set PRISMA_SEED_ALLOW_REMOTE=true only after checking the target project.",
    );
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: databaseUrl }),
  });
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
  const findUserByEmail = async (): Promise<User | null> => {
    const perPage = 100;

    for (let page = 1; ; page += 1) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
      if (error) throw error;

      const user = data.users.find((candidate) => candidate.email?.toLowerCase() === email);
      if (user) return user;
      if (data.users.length < perPage) return null;
    }
  };

  try {
    const staff = await prisma.$queryRaw<Array<{ email: string | null; role: string }>>`
      select lower(users.email) as email, staff_profiles.role::text as role
      from public.staff_profiles
      join auth.users on users.id = staff_profiles.user_id
    `;
    const existingOwner = staff.find((profile) => profile.role === "owner");

    if (staff.length > 0 && existingOwner?.email !== email) {
      throw new Error(
        `Staff bootstrap is already complete for ${existingOwner?.email ?? "another account"}. The seed will not replace ownership.`,
      );
    }

    let user = await findUserByEmail();
    if (user) {
      const { data, error } = await admin.auth.admin.updateUserById(user.id, {
        password,
        email_confirm: true,
      });
      if (error) throw error;
      user = data.user;
    } else {
      const { data, error } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      if (error) throw error;
      user = data.user;
    }

    if (!existingOwner) {
      await prisma.$queryRaw`select public.bootstrap_first_owner(${email})`;
    }

    console.info(`Prisma seed ready: ${user.email} is the Piercing Corner owner.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
