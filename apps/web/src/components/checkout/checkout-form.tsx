"use client";

import {
  amountToMinimum,
  areaCheckoutSchema,
  cartSubtotal,
  fieldErrors,
  formatPrice,
  type LngLat,
  type Tables,
} from "@sarhad/core";
import { localized, type Locale } from "@sarhad/i18n";
import {
  Alert,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Checkbox,
  Field,
  Input,
  Textarea,
} from "@sarhad/ui";
import { Banknote, Check, CreditCard, LocateFixed, Tag, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState, useTransition } from "react";

import { placeOrder, quotePromo } from "@/app/[locale]/checkout/actions";
import { payOrder } from "@/app/[locale]/orders/actions";
import { useCart } from "@/components/cart/cart-provider";
import { useFreshCart } from "@/components/cart/use-fresh-cart";
import { PinMap } from "@/components/delivery/pin-map";
import { OrderStartCard } from "@/components/order-start/order-chip";
import { useOrderStart } from "@/components/order-start/order-start-provider";
import { Link, useRouter } from "@/i18n/navigation";

type CheckoutBranch = {
  id: string;
  slug: string;
  name_en: string;
  name_ar: string;
  accepts_delivery: boolean;
  accepts_pickup: boolean;
  open: boolean;
};

type Address = {
  area: string;
  block: string;
  street: string;
  avenue: string;
  building: string;
  floor: string;
  apartment: string;
  notes: string;
};

const EMPTY_ADDRESS: Address = {
  area: "",
  block: "",
  street: "",
  avenue: "",
  building: "",
  floor: "",
  apartment: "",
  notes: "",
};

