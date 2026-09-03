import { loadEnvConfig } from "@next/env";
import { PrismaPg } from "@prisma/adapter-pg";
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";

import { PrismaClient } from "../src/generated/prisma/client";
import type { payment_method } from "../src/generated/prisma/enums";

loadEnvConfig(process.cwd());

const MOCK_STAFF = [
  { email: "manager.seed@piercingcorner.test", displayName: "Mika Santos", role: "manager", color: "#8a6bb8" },
  { email: "ana.seed@piercingcorner.test", displayName: "Ana Reyes", role: "piercer", color: "#d17a8c" },
  { email: "bea.seed@piercingcorner.test", displayName: "Bea Cruz", role: "piercer", color: "#5d91c6" },
  { email: "carlo.seed@piercingcorner.test", displayName: "Carlo Mendoza", role: "piercer", color: "#6b9f78" },
] as const;

const MOCK_CUSTOMERS = [
  ["72000000-0000-4000-8000-000000000001", "Alyssa", "Navarro", "alyssa.navarro@example.test", "09170000001"],
  ["72000000-0000-4000-8000-000000000002", "Bianca", "Lim", "bianca.lim@example.test", "09170000002"],
  ["72000000-0000-4000-8000-000000000003", "Camille", "Flores", "camille.flores@example.test", "09170000003"],
  ["72000000-0000-4000-8000-000000000004", "Daniel", "Ramos", "daniel.ramos@example.test", "09170000004"],
  ["72000000-0000-4000-8000-000000000005", "Erika", "Garcia", "erika.garcia@example.test", "09170000005"],
  ["72000000-0000-4000-8000-000000000006", "Frances", "Tan", "frances.tan@example.test", "09170000006"],
  ["72000000-0000-4000-8000-000000000007", "Gabriel", "Aquino", "gabriel.aquino@example.test", "09170000007"],
  ["72000000-0000-4000-8000-000000000008", "Hazel", "Villanueva", "hazel.villanueva@example.test", "09170000008"],
  ["72000000-0000-4000-8000-000000000009", "Isa", "Castillo", "isa.castillo@example.test", "09170000009"],
  ["72000000-0000-4000-8000-000000000010", "Joaquin", "Torres", "joaquin.torres@example.test", "09170000010"],
  ["72000000-0000-4000-8000-000000000011", "Kara", "Bautista", "kara.bautista@example.test", "09170000011"],
  ["72000000-0000-4000-8000-000000000012", "Luis", "Dela Cruz", "luis.delacruz@example.test", "09170000012"],
] as const;

const MOCK_STATIONS = [
  ["73000000-0000-4000-8000-000000000001", "Station One"],
  ["73000000-0000-4000-8000-000000000002", "Station Two"],
  ["73000000-0000-4000-8000-000000000003", "Station Three"],
] as const;

const MOCK_SALE_COUNT = 9;

type AdminClient = SupabaseClient;

