import { describe, expect, it } from "vitest";
import { MAX_PAGE_SIZE, pageMeta, parsePageQuery, safeSearchTerm } from "./pagination";

describe("workspace pagination", () => {
  it("uses bounded defaults and calculates a PostgREST range", () => {
    expect(parsePageQuery(new URL("http://local/api/customers"))).toMatchObject({ page: 1, pageSize: 25, from: 0, to: 24 });
    expect(parsePageQuery(new URL("http://local/api/customers?page=3&pageSize=10"))).toMatchObject({ page: 3, pageSize: 10, from: 20, to: 29 });
  });

  it("falls back when page inputs exceed the public contract", () => {
    expect(parsePageQuery(new URL(`http://local/api/sales?page=-2&pageSize=${MAX_PAGE_SIZE + 1}`))).toMatchObject({ page: 1, pageSize: 25 });
  });

  it("removes PostgREST expression punctuation from searches", () => {
    expect(safeSearchTerm("Ana%,_(), Cruz")).toBe("Ana Cruz");
  });

  it("reports at least one page for an empty result", () => {
    expect(pageMeta(1, 25, 0)).toEqual({ number: 1, size: 25, total: 0, totalPages: 1 });
    expect(pageMeta(2, 25, 76).totalPages).toBe(4);
  });
});
