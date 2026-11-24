import { useTranslations } from "next-intl";

/** Labels for formatAddress(), from the checkout wording. */
export function useAddressLabels() {
  const tc = useTranslations("checkout");
  return {
    block: tc("block"),
    street: tc("street"),
    avenue: tc("avenue"),
    building: tc("building"),
    floor: tc("floor"),
    apartment: tc("apartment"),
  };
}
