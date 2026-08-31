import { vi } from "vitest";

export type QueryResult = {
  data: unknown;
  error: { message: string; code?: string } | null;
  count?: number | null;
};

export type QueryBuilder = {
  select: (...args: unknown[]) => QueryBuilder;
  insert: (...args: unknown[]) => QueryBuilder;
  update: (...args: unknown[]) => QueryBuilder;
  delete: (...args: unknown[]) => QueryBuilder;
  upsert: (...args: unknown[]) => QueryBuilder;
  eq: (...args: unknown[]) => QueryBuilder;
  neq: (...args: unknown[]) => QueryBuilder;
  in: (...args: unknown[]) => QueryBuilder;
  gte: (...args: unknown[]) => QueryBuilder;
  gt: (...args: unknown[]) => QueryBuilder;
  lte: (...args: unknown[]) => QueryBuilder;
  lt: (...args: unknown[]) => QueryBuilder;
  not: (...args: unknown[]) => QueryBuilder;
  order: (...args: unknown[]) => QueryBuilder;
  limit: (...args: unknown[]) => QueryBuilder;
  or: (...args: unknown[]) => QueryBuilder;
  is: (...args: unknown[]) => QueryBuilder;
  contains: (...args: unknown[]) => QueryBuilder;
  filter: (...args: unknown[]) => QueryBuilder;
  range: (...args: unknown[]) => QueryBuilder;
  single: () => Promise<QueryResult>;
  maybeSingle: () => Promise<QueryResult>;
} & PromiseLike<QueryResult>;

export function createQuery(result: QueryResult = { data: null, error: null }): QueryBuilder {
  const query = {} as QueryBuilder;
  const self = () => query;
  query.select = vi.fn(self);
  query.insert = vi.fn(self);
  query.update = vi.fn(self);
  query.delete = vi.fn(self);
  query.upsert = vi.fn(self);
  query.eq = vi.fn(self);
  query.neq = vi.fn(self);
  query.in = vi.fn(self);
  query.gte = vi.fn(self);
  query.gt = vi.fn(self);
  query.lte = vi.fn(self);
  query.lt = vi.fn(self);
  query.not = vi.fn(self);
  query.order = vi.fn(self);
  query.limit = vi.fn(self);
  query.or = vi.fn(self);
  query.is = vi.fn(self);
  query.contains = vi.fn(self);
  query.filter = vi.fn(self);
  query.range = vi.fn(self);
  query.single = vi.fn(async () => result);
  query.maybeSingle = vi.fn(async () => result);
  query.then = (onfulfilled, onrejected) => Promise.resolve(result).then(onfulfilled, onrejected);
  return query;
}

export function fromTables(tables: Record<string, QueryResult>) {
  return vi.fn((table: string) => createQuery(tables[table] ?? { data: null, error: null }));
}

export const IDS = {
  service: "20000000-0000-4000-8000-000000000001",
  service2: "20000000-0000-4000-8000-000000000002",
  piercer: "10000000-0000-4000-8000-000000000002",
  owner: "10000000-0000-4000-8000-000000000001",
  manager: "10000000-0000-4000-8000-000000000004",
  customer: "30000000-0000-4000-8000-000000000001",
  booking: "50000000-0000-4000-8000-000000000001",
  sale: "40000000-0000-4000-8000-000000000001",
  item: "70000000-0000-4000-8000-000000000001",
  station: "60000000-0000-4000-8000-000000000001",
  delivery: "80000000-0000-4000-8000-000000000001",
};

export const sessions = {
  owner: {
    userId: IDS.owner,
    email: "owner@example.com",
    displayName: "Owner",
    role: "owner" as const,
  },
  manager: {
    userId: IDS.manager,
    email: "manager@example.com",
    displayName: "Manager",
    role: "manager" as const,
  },
  piercer: {
    userId: IDS.piercer,
    email: "piercer@example.com",
    displayName: "Piercer One",
    role: "piercer" as const,
  },
};
