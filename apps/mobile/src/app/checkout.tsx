import {
  amountToMinimum,
  cartSubtotal,
  cartToOrderItems,
  checkoutSchema,
  fieldErrors,
  formatPrice,
  normalizePromoCode,
  orderErrorCode,
  type DeliveryMatch,
  type OrderType,
  type Tables,
} from "@sarhad/core";
import { localized } from "@sarhad/i18n";
import * as Crypto from "expo-crypto";
import * as Location from "expo-location";
import { Redirect, router } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";

import { AppText, Button, Card, Notice, Screen, TextField, Title } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { useCart } from "@/lib/cart";
import { useFreshCart } from "@/lib/fresh-cart";
import { loadPaymentOptions, payOnline, type PaymentOption } from "@/lib/payments";
import { useI18n, type MessageKey } from "@/lib/i18n";
import { supabase } from "@/lib/supabase";
import { spacing, useTheme } from "@/lib/theme";

type Address = Pick<Tables<"customer_addresses">, "area" | "block" | "street" | "building"> & {
  avenue: string;
  floor: string;
  apartment: string;
  notes: string;
};

const EMPTY: Address = {
  area: "",
  block: "",
  street: "",
  avenue: "",
  building: "",
  floor: "",
  apartment: "",
  notes: "",
};

type Zone =
  { status: "none" | "checking" | "outside" } | { status: "ok" | "other"; match: DeliveryMatch };

