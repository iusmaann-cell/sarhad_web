/**
 * Restaurant contact details shown when a customer's area is not listed.
 * PLACEHOLDERS: the owner has not supplied these yet. Set them with the
 * NEXT_PUBLIC_CONTACT_* environment variables (or edit the fallbacks here).
 */
export const CONTACT = {
  phone: process.env.NEXT_PUBLIC_CONTACT_PHONE || "+965 0000 0000",
  whatsapp: process.env.NEXT_PUBLIC_CONTACT_WHATSAPP || "+965 0000 0000",
  email: process.env.NEXT_PUBLIC_CONTACT_EMAIL || "hello@example.com",
};

export const telHref = (n: string) => `tel:${n.replace(/[^\d+]/g, "")}`;
export const whatsappHref = (n: string) => `https://wa.me/${n.replace(/\D/g, "")}`;