function required(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required to seed the owner account.`);
  return value;
}

function isLocalUrl(value: string) {
  const hostname = new URL(value).hostname;
  return hostname === "127.0.0.1" || hostname === "localhost" || hostname === "::1";
}

async function listAuthUsers(admin: AdminClient) {
  const users: User[] = [];
  const perPage = 100;
  for (let page = 1; ; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    users.push(...data.users);
    if (data.users.length < perPage) return users;
  }
}

async function ensureAuthUser(
  admin: AdminClient,
  users: User[],
  email: string,
  password: string,
) {
  const existing = users.find((candidate) => candidate.email?.toLowerCase() === email);
  if (existing) {
    const { data, error } = await admin.auth.admin.updateUserById(existing.id, {
      password,
      email_confirm: true,
    });
    if (error) throw error;
    return data.user;
  }
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) throw error;
  users.push(data.user);
  return data.user;
}

function manilaDate(date: string, hour: number, minute = 0) {
  return new Date(
    `${date}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00+08:00`,
  );
}

function addDays(date: string, offset: number) {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + offset);
  return value.toISOString().slice(0, 10);
}

async function seedMockData(
  prisma: PrismaClient,
  admin: AdminClient,
  authUsers: User[],
  password: string,
  ownerId: string,
) {
  const mockUsers = await Promise.all(
    MOCK_STAFF.map((person) => ensureAuthUser(admin, authUsers, person.email, password)),
  );
  const staff = MOCK_STAFF.map((person, index) => ({ ...person, userId: mockUsers[index].id }));
  const piercers = staff.filter((person) => person.role === "piercer");
  const [{ today }] = await prisma.$queryRaw<Array<{ today: string }>>`
    select (now() at time zone 'Asia/Manila')::date::text as today
  `;
  const services = await prisma.services.findMany({
    where: { is_active: true },
    orderBy: { sort_order: "asc" },
  });
  const serviceByName = new Map(services.map((catalogService) => [catalogService.name, catalogService]));
  const service = (name: string) => {
    const found = serviceByName.get(name);
    if (!found) throw new Error(`The mock seed requires the catalog service ${name}.`);
    return found;
  };

  const bookingFixtures = [
    [0, 0, ["Lobe"], 0, 10, "confirmed", 0],
    [1, 1, ["Nostril"], 0, 10, "confirmed", 1],
    [2, 2, ["Conch"], 0, 11, "confirmed", 2],
    [3, 0, ["Helix"], 0, 13, "requested", 0],
    [4, 1, ["Septum"], 0, 15, "cancelled", 1],
    [5, 0, ["Double Lobe"], -1, 11, "completed", 0],
    [6, 1, ["Navel"], -2, 13, "completed", 1],
    [7, 2, ["Industrial"], -3, 15, "completed", 2],
    [8, 0, ["Curation / Earscape"], -7, 12, "completed", 0],
    [9, 1, ["Tragus", "Titanium Anodizing"], -14, 14, "completed", 1],
    [10, 2, ["Dermal"], -21, 16, "completed", 2],
    [11, 0, ["Flat"], -4, 10, "no_show", 0],
    [0, 1, ["Eyebrow"], -5, 12, "cancelled", 1],
    [1, 2, ["Bridge"], -6, 14, "rejected", 2],
    [2, 0, ["Rook"], 1, 10, "confirmed", 0],
    [3, 1, ["Lip Piercing"], 1, 12, "confirmed", 1],
    [4, 2, ["Auricle", "Ultrasonic Jewelry Cleaning"], 2, 14, "confirmed", 2],
    [5, 0, ["Bump Treatment"], 5, 16, "confirmed", 0],
  ] as const;

  await prisma.$transaction(async (tx) => {
    for (const person of staff) {
      await tx.staff_profiles.upsert({
        where: { user_id: person.userId },
        update: {
          display_name: person.displayName,
          role: person.role,
          active: true,
          color: person.color,
        },
        create: {
          user_id: person.userId,
          display_name: person.displayName,
          role: person.role,
          active: true,
          color: person.color,
        },
      });
    }
    await tx.service_staff.createMany({
      data: piercers.flatMap((person) =>
        services.map((catalogService) => ({
          service_id: catalogService.id,
          staff_id: person.userId,
        })),
      ),
      skipDuplicates: true,
    });
    await tx.staff_availability.createMany({
      data: piercers.flatMap((person) =>
        Array.from({ length: 7 }, (_, weekday) => ({
          staff_id: person.userId,
          weekday,
          starts_at: new Date("1970-01-01T10:00:00.000Z"),
          ends_at: new Date("1970-01-01T23:59:00.000Z"),
        })),
      ),
      skipDuplicates: true,
    });
    await tx.stations.createMany({
      data: MOCK_STATIONS.map(([id, name]) => ({ id, name, active: true })),
      skipDuplicates: true,
    });
    await tx.customers.createMany({
      data: MOCK_CUSTOMERS.map(([id, firstName, lastName, email, phone], index) => ({
        id,
        first_name: firstName,
        last_name: lastName,
        email,
        phone,
        notes: index % 4 === 0 ? "Mock client record for local development." : null,
      })),
      skipDuplicates: true,
    });

    const bookingRows = bookingFixtures.map((fixture, index) => {
      const [customerIndex, piercerIndex, names, dayOffset, hour, status, stationIndex] = fixture;
      const duration = names.reduce((sum, name) => sum + service(name).duration_minutes, 0);
      const startsAt = manilaDate(addDays(today, dayOffset), hour);
      return {
        id: `71000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
        reference: `MOCK-PC-${String(index + 1).padStart(3, "0")}`,
        customer_id: MOCK_CUSTOMERS[customerIndex][0],
        assigned_piercer_id: piercers[piercerIndex].userId,
        station_id: MOCK_STATIONS[stationIndex][0],
        status,
        starts_at: startsAt,
        ends_at: new Date(startsAt.getTime() + duration * 60_000),
        notes: index % 5 === 0 ? "Mock appointment for local development." : null,
        serviceNames: names,
      };
    });
    await tx.bookings.createMany({
      data: bookingRows.map(({ serviceNames: _serviceNames, ...booking }) => booking),
      skipDuplicates: true,
    });

    const bookingServiceRows = bookingRows.flatMap((booking, bookingIndex) =>
      booking.serviceNames.map((name, position) => {
        const catalogService = service(name);
        return {
          id: `71100000-0000-4000-8000-${String(bookingIndex * 10 + position + 1).padStart(12, "0")}`,
          booking_id: booking.id,
          service_id: catalogService.id,
          position: position + 1,
          name: catalogService.name,
          duration_minutes: catalogService.duration_minutes,
          price_cents: catalogService.price_cents,
          min_price_cents: catalogService.min_price_cents,
          max_price_cents: catalogService.max_price_cents,
          price_unit: catalogService.price_unit,
        };
      }),
    );
    await tx.booking_services.createMany({ data: bookingServiceRows, skipDuplicates: true });

    const completedBookings = bookingRows.filter((booking) => booking.status === "completed");
    const saleFixtures = [
      ...completedBookings.map((booking, index) => ({
        booking,
        customerId: booking.customer_id,
        serviceNames: booking.serviceNames,
        method: ["cash", "gcash", "maya", "card", "bank_transfer", "other"][index],
        createdAt: booking.ends_at,
      })),
      {
        booking: null,
        customerId: MOCK_CUSTOMERS[6][0],
        serviceNames: ["Lobe"] as readonly string[],
        method: "cash",
        createdAt: manilaDate(addDays(today, -1), 17),
      },
      {
        booking: null,
        customerId: MOCK_CUSTOMERS[7][0],
        serviceNames: ["Nostril"] as readonly string[],
        method: "gcash",
        createdAt: manilaDate(addDays(today, -8), 18),
      },
      {
        booking: null,
        customerId: null,
        serviceNames: ["Authentic No-Pull Disc"] as readonly string[],
        method: "card",
        createdAt: manilaDate(addDays(today, -15), 16),
      },
    ];
    const saleIds = saleFixtures.map(
      (_, index) => `74000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
    );
    const existingSales = new Set(
      (
        await tx.sales.findMany({
          where: { id: { in: saleIds } },
          select: { id: true },
        })
      ).map((sale) => sale.id),
    );

    for (const [saleIndex, fixture] of saleFixtures.entries()) {
      const saleId = saleIds[saleIndex];
      if (existingSales.has(saleId)) continue;
      await tx.sales.create({
        data: {
          id: saleId,
          reference: `MOCK-SALE-${String(saleIndex + 1).padStart(3, "0")}`,
          booking_id: fixture.booking?.id ?? null,
          customer_id: fixture.customerId,
          status: "draft",
          created_at: fixture.createdAt,
          updated_at: fixture.createdAt,
        },
      });

      let total = 0;
      for (const [itemIndex, name] of fixture.serviceNames.entries()) {
        const catalogService = service(name);
        const price =
          catalogService.price_cents ??
          Math.round(
            ((catalogService.min_price_cents ?? 0) + (catalogService.max_price_cents ?? 0)) / 2,
          );
        const bookingService = fixture.booking
          ? bookingServiceRows.find(
              (row) => row.booking_id === fixture.booking?.id && row.service_id === catalogService.id,
            )
          : null;
        total += price;
        await tx.sale_items.create({
          data: {
            id: `75000000-0000-4000-8000-${String(saleIndex * 10 + itemIndex + 1).padStart(12, "0")}`,
            sale_id: saleId,
            item_type: "service",
            source_id: catalogService.id,
            description: catalogService.name,
            quantity: 1,
            unit_price_cents: price,
            booking_service_id: bookingService?.id ?? null,
            min_price_cents: catalogService.min_price_cents,
            max_price_cents: catalogService.max_price_cents,
            created_at: fixture.createdAt,
          },
        });
      }
      await tx.payments.create({
        data: {
          id: `76000000-0000-4000-8000-${String(saleIndex + 1).padStart(12, "0")}`,
          sale_id: saleId,
          method: fixture.method as payment_method,
          amount_cents: total,
          reference: fixture.method === "cash" ? null : `MOCK-${saleIndex + 1}`,
          received_at: fixture.createdAt,
          received_by: ownerId,
        },
      });
      await tx.sales.update({
        where: { id: saleId },
        data: {
          status: "completed",
          completed_at: fixture.createdAt,
          completed_by: ownerId,
          updated_at: fixture.createdAt,
        },
      });
    }
  });

  const [verification] = await prisma.$queryRaw<
    Array<{
      staff_count: number;
      customer_count: number;
      booking_count: number;
      sale_count: number;
      invalid_booking_count: number;
      invalid_sale_count: number;
    }>
  >`
    select
      (select count(*)::int
         from public.staff_profiles sp
         join auth.users u on u.id = sp.user_id
        where u.email like '%.seed@piercingcorner.test') as staff_count,
      (select count(*)::int from public.customers where id::text like '72000000-%') as customer_count,
      (select count(*)::int from public.bookings where id::text like '71000000-%') as booking_count,
      (select count(*)::int from public.sales where id::text like '74000000-%') as sale_count,
      (select count(*)::int
         from public.bookings b
        where b.id::text like '71000000-%'
          and not exists (select 1 from public.booking_services bs where bs.booking_id = b.id))
        as invalid_booking_count,
      (select count(*)::int
         from public.sales s
        where s.id::text like '74000000-%'
          and (
            s.status <> 'completed'
            or s.total_cents <> coalesce((select sum(p.amount_cents) from public.payments p where p.sale_id = s.id), 0)
          )) as invalid_sale_count
  `;
  if (
    verification.staff_count !== staff.length ||
    verification.customer_count !== MOCK_CUSTOMERS.length ||
    verification.booking_count !== bookingFixtures.length ||
    verification.sale_count !== MOCK_SALE_COUNT ||
    verification.invalid_booking_count !== 0 ||
    verification.invalid_sale_count !== 0
  ) {
    throw new Error(`Mock seed verification failed: ${JSON.stringify(verification)}.`);
  }

  console.info(
    `Mock data ready: ${verification.staff_count} staff logins, ${verification.customer_count} customers, ${verification.booking_count} bookings, and ${verification.sale_count} completed sales.`,
  );
}

async function main() {
  const databaseUrl = process.env.DIRECT_URL?.trim() || required("DATABASE_URL");
  const supabaseUrl = required("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = required("SUPABASE_SERVICE_ROLE_KEY");
  const email = required("PRISMA_SEED_EMAIL").toLowerCase();
  const password = required("PRISMA_SEED_PASSWORD");
  const localTarget = isLocalUrl(supabaseUrl) && isLocalUrl(databaseUrl);

  if (password.length < 8) {
    throw new Error("PRISMA_SEED_PASSWORD must contain at least 8 characters.");
  }
  if (!localTarget && process.env.PRISMA_SEED_ALLOW_REMOTE !== "true") {
    throw new Error(
      "Remote Prisma seeding is blocked. Set PRISMA_SEED_ALLOW_REMOTE=true only after checking the target project.",
    );
  }
  if (localTarget && MOCK_STAFF.some((person) => person.email === email)) {
    throw new Error("PRISMA_SEED_EMAIL must differ from the reserved local mock staff emails.");
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: databaseUrl }),
  });
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });

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

    const authUsers = await listAuthUsers(admin);
    const owner = await ensureAuthUser(admin, authUsers, email, password);
    if (!existingOwner) {
      await prisma.$queryRaw`select public.bootstrap_first_owner(${email})`;
    }
    console.info(`Prisma seed ready: ${owner.email} is the Piercing Corner owner.`);

    if (localTarget) {
      await seedMockData(prisma, admin, authUsers, password, owner.id);
    } else {
      console.info("Mock operational data was skipped because the seed target is not local.");
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