export default function CheckoutScreen() {
  const { t, locale } = useI18n();
  const theme = useTheme();
  const { session, loading } = useAuth();
  const { clear } = useCart();
  const { cart, branch, checked } = useFreshCart();
  const [clientRef] = useState(() => Crypto.randomUUID());
  const [type, setType] = useState<OrderType>("delivery");
  const [saved, setSaved] = useState<Tables<"customer_addresses">[]>([]);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [address, setAddress] = useState<Address>(EMPTY);
  const [point, setPoint] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationDenied, setLocationDenied] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [zone, setZone] = useState<Zone>({ status: "none" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [placing, setPlacing] = useState(false);
  const [options, setOptions] = useState<PaymentOption[]>([]);
  const [providerId, setProviderId] = useState<string | null>(null);
  const [promoInput, setPromoInput] = useState("");
  const [promo, setPromo] = useState<{ code: string; name: string; discount: number } | null>(null);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [checkingPromo, setCheckingPromo] = useState(false);

  useEffect(() => {
    loadPaymentOptions().then(setOptions);
  }, []);

  // Profile and saved addresses.
  useEffect(() => {
    if (!session) return;
    supabase
      .from("profiles")
      .select("full_name, phone")
      .eq("id", session.user.id)
      .maybeSingle()
      .then(({ data }) => {
        setName((v) => v || data?.full_name || "");
        setPhone((v) => v || data?.phone || "");
      });
    supabase
      .from("customer_addresses")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(10)
      .then(({ data }) => {
        setSaved(data ?? []);
        if (data?.[0]) setSavedId(data[0].id);
      });
  }, [session]);

  const effectiveType: OrderType =
    branch && !branch.accepts_delivery
      ? "pickup"
      : branch && !branch.accepts_pickup
        ? "delivery"
        : type;
  const savedAddress = saved.find((a) => a.id === savedId) ?? null;
  const pin = savedAddress ? { lat: savedAddress.latitude, lng: savedAddress.longitude } : point;

  // Delivery area for the pin.
  const pinKey = pin ? `${pin.lat},${pin.lng}` : "";
  useEffect(() => {
    if (!pin || !branch || effectiveType !== "delivery") return;
    let cancelled = false;
    // Show "checking" while the lookup runs.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setZone({ status: "checking" });
    supabase.rpc("find_delivery_zone", { p_lat: pin.lat, p_lng: pin.lng }).then(({ data }) => {
      if (cancelled) return;
      const matches = data ?? [];
      const mine = matches.find((m) => m.branch_id === branch.id);
      if (mine) setZone({ status: "ok", match: mine });
      else if (matches[0]) setZone({ status: "other", match: matches[0] });
      else setZone({ status: "outside" });
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pinKey, branch?.id, effectiveType]);

  // The discount depends on the subtotal and the delivery fee: check again when they change.
  const quoteFee = effectiveType === "delivery" && zone.status === "ok" ? zone.match.fee_fils : 0;
  const quoteSubtotal = cartSubtotal(cart);
  async function quote(code: string, sub: number, f: number) {
    if (!branch) return;
    setCheckingPromo(true);
    const { data, error } = await supabase.rpc("promo_quote", {
      p_code: normalizePromoCode(code),
      p_branch_id: branch.id,
      p_subtotal_fils: sub,
      p_delivery_fee_fils: f,
    });
    setCheckingPromo(false);
    if (error || !data) {
      setPromo(null);
      setPromoError(orderErrorCode(error?.message));
      return;
    }
    const q = data as { code: string; name_en: string; name_ar: string; discount_fils: number };
    setPromoError(null);
    setPromoInput(q.code);
    setPromo({
      code: q.code,
      name: locale === "ar" ? q.name_ar : q.name_en,
      discount: q.discount_fils,
    });
  }
  const promoCode = promo?.code;
  useEffect(() => {
    // Re-check an applied code against the new subtotal and fee (a server call).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (promoCode) void quote(promoCode, quoteSubtotal, quoteFee);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quoteSubtotal, quoteFee]);

  if (!loading && !session) return <Redirect href="/sign-in" />;
  if (!checked) {
    return (
      <Screen>
        <ActivityIndicator color={theme.primary} />
      </Screen>
    );
  }
  if (!branch || cart.lines.length === 0) {
    return (
      <Screen>
        <AppText muted>{t("cart.empty")}</AppText>
        <Button title={t("cart.browseMenu")} onPress={() => router.replace("/menu")} />
      </Screen>
    );
  }

  const subtotal = cartSubtotal(cart);
  const fee = effectiveType === "delivery" && zone.status === "ok" ? zone.match.fee_fils : 0;
  const shortBy =
    effectiveType === "delivery" && zone.status === "ok"
      ? amountToMinimum(subtotal, zone.match.min_order_fils)
      : 0;
  const discount = promo ? Math.min(promo.discount, subtotal + fee) : 0;
  const total = subtotal + fee - discount;
  const blocked =
    !branch.open ||
    (effectiveType === "delivery" && !!pin && (zone.status !== "ok" || shortBy > 0));
  const err = (path: string) =>
    errors[path] ? t(`validation.${errors[path]}` as MessageKey) : undefined;
  const setA = (k: keyof Address) => (v: string) => setAddress((p) => ({ ...p, [k]: v }));

  async function locate() {
    setLocating(true);
    setLocationDenied(false);
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== "granted") {
        setLocationDenied(true);
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setPoint({ lat: pos.coords.latitude, lng: pos.coords.longitude });
    } catch {
      setLocationDenied(true);
    } finally {
      setLocating(false);
    }
  }

  async function placeOrder() {
    setServerError(null);
    const addr = savedAddress
      ? {
          area: savedAddress.area,
          block: savedAddress.block,
          street: savedAddress.street,
          avenue: savedAddress.avenue ?? undefined,
          building: savedAddress.building,
          floor: savedAddress.floor ?? undefined,
          apartment: savedAddress.apartment ?? undefined,
          notes: savedAddress.notes ?? undefined,
          latitude: savedAddress.latitude,
          longitude: savedAddress.longitude,
        }
      : { ...address, latitude: point?.lat, longitude: point?.lng };
    const input =
      effectiveType === "delivery"
        ? { type: "delivery" as const, name, phone, notes, address: addr }
        : { type: "pickup" as const, name, phone, notes };
    const parsed = checkoutSchema.safeParse(input);
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    setErrors({});
    const c = parsed.data;
    setPlacing(true);
    const { data, error } = await supabase.rpc("place_order", {
      p_order: {
        client_ref: clientRef,
        branch_id: branch!.id,
        type: c.type,
        customer_name: c.name,
        customer_phone: c.phone,
        notes: c.notes ?? null,
        address: c.type === "delivery" ? c.address : null,
        items: cartToOrderItems(cart),
        promo_code: promo?.code ?? null,
        payment: providerId ? { method: "online", provider_id: providerId } : { method: "cash" },
      },
    });
    if (error || !data) {
      setPlacing(false);
      const code = orderErrorCode(error?.message);
      if (code.startsWith("promo_")) setPromo(null);
      setServerError(code);
      return;
    }
    const placed = data as { id: string; payment_method: string };
    if (c.type === "delivery" && !savedAddress) {
      const a = c.address;
      const duplicate = saved.some(
        (s) =>
          s.area === a.area &&
          s.block === a.block &&
          s.street === a.street &&
          s.building === a.building,
      );
      if (!duplicate)
        await supabase.from("customer_addresses").insert({
          area: a.area,
          block: a.block,
          street: a.street,
          avenue: a.avenue ?? null,
          building: a.building,
          floor: a.floor ?? null,
          apartment: a.apartment ?? null,
          notes: a.notes ?? null,
          latitude: a.latitude,
          longitude: a.longitude,
        });
    }
    clear();
    if (placed.payment_method === "online") {
      // The order screen shows the result, or "Pay now" if the page was closed.
      await payOnline(placed.id, locale);
      router.replace({ pathname: "/orders/[id]", params: { id: placed.id } });
      return;
    }
    router.replace({ pathname: "/orders/[id]", params: { id: placed.id, placed: "1" } });
  }

  const choice = (value: OrderType, label: string, enabled: boolean) => (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: effectiveType === value, disabled: !enabled }}
      disabled={!enabled}
      onPress={() => setType(value)}
      style={{
        flex: 1,
        padding: spacing.md,
        borderRadius: 10,
        borderWidth: 1,
        alignItems: "center",
        opacity: enabled ? 1 : 0.4,
        borderColor: effectiveType === value ? theme.primary : theme.border,
        backgroundColor: theme.card,
      }}
    >
      <AppText
        style={{ fontWeight: "700", color: effectiveType === value ? theme.primary : theme.text }}
      >
        {label}
      </AppText>
    </Pressable>
  );

  return (
    <Screen>
      <Title>{t("checkout.title")}</Title>
      {!branch.open ? (
        <Notice kind="error">
          {t("checkout.branchClosedNow", { branch: localized(branch, "name", locale) })}
        </Notice>
      ) : null}

      <Card>
        <AppText style={{ fontWeight: "700" }}>{t("checkout.howToGet")}</AppText>
        <View style={{ flexDirection: "row", gap: spacing.sm }}>
          {choice("delivery", t("checkout.delivery"), branch.accepts_delivery)}
          {choice("pickup", t("checkout.pickup"), branch.accepts_pickup)}
        </View>
        {effectiveType === "pickup" ? (
          <AppText muted>
            {t("checkout.pickupFrom", { branch: localized(branch, "name", locale) })}
          </AppText>
        ) : null}
      </Card>

      {effectiveType === "delivery" ? (
        <Card>
          <AppText style={{ fontWeight: "700" }}>{t("checkout.address")}</AppText>
          {saved.length > 0 ? (
            <View style={{ gap: spacing.sm }}>
              {[
                ...saved.map((a) => ({
                  id: a.id as string | null,
                  label: `${a.area}, ${t("checkout.block")} ${a.block}, ${t("checkout.street")} ${a.street}, ${t("checkout.building")} ${a.building}`,
                })),
                { id: null, label: t("checkout.newAddress") },
              ].map((o) => (
                <Pressable
                  key={o.id ?? "new"}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: savedId === o.id }}
                  onPress={() => setSavedId(o.id)}
                  style={{
                    padding: spacing.md,
                    borderRadius: 10,
                    borderWidth: 1,
                    borderColor: savedId === o.id ? theme.primary : theme.border,
                  }}
                >
                  <AppText>{o.label}</AppText>
                </Pressable>
              ))}
            </View>
          ) : null}
          {!savedAddress ? (
            <>
              <TextField
                label={t("checkout.area")}
                value={address.area}
                onChangeText={setA("area")}
                error={err("address.area")}
              />
              <TextField
                label={t("checkout.block")}
                value={address.block}
                onChangeText={setA("block")}
                error={err("address.block")}
              />
              <TextField
                label={t("checkout.street")}
                value={address.street}
                onChangeText={setA("street")}
                error={err("address.street")}
              />
              <TextField
                label={t("checkout.avenue")}
                value={address.avenue}
                onChangeText={setA("avenue")}
              />
              <TextField
                label={t("checkout.building")}
                value={address.building}
                onChangeText={setA("building")}
                error={err("address.building")}
              />
              <TextField
                label={t("checkout.floor")}
                value={address.floor}
                onChangeText={setA("floor")}
              />
              <TextField
                label={t("checkout.apartment")}
                value={address.apartment}
                onChangeText={setA("apartment")}
              />
              <TextField
                label={t("checkout.addressNotes")}
                value={address.notes}
                onChangeText={setA("notes")}
                multiline
              />
              <Button
                title={point ? `✓ ${t("checkout.useMyLocation")}` : t("checkout.useMyLocation")}
                variant="outline"
                loading={locating}
                onPress={locate}
              />
              {locationDenied ? (
                <AppText style={{ color: theme.danger }}>{t("delivery.locationDenied")}</AppText>
              ) : null}
              {err("address.latitude") ? (
                <AppText style={{ color: theme.danger }}>{err("address.latitude")}</AppText>
              ) : null}
            </>
          ) : null}
          {zone.status === "ok" ? (
            <AppText style={{ color: theme.success, fontWeight: "600" }}>
              {t("checkout.zoneOk", {
                zone: locale === "ar" ? zone.match.zone_name_ar : zone.match.zone_name_en,
                minutes: zone.match.eta_minutes,
              })}
            </AppText>
          ) : zone.status === "outside" ? (
            <AppText style={{ color: theme.danger }}>{t("checkout.zoneOutside")}</AppText>
          ) : zone.status === "other" ? (
            <AppText style={{ color: theme.danger }}>
              {t("checkout.zoneOtherBranch", {
                branch: locale === "ar" ? zone.match.branch_name_ar : zone.match.branch_name_en,
              })}
            </AppText>
          ) : null}
        </Card>
      ) : null}

      <Card>
        <AppText style={{ fontWeight: "700" }}>{t("checkout.contact")}</AppText>
        <TextField
          label={t("checkout.name")}
          value={name}
          onChangeText={setName}
          error={err("name")}
          autoComplete="name"
        />
        <TextField
          label={t("checkout.phone")}
          value={phone}
          onChangeText={setPhone}
          error={err("phone")}
          keyboardType="phone-pad"
          ltr
          autoComplete="tel"
        />
        <TextField
          label={t("checkout.orderNotes")}
          value={notes}
          onChangeText={setNotes}
          multiline
        />
      </Card>

      <Card>
        <AppText style={{ fontWeight: "700" }}>{t("checkout.payment")}</AppText>
        {[
          { id: null as string | null, label: t("checkout.cash") },
          ...options.map((o) => ({
            id: o.id as string | null,
            label: localized(o, "name", locale),
          })),
        ].map((o) => {
          const on = providerId === o.id;
          return (
            <Pressable
              key={o.id ?? "cash"}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              onPress={() => setProviderId(o.id)}
              style={{
                padding: spacing.md,
                borderRadius: 10,
                borderColor: on ? theme.primary : theme.border,
                borderWidth: on ? 2 : 1,
                backgroundColor: theme.card,
              }}
            >
              <AppText style={{ fontWeight: on ? "700" : "400" }}>{o.label}</AppText>
            </Pressable>
          );
        })}
        {providerId ? (
          <AppText style={{ color: theme.muted }}>{t("checkout.payOnlineHint")}</AppText>
        ) : null}
      </Card>

      <Card>
        <AppText style={{ fontWeight: "700" }}>{t("checkout.promoCode")}</AppText>
        {promo ? (
          <View
            style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}
          >
            <AppText style={{ color: theme.success, flex: 1 }}>
              {t("checkout.promoApplied", { name: promo.name })}
            </AppText>
            <Button
              title={t("checkout.removePromo")}
              variant="link"
              onPress={() => {
                setPromo(null);
                setPromoInput("");
              }}
            />
          </View>
        ) : (
          <>
            <TextField
              label={t("checkout.promoCode")}
              value={promoInput}
              onChangeText={(v) => {
                setPromoInput(v);
                setPromoError(null);
              }}
              ltr
              autoCapitalize="characters"
            />
            <Button
              title={t("checkout.applyPromo")}
              variant="outline"
              loading={checkingPromo}
              disabled={!promoInput.trim()}
              onPress={() => quote(promoInput, subtotal, fee)}
            />
          </>
        )}
        {promoError ? (
          <AppText style={{ color: theme.danger }}>
            {t(`checkout.errors.${promoError}` as MessageKey)}
          </AppText>
        ) : null}
      </Card>

      <Card>
        <AppText style={{ fontWeight: "700" }}>{t("checkout.summary")}</AppText>
        {[
          [t("checkout.subtotal"), formatPrice(subtotal, locale)],
          ...(effectiveType === "delivery"
            ? [
                [
                  t("checkout.deliveryFee"),
                  zone.status === "ok"
                    ? fee === 0
                      ? t("checkout.free")
                      : formatPrice(fee, locale)
                    : "-",
                ],
              ]
            : []),
          ...(promo
            ? [[`${t("checkout.discount")} (${promo.code})`, `−${formatPrice(discount, locale)}`]]
            : []),
          [t("checkout.total"), formatPrice(total, locale)],
        ].map(([label, value]) => (
          <View key={label} style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <AppText>{label}</AppText>
            <AppText style={{ fontWeight: "700" }}>{value}</AppText>
          </View>
        ))}
        {shortBy > 0 ? (
          <AppText style={{ color: theme.danger }}>
            {t("checkout.minOrderLeft", { amount: formatPrice(shortBy, locale) })}
          </AppText>
        ) : null}
      </Card>

      {serverError ? (
        <Notice kind="error">{t(`checkout.errors.${serverError}` as MessageKey)}</Notice>
      ) : null}
      <Button
        title={
          providerId
            ? t("checkout.placeAndPay", { total: formatPrice(total, locale) })
            : t("checkout.placeOrder", { total: formatPrice(total, locale) })
        }
        loading={placing}
        disabled={blocked}
        onPress={placeOrder}
      />
    </Screen>
  );
}
