import { z } from "zod";

export const DEFAULT_PAGE_SIZE = 25;
export const MAX_PAGE_SIZE = 50;

const querySchema = z.object({
  q: z.string().trim().max(80).catch(""),
  page: z.coerce.number().int().min(1).catch(1),
  pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).catch(DEFAULT_PAGE_SIZE),
});

export type PageMeta = {
  number: number;
  size: number;
  total: number;
  totalPages: number;
};

export function parsePageQuery(url: URL) {
  const parsed = querySchema.parse({
    q: url.searchParams.get("q") ?? "",
    page: url.searchParams.get("page") ?? 1,
    pageSize: url.searchParams.get("pageSize") ?? DEFAULT_PAGE_SIZE,
  });
  return {
    ...parsed,
    from: (parsed.page - 1) * parsed.pageSize,
    to: parsed.page * parsed.pageSize - 1,
  };
}

export function pageMeta(page: number, size: number, total: number): PageMeta {
  return {
    number: page,
    size,
    total,
    totalPages: Math.max(1, Math.ceil(total / size)),
  };
}

// PostgREST filter expressions use punctuation as syntax. Treat those
// characters as spaces so user input cannot change the generated expression.
export function safeSearchTerm(value: string) {
  return value.replace(/[%,()_]/g, " ").replace(/\s+/g, " ").trim();
}