export function CheckoutForm({
  branches,
  profile,
  addresses,
  providers,
}: {
  branches: CheckoutBranch[];
  profile: { name: string; phone: string };
  addresses: Tables<"customer_addresses">[];
  /** Active online payment options (cash is always offered). */
  providers: { id: string; name_en: string; name_ar: string }[];
}) {
  const t = useTranslations("checkout");
  const tv = useTranslations("validation");
  const tc = useTranslations("cart");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const { clear } = useCart();
  const { start } = useOrderStart();
  const { cart, ready, checked, removed } = useFreshCart();
  const branch = branches.find((b) => b.id === cart.branchId) ?? null;
  // The visitor's delivery area (or pickup branch) was chosen up front.
  const area = start?.type === "delivery" ? start.area : null;

  const [clientRef] = useState(() => crypto.randomUUID());
  const [name, setName] = useState(profile.name);
  const [phone, setPhone] = useState(profile.phone);
  const [notes, setNotes] = useState("");
  // Saved addresses in the chosen area only: the area decides the branch and fee.
  const sameArea = (a: { area: string }) =>
    !!area &&
    [area.name_en, area.name_ar].some(
      (n) => n.trim().toLowerCase() === a.area.trim().toLowerCase(),
    );
  const areaAddresses = addresses.filter(sameArea);
  const [savedId, setSavedId] = useState<string | null>(areaAddresses[0]?.id ?? null);
  const [address, setAddress] = useState<Address>(EMPTY_ADDRESS);
  const [pin, setPin] = useState<LngLat | null>(null);
  const [saveAddress, setSaveAddress] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const [providerId, setProviderId] = useState<string | null>(null);
  const [promoInput, setPromoInput] = useState("");
  const [promo, setPromo] = useState<{
    code: string;
    nameEn: string;
    nameAr: string;
    discountFils: number;
  } | null>(null);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [checkingPromo, startPromo] = useTransition();
  const [pending, startTransition] = useTransition();

  const effectiveType = start?.type ?? null;
  const saved = areaAddresses.find((a) => a.id === savedId) ?? null;

  // A promo's discount depends on the subtotal and delivery fee: check it again when they change.
  const quoteKey = `${cart.branchId}:${cartSubtotal(cart)}:${area ? area.fee_fils : 0}`;
  const lastQuoteKey = useRef(quoteKey);
  useEffect(() => {
    if (lastQuoteKey.current === quoteKey) return;
    lastQuoteKey.current = quoteKey;
    if (!promo || !cart.branchId) return;
    const [, sub, f] = quoteKey.split(":");
    quotePromo({
      code: promo.code,
      branchId: cart.branchId,
      subtotalFils: Number(sub),
      deliveryFeeFils: Number(f),
    }).then((res) => {
      if (res.ok) setPromo(res);
      else {
        setPromo(null);
        setPromoError(res.error);
      }
    });
  }, [quoteKey, promo, cart.branchId]);

  if (!ready || !checked) return <p className="text-muted-foreground">…</p>;

  if (!start) {
    return (
      <div className="grid justify-items-start gap-4 rounded-[1.25rem] border border-border bg-card p-6">
        <OrderStartCard />
        <p className="text-muted-foreground">{t("chooseFirst")}</p>
      </div>
    );
  }

  if (cart.lines.length === 0 || !branch) {
    return (
      <Card>
        <CardContent className="grid justify-items-start gap-4 pt-6">
          {removed > 0 ? <Alert>{tc("removedItems", { count: removed })}</Alert> : null}
          <p className="text-muted-foreground">{tc("empty")}</p>
          <Button asChild>
            <Link href="/menu">{tc("browseMenu")}</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const branchName = localized(branch, "name", locale);
  const subtotal = cartSubtotal(cart);
  const fee = area ? area.fee_fils : 0;
  const shortBy = area ? amountToMinimum(subtotal, area.min_order_fils) : 0;
  const discount = promo ? Math.min(promo.discountFils, subtotal + fee) : 0;
  const total = subtotal + fee - discount;
  const canSubmit = branch.open && !pending && shortBy === 0;

  const err = (path: string) =>
    errors[path] ? tv(errors[path] as Parameters<typeof tv>[0]) : undefined;
  const clearError = (...paths: string[]) =>
    setErrors((e) => {
      if (!paths.some((p) => p in e)) return e;
      const next = { ...e };
      for (const p of paths) delete next[p];
      return next;
    });
  const setA =
    (k: keyof Address) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setAddress((p) => ({ ...p, [k]: e.target.value }));
      clearError(`address.${k}`);
    };
  const movePin = (p: LngLat) => {
    setPin(p);
    clearError("address.latitude", "address.longitude");
  };

  function locate() {
    if (!("geolocation" in navigator)) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        movePin([pos.coords.longitude, pos.coords.latitude]);
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  function applyPromo(code: string) {
    setPromoError(null);
    startPromo(async () => {
      const res = await quotePromo({
        code,
        branchId: branch!.id,
        subtotalFils: subtotal,
        deliveryFeeFils: fee,
      });
      if (res.ok) {
        setPromo(res);
        setPromoInput(res.code);
      } else {
        setPromo(null);
        setPromoError(res.error);
      }
    });
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setServerError(null);
    const addr = saved
      ? {
          area: area?.name_en ?? saved.area,
          block: saved.block,
          street: saved.street,
          avenue: saved.avenue ?? undefined,
          building: saved.building,
          floor: saved.floor ?? undefined,
          apartment: saved.apartment ?? undefined,
          notes: saved.notes ?? undefined,
          latitude: saved.latitude,
          longitude: saved.longitude,
        }
      : { ...address, area: area?.name_en ?? "", latitude: pin?.[1], longitude: pin?.[0] };
    const checkout = area
      ? { type: "delivery" as const, areaId: area.area_id, name, phone, notes, address: addr }
      : { type: "pickup" as const, name, phone, notes };
    const parsed = areaCheckoutSchema.safeParse(checkout);
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    setErrors({});
    startTransition(async () => {
      const res = await placeOrder({
        clientRef,
        cart,
        checkout,
        saveAddress: !saved && saveAddress && pin !== null,
        promoCode: promo?.code ?? null,
        providerId,
      });
      if (res.ok) {
        clear();
        if (res.online) {
          // Off to the payment page; the order page offers "Pay now" if this fails.
          const pay = await payOrder(res.id);
          if (pay?.error) router.push(`/orders/${res.id}?payment=failed`);
          return;
        }
        router.push(`/orders/${res.id}?placed=1`);
        return;
      }
      if (res.error?.startsWith("promo_")) setPromo(null);
      if (res.fieldErrors) setErrors(res.fieldErrors);
      setServerError(res.error ?? null);
    });
  }

  return (
    <form onSubmit={submit} noValidate className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <div className="grid gap-6">
        {!branch.open ? (
          <Alert variant="destructive">{t("branchClosedNow", { branch: branchName })}</Alert>
        ) : null}
        {removed > 0 ? <Alert>{tc("removedItems", { count: removed })}</Alert> : null}

        <OrderStartCard />

        {effectiveType === "delivery" ? (
          <Card>
            <CardHeader>
              <CardTitle>{t("address")}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              {areaAddresses.length > 0 ? (
                <fieldset className="grid gap-2">
                  <legend className="mb-1 text-sm font-medium">{t("savedAddresses")}</legend>
                  {areaAddresses.map((a) => (
                    <label
                      key={a.id}
                      className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 has-[:checked]:border-primary has-[:checked]:bg-primary/10"
                    >
                      <input
                        type="radio"
                        name="address"
                        checked={savedId === a.id}
                        onChange={() => setSavedId(a.id)}
                        className="mt-1 accent-[var(--brand-orange)]"
                      />
                      <span className="text-sm">
                        {a.area}, {t("block")} {a.block}, {t("street")} {a.street}, {t("building")}{" "}
                        {a.building}
                      </span>
                    </label>
                  ))}
                  <label className="flex cursor-pointer items-center gap-3 rounded-lg border p-3 has-[:checked]:border-primary has-[:checked]:bg-primary/10">
                    <input
                      type="radio"
                      name="address"
                      checked={savedId === null}
                      onChange={() => setSavedId(null)}
                      className="accent-[var(--brand-orange)]"
                    />
                    <span className="text-sm font-medium">{t("newAddress")}</span>
                  </label>
                </fieldset>
              ) : null}

              {!saved ? (
                <>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field id="a-area" label={t("areaLocked")} className="sm:col-span-2">
                      <Input
                        id="a-area"
                        value={
                          area
                            ? `${localized(area, "city", locale)} · ${localized(area, "name", locale)}`
                            : ""
                        }
                        readOnly
                        className="text-muted-foreground"
                      />
                    </Field>
                    <Field id="a-block" label={t("block")} error={err("address.block")}>
                      <Input id="a-block" value={address.block} onChange={setA("block")} />
                    </Field>
                    <Field id="a-street" label={t("street")} error={err("address.street")}>
                      <Input id="a-street" value={address.street} onChange={setA("street")} />
                    </Field>
                    <Field id="a-avenue" label={t("avenue")}>
                      <Input id="a-avenue" value={address.avenue} onChange={setA("avenue")} />
                    </Field>
                    <Field id="a-building" label={t("building")} error={err("address.building")}>
                      <Input id="a-building" value={address.building} onChange={setA("building")} />
                    </Field>
                    <div className="grid grid-cols-2 gap-4">
                      <Field id="a-floor" label={t("floor")}>
                        <Input id="a-floor" value={address.floor} onChange={setA("floor")} />
                      </Field>
                      <Field id="a-apartment" label={t("apartment")}>
                        <Input
                          id="a-apartment"
                          value={address.apartment}
                          onChange={setA("apartment")}
                        />
                      </Field>
                    </div>
                    <Field id="a-notes" label={t("addressNotes")} className="sm:col-span-2">
                      <Textarea
                        id="a-notes"
                        rows={2}
                        value={address.notes}
                        onChange={setA("notes")}
                      />
                    </Field>
                  </div>
                  <div className="grid gap-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-medium">{t("pinOptional")}</p>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={locate}
                        disabled={locating}
                      >
                        <LocateFixed /> {t("useMyLocation")}
                      </Button>
                    </div>
                    <p className="text-sm text-muted-foreground">{t("pinOptionalHint")}</p>
                    <PinMap value={pin} onChange={movePin} className="h-[240px]" />
                    {err("address.latitude") ? (
                      <p className="text-sm text-destructive">{err("address.latitude")}</p>
                    ) : null}
                  </div>
                  <Checkbox
                    label={t("saveAddress")}
                    checked={saveAddress}
                    onChange={(e) => setSaveAddress(e.target.checked)}
                  />
                </>
              ) : null}

              {area ? (
                <p
                  className="flex items-center gap-2 rounded-xl bg-success/10 px-3 py-2.5 text-sm font-semibold text-success"
                  data-testid="zone-status"
                >
                  <Check className="size-4 shrink-0" aria-hidden />
                  {t("areaZoneInfo", {
                    fee: area.fee_fils === 0 ? t("free") : formatPrice(area.fee_fils, locale),
                    minutes: area.eta_minutes,
                  })}
                </p>
              ) : null}
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle>{t("contact")}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Field id="c-name" label={t("name")} error={err("name")}>
              <Input
                id="c-name"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  clearError("name");
                }}
                autoComplete="name"
              />
            </Field>
            <Field id="c-phone" label={t("phone")} error={err("phone")}>
              <Input
                id="c-phone"
                type="tel"
                dir="ltr"
                inputMode="tel"
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value);
                  clearError("phone");
                }}
                autoComplete="tel"
              />
            </Field>
            <Field id="c-notes" label={t("orderNotes")} className="sm:col-span-2">
              <Textarea
                id="c-notes"
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("payment")}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2">
            <fieldset className="grid gap-2">
              <legend className="sr-only">{t("payment")}</legend>
              {[
                { id: null, label: t("cash"), Icon: Banknote },
                ...providers.map((p) => ({
                  id: p.id as string | null,
                  label: localized(p, "name", locale),
                  Icon: CreditCard,
                })),
              ].map((o) => (
                <label
                  key={o.id ?? "cash"}
                  className="flex cursor-pointer items-center gap-3 rounded-lg border p-3 font-medium has-[:checked]:border-primary has-[:checked]:bg-primary/10"
                >
                  <input
                    type="radio"
                    name="payment"
                    checked={providerId === o.id}
                    onChange={() => setProviderId(o.id)}
                    className="accent-[var(--brand-orange)]"
                  />
                  <o.Icon className="size-5 text-primary" aria-hidden /> {o.label}
                </label>
              ))}
            </fieldset>
            {providerId ? (
              <p className="text-sm text-muted-foreground">{t("payOnlineHint")}</p>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <div>
        <Card className="lg:sticky lg:top-20">
          <CardHeader>
            <CardTitle>{t("summary")}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm">
            <ul className="grid gap-2">
              {cart.lines.map((l) => (
                <li key={l.key} className="flex justify-between gap-2">
                  <span>
                    {l.quantity} × {locale === "ar" ? l.nameAr : l.nameEn}
                    {l.optionNames.length ? (
                      <span className="block text-xs text-muted-foreground">
                        {l.optionNames.map((o) => (locale === "ar" ? o.ar : o.en)).join("، ")}
                      </span>
                    ) : null}
                  </span>
                  <span className="tabular-nums">
                    {formatPrice(l.unitPriceFils * l.quantity, locale)}
                  </span>
                </li>
              ))}
            </ul>
            <div className="grid gap-1 border-t pt-3">
              <div className="flex justify-between">
                <span>{t("subtotal")}</span>
                <span className="tabular-nums">{formatPrice(subtotal, locale)}</span>
              </div>
              {effectiveType === "delivery" ? (
                <div className="flex justify-between">
                  <span>{t("deliveryFee")}</span>
                  <span className="tabular-nums">
                    {fee === 0 ? t("free") : formatPrice(fee, locale)}
                  </span>
                </div>
              ) : null}
              {promo ? (
                <div className="flex justify-between text-success" data-testid="discount">
                  <span>
                    {t("discount")} ({promo.code})
                  </span>
                  <span className="tabular-nums">−{formatPrice(discount, locale)}</span>
                </div>
              ) : null}
              <div className="flex justify-between pt-1 text-base font-bold">
                <span>{t("total")}</span>
                <span className="tabular-nums" data-testid="checkout-total">
                  {formatPrice(total, locale)}
                </span>
              </div>
            </div>
            <div className="grid gap-2 border-t pt-3">
              {promo ? (
                <div className="flex items-center justify-between gap-2 rounded-xl border border-success/40 bg-success/10 p-2 text-success">
                  <span className="flex items-center gap-2">
                    <Tag className="size-4" aria-hidden />
                    {t("promoApplied", {
                      name: locale === "ar" ? promo.nameAr : promo.nameEn,
                    })}
                  </span>
                  <button
                    type="button"
                    className="rounded-full p-1 hover:bg-success/20"
                    aria-label={t("removePromo")}
                    onClick={() => {
                      setPromo(null);
                      setPromoInput("");
                    }}
                  >
                    <X className="size-4" />
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Input
                    aria-label={t("promoCode")}
                    placeholder={t("promoCode")}
                    value={promoInput}
                    dir="ltr"
                    className="uppercase"
                    data-testid="promo-input"
                    onChange={(e) => {
                      setPromoInput(e.target.value);
                      setPromoError(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        if (promoInput.trim()) applyPromo(promoInput);
                      }
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    disabled={!promoInput.trim() || checkingPromo}
                    onClick={() => applyPromo(promoInput)}
                  >
                    {t("applyPromo")}
                  </Button>
                </div>
              )}
              {promoError ? (
                <p className="text-sm text-destructive" role="alert">
                  {t(`errors.${promoError}` as Parameters<typeof t>[0])}
                </p>
              ) : null}
            </div>
            {shortBy > 0 ? (
              <p className="text-sm text-destructive">
                {t("minOrderLeft", { amount: formatPrice(shortBy, locale) })}
              </p>
            ) : null}
            {serverError ? (
              <Alert variant="destructive">
                {t(`errors.${serverError}` as Parameters<typeof t>[0])}
              </Alert>
            ) : null}
            <button
              type="submit"
              disabled={!canSubmit}
              data-testid="place-order"
              className="btn-brand h-14 px-4 text-base disabled:opacity-40"
            >
              {pending
                ? t("placing")
                : providerId
                  ? t("placeAndPay", { total: formatPrice(total, locale) })
                  : t("placeOrder", { total: formatPrice(total, locale) })}
            </button>
          </CardContent>
        </Card>
      </div>
    </form>
  );
}
