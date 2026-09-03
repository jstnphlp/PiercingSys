import "server-only";
import { revalidateTag } from "next/cache";

export function invalidateStaffReferenceData() {
  revalidateTag("staff-reference", { expire: 0 });
}

export function invalidateCatalogAndStaffReferenceData() {
  revalidateTag("public-catalog", { expire: 0 });
  invalidateStaffReferenceData();
}
