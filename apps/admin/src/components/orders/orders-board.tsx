"use client";

import {
  BOARD_COLUMNS,
  boardColumn,
  formatAddress,
  formatPrice,
  isOpenOrder,
  minutesSince,
  type OrderStatus,
} from "@sarhad/core";
import { localized, type Locale } from "@sarhad/i18n";
import { Badge, Button, cn } from "@sarhad/ui";
import { Bell, BellOff } from "lucide-react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";

import { refreshBoard } from "@/app/(console)/orders/actions";
import type { BoardOrder } from "@/lib/orders";

import { useAddressLabels } from "./address-labels";
import { PauseToggle } from "./pause-toggle";
import { StatusActions } from "./status-actions";

const POLL_MS = 10_000;
/** A new order waiting longer than this is highlighted. */
const LATE_MINUTES = 5;

/** Short two-tone chime made with Web Audio (no sound file to host). */
function chime(ctx: AudioContext) {
  const now = ctx.currentTime;
  [880, 1320].forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, now + i * 0.25);
    gain.gain.exponentialRampToValueAtTime(0.3, now + i * 0.25 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.25 + 0.4);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now + i * 0.25);
    osc.stop(now + i * 0.25 + 0.45);
  });
}

export function OrdersBoard({
  branchId,
  baseTitle,
  initial,
}: {
  branchId: string;
  /** The page title; new orders are counted in front of it in the browser tab. */
  baseTitle: string;
  initial: { orders: BoardOrder[]; accepting: boolean };
}) {
  const t = useTranslations("ops");
  const ts = useTranslations("orderStatus");
  const locale = useLocale() as Locale;
  const labels = useAddressLabels();
  const [orders, setOrders] = useState(initial.orders);
  const [accepting, setAccepting] = useState(initial.accepting);
  const [now, setNow] = useState(() => new Date());
  const [sound, setSound] = useState(false);
  const audio = useRef<AudioContext | null>(null);
  const seen = useRef(new Set(initial.orders.map((o) => o.id)));

  const poll = useCallback(async () => {
    try {
      const next = await refreshBoard(branchId);
      const fresh = next.orders.filter((o) => o.status === "pending" && !seen.current.has(o.id));
      next.orders.forEach((o) => seen.current.add(o.id));
      if (fresh.length && audio.current) chime(audio.current);
      setOrders(next.orders);
      setAccepting(next.accepting);
      setNow(new Date());
    } catch {
      // Offline for a moment: try again on the next tick.
    }
  }, [branchId]);

  useEffect(() => {
    const id = window.setInterval(poll, POLL_MS);
    const tick = window.setInterval(() => setNow(new Date()), 30_000);
    return () => {
      window.clearInterval(id);
      window.clearInterval(tick);
    };
  }, [poll]);

  const newCount = orders.filter((o) => o.status === "pending").length;
  useEffect(() => {
    // Re-applied on every refresh: Next.js may set the page title after this runs.
    const apply = () => (document.title = newCount ? `(${newCount}) ${baseTitle}` : baseTitle);
    apply();
    const id = window.setTimeout(apply, 1000);
    return () => window.clearTimeout(id);
  }, [newCount, baseTitle, now]);

  function toggleSound() {
    if (sound) {
      void audio.current?.close();
      audio.current = null;
      setSound(false);
      return;
    }
    // Browsers only allow sound after a click, so it is switched on here.
    audio.current = new AudioContext();
    chime(audio.current);
    setSound(true);
  }

  function changed(id: string, status: OrderStatus) {
    setOrders((prev) =>
      isOpenOrder(status)
        ? prev.map((o) => (o.id === id ? { ...o, status } : o))
        : prev.filter((o) => o.id !== id),
    );
  }

  return (
    <div className="grid gap-4">
      <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-center">
        <PauseToggle branchId={branchId} accepting={accepting} onChange={setAccepting} />
        <div className="flex items-center gap-3">
          <Button type="button" variant={sound ? "secondary" : "outline"} onClick={toggleSound}>
            {sound ? <Bell /> : <BellOff />}
            {sound ? t("soundOn") : t("soundOff")}
          </Button>
        </div>
      </div>
      <p className="text-xs text-muted-foreground" aria-live="polite">
        {newCount ? (
          <strong className="text-primary">{t("newOrders", { count: newCount })} · </strong>
        ) : null}
        {t("autoRefresh")}
      </p>

      <div className="grid items-start gap-4 lg:grid-cols-3">
        {BOARD_COLUMNS.map((col) => {
          const list = orders.filter((o) => boardColumn(o.status) === col);
          return (
            <section key={col} className="grid gap-3 rounded-xl bg-muted/50 p-3">
              <h2 className="flex items-center justify-between font-semibold">
                {t(`columns.${col}`)}
                <Badge variant={col === "new" && list.length ? "default" : "muted"}>
                  {list.length}
                </Badge>
              </h2>
              {list.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">{t("empty")}</p>
              ) : null}
              {list.map((o) => {
                const age = minutesSince(o.created_at, now);
                const late = o.status === "pending" && age >= LATE_MINUTES;
                return (
                  <article
                    key={o.id}
                    className={cn(
                      "grid gap-2 rounded-lg border bg-card p-3 shadow-sm",
                      late && "border-destructive ring-1 ring-destructive",
                    )}
                    data-testid="board-order"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <Link href={`/orders/${o.id}`} className="font-semibold hover:underline">
                        #{o.order_number}
                      </Link>
                      <div className="flex flex-wrap items-center justify-end gap-1">
                        <Badge variant={o.type === "delivery" ? "secondary" : "muted"}>
                          {t(o.type)}
                        </Badge>
                        <span
                          className={cn(
                            "text-xs tabular-nums",
                            late ? "font-semibold text-destructive" : "text-muted-foreground",
                          )}
                          suppressHydrationWarning
                        >
                          {t("minutesAgo", { minutes: age })}
                        </span>
                      </div>
                    </div>
                    {o.status !== "pending" && col !== "new" ? (
                      <p className="text-xs font-medium text-primary">{ts(o.status)}</p>
                    ) : null}
                    <p className="text-sm">
                      {o.customer_name} ·{" "}
                      <a href={`tel:${o.customer_phone}`} dir="ltr" className="underline">
                        {o.customer_phone}
                      </a>
                    </p>
                    <ul className="text-sm">
                      {o.items.map((i) => (
                        <li key={i.id}>
                          <span className="font-semibold tabular-nums">{i.quantity}×</span>{" "}
                          {localized(i, "name", locale)}
                          {i.options.length ? (
                            <span className="text-muted-foreground">
                              {" "}
                              ({i.options.map((op) => localized(op, "name", locale)).join("، ")})
                            </span>
                          ) : null}
                          {i.notes ? (
                            <span className="block text-xs text-amber-700">“{i.notes}”</span>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                    {o.notes ? (
                      <p className="rounded bg-amber-50 p-2 text-xs text-amber-900">{o.notes}</p>
                    ) : null}
                    {o.type === "delivery" && o.address ? (
                      <p className="text-xs text-muted-foreground">
                        {formatAddress(o.address, labels)}
                      </p>
                    ) : null}
                    <div className="flex items-center justify-between gap-2 border-t pt-2">
                      <span className="font-semibold tabular-nums">
                        {formatPrice(o.total_fils, locale)}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {o.payment_status === "paid"
                          ? o.payment_method === "online"
                            ? t("paidOnline")
                            : t("paid")
                          : t("unpaid")}
                      </span>
                    </div>
                    <StatusActions
                      orderId={o.id}
                      orderNumber={o.order_number}
                      type={o.type}
                      status={o.status}
                      onChanged={(s) => changed(o.id, s)}
                    />
                  </article>
                );
              })}
            </section>
          );
        })}
      </div>
    </div>
  );
}
