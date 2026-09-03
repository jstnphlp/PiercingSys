import { formatPhp, type PaymentMethod } from "./domain";

const paymentMethodLabels: Record<PaymentMethod, string> = {
  cash: "Cash",
  gcash: "GCash",
  maya: "Maya",
  bank_transfer: "Bank transfer",
  card: "Card",
  other: "Other",
};

export function formatPaymentMethod(method: PaymentMethod) {
  return paymentMethodLabels[method];
}

export function formatPaymentMethods(methods: PaymentMethod[]) {
  return methods.map(formatPaymentMethod).join(", ") || "—";
}

export function formatSaleItems(
  items: Array<{ description: string; unitPriceCents: number | null }>,
) {
  return items
    .map(
      (item) =>
        `${item.description} · ${item.unitPriceCents === null ? "Pricing required" : formatPhp(item.unitPriceCents)}`,
    )
    .join(", ");
}
