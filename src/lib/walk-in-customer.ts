const walkInEmailDomain = "@piercingcorner.local";
const walkInPhonePrefix = "walk-in-";

export function walkInCustomerFields(name: string, id: string) {
  return {
    id,
    first_name: name.trim(),
    last_name: "",
    email: `${walkInPhonePrefix}${id}${walkInEmailDomain}`,
    phone: `${walkInPhonePrefix}${id}`,
    notes: "Walk-in client created from a sale.",
  };
}

export function customerDisplayName(firstName: unknown, lastName: unknown) {
  return `${String(firstName ?? "")} ${String(lastName ?? "")}`.trim();
}

export function customerDisplayContact(email: string, phone: string) {
  const isWalkIn = email.endsWith(walkInEmailDomain) && phone.startsWith(walkInPhonePrefix);
  return isWalkIn ? { email: "", phone: "" } : { email, phone };
}
