"use client";

import {
  amountToMinimum,
  cartSubtotal,
  checkoutSchema,
  fieldErrors,
  formatPrice,
  type DeliveryMatch,
  type LngLat,
  type OrderType,
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
  cn,
  Field,
  Input,
  Textarea,
} from "@sarhad/ui";
import { Banknote, Bike, LocateFixed, Store } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState, useTransition } from "react";

import { placeOrder } from "@/app/[locale]/checkout/actions";
import { checkDelivery } from "@/app/[locale]/delivery/actions";
import { useCart } from "@/components/cart/cart-provider";
import { useFreshCart } from "@/components/cart/use-fresh-cart";
import { PinMap } from "@/components/delivery/pin-map";
import { Link, useRouter } from "@/i18n/navigation";
import type { PublicZone } from "@/lib/delivery";

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

type ZoneCheck =
  | { status: "none" }
  | { status: "checking" }
  | { status: "ok"; match: DeliveryMatch }
  | { status: "other"; match: DeliveryMatch }
  | { status: "outside" };

export function CheckoutForm({
  branches,
  zones,
  profile,
  addresses,
}: {
  branches: CheckoutBranch[];
  zones: PublicZone[];
  profile: { name: string; phone: string };
  addresses: Tables<"customer_addresses">[];
}) {
  const t = useTranslations("checkout");
  const tv = useTranslations("validation");
  const tc = useTranslations("cart");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const { clear } = useCart();
  const { cart, ready, checked, removed } = useFreshCart();
  const branch = branches.find((b) => b.id === cart.branchId) ?? null;

  const [clientRef] = useState(() => crypto.randomUUID());
  const [type, setType] = useState<OrderType>("delivery");
  const [name, setName] = useState(profile.name);
  const [phone, setPhone] = useState(profile.phone);
  const [notes, setNotes] = useState("");
  const [savedId, setSavedId] = useState<string | null>(addresses[0]?.id ?? null);
  const [address, setAddress] = useState<Address>(EMPTY_ADDRESS);
  const [pin, setPin] = useState<LngLat | null>(null);
  const [saveAddress, setSaveAddress] = useState(true);
  const [zone, setZone] = useState<ZoneCheck>({ status: "none" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const [pending, startTransition] = useTransition();

  // Delivery or pickup, whichever the branch offers.
  const effectiveType: OrderType =
    branch && !branch.accepts_delivery
      ? "pickup"
      : branch && !branch.accepts_pickup
        ? "delivery"
        : type;

  const saved = addresses.find((a) => a.id === savedId) ?? null;
  const point: LngLat | null = saved ? [saved.longitude, saved.latitude] : pin;

  // Check the delivery area whenever the pin moves.
  const pointKey = point ? point.join(",") : "";
  useEffect(() => {
    if (!point || effectiveType !== "delivery" || !branch) return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setZone({ status: "checking" });
    checkDelivery({ lat: point[1], lng: point[0] }).then((res) => {
      if (cancelled) return;
      if (!res.ok || res.matches.length === 0) return setZone({ status: "outside" });
      const mine = res.matches.find((m) => m.branch_id === branch.id);
      setZone(mine ? { status: "ok", match: mine } : { status: "other", match: res.matches[0]! });
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pointKey, effectiveType, branch?.id]);

  if (!ready || !checked) return <p className="text-muted-foreground">…</p>;

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
  const fee = effectiveType === "delivery" && zone.status === "ok" ? zone.match.fee_fils : 0;
  const shortBy =
    effectiveType === "delivery" && zone.status === "ok"
      ? amountToMinimum(subtotal, zone.match.min_order_fils)
      : 0;
  const total = subtotal + fee;
  const canSubmit =
    branch.open &&
    !pending &&
    (effectiveType === "pickup" || !point || (zone.status === "ok" && shortBy === 0));

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

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setServerError(null);
    const addr = saved
      ? {
          area: saved.area,
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
      : { ...address, latitude: pin?.[1], longitude: pin?.[0] };
    const checkout =
      effectiveType === "delivery"
        ? { type: "delivery" as const, name, phone, notes, address: addr }
        : { type: "pickup" as const, name, phone, notes };
    const parsed = checkoutSchema.safeParse(checkout);
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
        saveAddress: !saved && saveAddress,
      });
      if (res.ok) {
        clear();
        router.push(`/orders/${res.id}?placed=1`);
        return;
      }
      if (res.fieldErrors) setErrors(res.fieldErrors);
      setServerError(res.error ?? null);
    });
  }

  const typeButton = (value: OrderType, label: string, Icon: typeof Bike, enabled: boolean) => (
    <button
      type="button"
      disabled={!enabled}
      onClick={() => setType(value)}
      aria-pressed={effectiveType === value}
      className={cn(
        "flex flex-1 items-center justify-center gap-2 rounded-lg border px-4 py-3 font-medium disabled:opacity-40",
        effectiveType === value ? "border-primary bg-secondary text-primary" : "hover:bg-muted",
      )}
    >
      <Icon className="size-5" aria-hidden /> {label}
    </button>
  );

  return (
    <form onSubmit={submit} noValidate className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <div className="grid gap-6">
        {!branch.open ? (
          <Alert variant="destructive">{t("branchClosedNow", { branch: branchName })}</Alert>
        ) : null}
        {removed > 0 ? <Alert>{tc("removedItems", { count: removed })}</Alert> : null}

        <Card>
          <CardHeader>
            <CardTitle>{t("howToGet")}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            <div className="flex gap-3">
              {typeButton("delivery", t("delivery"), Bike, branch.accepts_delivery)}
              {typeButton("pickup", t("pickup"), Store, branch.accepts_pickup)}
            </div>
            {effectiveType === "pickup" ? (
              <p className="text-sm text-muted-foreground">
                {t("pickupFrom", { branch: branchName })}
              </p>
            ) : null}
          </CardContent>
        </Card>

        {effectiveType === "delivery" ? (
          <Card>
            <CardHeader>
              <CardTitle>{t("address")}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              {addresses.length > 0 ? (
                <fieldset className="grid gap-2">
                  <legend className="mb-1 text-sm font-medium">{t("savedAddresses")}</legend>
                  {addresses.map((a) => (
                    <label
                      key={a.id}
                      className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 has-[:checked]:border-primary has-[:checked]:bg-secondary"
                    >
                      <input
                        type="radio"
                        name="address"
                        checked={savedId === a.id}
                        onChange={() => setSavedId(a.id)}
                        className="mt-1 accent-[var(--color-primary)]"
                      />
                      <span className="text-sm">
                        {a.area}, {t("block")} {a.block}, {t("street")} {a.street}, {t("building")}{" "}
                        {a.building}
                      </span>
                    </label>
                  ))}
                  <label className="flex cursor-pointer items-center gap-3 rounded-lg border p-3 has-[:checked]:border-primary has-[:checked]:bg-secondary">
                    <input
                      type="radio"
                      name="address"
                      checked={savedId === null}
                      onChange={() => setSavedId(null)}
                      className="accent-[var(--color-primary)]"
                    />
                    <span className="text-sm font-medium">{t("newAddress")}</span>
                  </label>
                </fieldset>
              ) : null}

              {!saved ? (
                <>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field id="a-area" label={t("area")} error={err("address.area")}>
                      <Input
                        id="a-area"
                        value={address.area}
                        onChange={setA("area")}
                        autoComplete="address-level2"
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
                      <p className="font-medium">{t("pinTitle")}</p>
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
                    <p className="text-sm text-muted-foreground">{t("pinHint")}</p>
                    <PinMap
                      value={pin}
                      onChange={movePin}
                      zones={zones.filter((z) => z.branch_id === branch.id)}
                    />
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

              <div aria-live="polite" data-testid="zone-status">
                {zone.status === "ok" ? (
                  <p className="text-sm font-medium text-emerald-700">
                    {t("zoneOk", {
                      zone: locale === "ar" ? zone.match.zone_name_ar : zone.match.zone_name_en,
                      minutes: zone.match.eta_minutes,
                    })}
                  </p>
                ) : zone.status === "outside" ? (
                  <p className="text-sm font-medium text-destructive">{t("zoneOutside")}</p>
                ) : zone.status === "other" ? (
                  <p className="text-sm font-medium text-destructive">
                    {t("zoneOtherBranch", {
                      branch:
                        locale === "ar" ? zone.match.branch_name_ar : zone.match.branch_name_en,
                    })}
                  </p>
                ) : null}
              </div>
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
          <CardContent>
            <p className="flex items-center gap-3 rounded-lg border border-primary bg-secondary p-3 font-medium">
              <Banknote className="size-5 text-primary" aria-hidden /> {t("cash")}
            </p>
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
                    {zone.status === "ok"
                      ? fee === 0
                        ? t("free")
                        : formatPrice(fee, locale)
                      : "-"}
                  </span>
                </div>
              ) : null}
              <div className="flex justify-between pt-1 text-base font-bold">
                <span>{t("total")}</span>
                <span className="tabular-nums" data-testid="checkout-total">
                  {formatPrice(total, locale)}
                </span>
              </div>
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
            <Button type="submit" size="lg" disabled={!canSubmit} data-testid="place-order">
              {pending ? t("placing") : t("placeOrder", { total: formatPrice(total, locale) })}
            </Button>
          </CardContent>
        </Card>
      </div>
    </form>
  );
}
