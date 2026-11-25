"use client";

import { formatPrice, groupAreasByCity, type DeliveryAreaOption } from "@sarhad/core";
import { localized, type Locale } from "@sarhad/i18n";
import { cn } from "@sarhad/ui";
import {
  ArrowLeft,
  Bike,
  Check,
  ChevronDown,
  Mail,
  MessageCircle,
  Phone,
  Search,
  Store,
  X,
} from "lucide-react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useId, useMemo, useRef, useState } from "react";

import { CONTACT, telHref, whatsappHref } from "@/lib/contact";
import type { OrderStart, StartBranch } from "@/lib/order-start-shared";

type Step = "type" | "delivery" | "notListed" | "pickup";

type Props = {
  open: boolean;
  onClose: () => void;
  areas: DeliveryAreaOption[];
  branches: StartBranch[];
  current: OrderStart | null;
  onChoose: (start: OrderStart) => void;
};

/** "Delivery or pickup?" chooser, shown on the first visit and from every "Change" link. */
export function OrderStartDialog({ open, onClose, areas, branches, current, onChoose }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const [step, setStep] = useState<Step>("type");

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      // A "Change" link opens straight on the step the visitor chose last time.
      setStep(current ? current.type : "type");
      d.showModal();
    }
    if (!open && d.open) d.close();
  }, [open, current]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        // A click on the dimmed backdrop closes the dialog.
        if (e.target === e.currentTarget) onClose();
      }}
      aria-labelledby="start-title"
      className="m-auto max-h-[92dvh] w-[min(100%-2rem,30rem)] overflow-visible bg-transparent p-0 text-foreground backdrop:bg-black/75 backdrop:backdrop-blur-sm max-sm:mb-0 max-sm:w-full"
    >
      <div className="relative flex max-h-[92dvh] flex-col overflow-y-auto rounded-[1.75rem] border border-border bg-card p-6 shadow-2xl max-sm:rounded-b-none">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-1 rounded-t-[1.75rem]"
          style={{ backgroundImage: "var(--brand-gradient)" }}
        />
        {open ? (
          step === "type" ? (
            <TypeStep onPick={setStep} onClose={onClose} />
          ) : step === "delivery" ? (
            <DeliveryStep
              areas={areas}
              initial={current?.type === "delivery" ? current.area : null}
              onBack={() => setStep("type")}
              onNotListed={() => setStep("notListed")}
              onChoose={(area) => onChoose({ type: "delivery", area })}
            />
          ) : step === "notListed" ? (
            <NotListedStep onBack={() => setStep("delivery")} onPickup={() => setStep("pickup")} />
          ) : (
            <PickupStep
              branches={branches}
              initial={current?.type === "pickup" ? current.branch.id : null}
              onBack={() => setStep("type")}
              onChoose={(branch) => onChoose({ type: "pickup", branch })}
            />
          )
        ) : null}
      </div>
    </dialog>
  );
}

function StepHeader({
  title,
  body,
  label,
  onBack,
}: {
  title: string;
  body?: string;
  label?: string;
  onBack?: () => void;
}) {
  const t = useTranslations("start");
  return (
    <div className="mb-5 grid gap-3">
      {onBack ? (
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            aria-label={t("back")}
            className="flex size-11 items-center justify-center rounded-full bg-secondary hover:bg-[#262626]"
          >
            <ArrowLeft className="size-5 rtl:rotate-180" aria-hidden />
          </button>
          {label ? <span className="font-bold text-brand-amber">{label}</span> : null}
        </div>
      ) : null}
      <div>
        <h2 id="start-title" className="text-2xl font-extrabold leading-tight">
          {title}
        </h2>
        {body ? <p className="mt-1 text-muted-foreground">{body}</p> : null}
      </div>
    </div>
  );
}

function TypeStep({ onPick, onClose }: { onPick: (s: Step) => void; onClose: () => void }) {
  const t = useTranslations("start");
  const tc = useTranslations("common");
  const choice = (value: Step, Icon: typeof Bike, title: string, hint: string) => (
    <button
      type="button"
      onClick={() => onPick(value)}
      className="group flex items-center gap-4 rounded-[1.25rem] border-2 border-border bg-black p-4 text-start transition-colors hover:border-primary focus-visible:border-primary"
    >
      <span
        className="flex size-14 shrink-0 items-center justify-center rounded-2xl text-black"
        style={{ backgroundImage: "var(--brand-gradient)" }}
      >
        <Icon className="size-7" aria-hidden />
      </span>
      <span className="grid">
        <span className="text-lg font-extrabold">{title}</span>
        <span className="text-sm text-muted-foreground">{hint}</span>
      </span>
    </button>
  );
  return (
    <div className="grid gap-5">
      <button
        type="button"
        onClick={onClose}
        aria-label={t("close")}
        className="absolute end-4 top-4 flex size-10 items-center justify-center rounded-full bg-secondary hover:bg-[#262626]"
      >
        <X className="size-5" aria-hidden />
      </button>
      <Image
        src="/brand/logo.png"
        alt={tc("brand")}
        width={160}
        height={144}
        className="mx-auto h-28 w-auto"
        priority
      />
      <h2 id="start-title" className="text-center text-2xl font-extrabold">
        {t("title")}
      </h2>
      <div className="grid gap-3">
        {choice("delivery", Bike, t("delivery"), t("deliveryHint"))}
        {choice("pickup", Store, t("pickup"), t("pickupHint"))}
      </div>
    </div>
  );
}

function DeliveryStep({
  areas,
  initial,
  onBack,
  onNotListed,
  onChoose,
}: {
  areas: DeliveryAreaOption[];
  initial: DeliveryAreaOption | null;
  onBack: () => void;
  onNotListed: () => void;
  onChoose: (area: DeliveryAreaOption) => void;
}) {
  const t = useTranslations("start");
  const locale = useLocale() as Locale;
  const cityId = useId();
  const groups = useMemo(() => groupAreasByCity(areas), [areas]);
  const [city, setCity] = useState(
    initial?.city_en ?? (groups.length === 1 ? groups[0]!.city : ""),
  );
  const [areaId, setAreaId] = useState(initial?.area_id ?? "");
  const [query, setQuery] = useState("");

  const inCity = groups.find((g) => g.city === city)?.areas ?? [];
  const q = query.trim().toLowerCase();
  const shown = q
    ? inCity.filter((a) => a.name_en.toLowerCase().includes(q) || a.name_ar.includes(q))
    : inCity;
  const selected = areas.find((a) => a.area_id === areaId) ?? null;

  return (
    <div className="grid gap-4">
      <StepHeader
        title={t("whereTitle")}
        body={t("whereHint")}
        label={t("delivery")}
        onBack={onBack}
      />
      {groups.length === 0 ? (
        <p className="rounded-2xl bg-secondary p-4 text-sm text-muted-foreground">
          {t("noAreasYet")}
        </p>
      ) : (
        <>
          <div className="grid gap-2">
            <label htmlFor={cityId} className="text-sm font-semibold">
              {t("city")}
            </label>
            <div className="relative">
              <select
                id={cityId}
                value={city}
                onChange={(e) => {
                  setCity(e.target.value);
                  setAreaId("");
                  setQuery("");
                }}
                className="h-14 w-full appearance-none rounded-2xl border-2 border-input bg-black px-4 pe-11 text-base font-semibold focus-visible:border-brand-amber focus-visible:outline-none"
              >
                <option value="" disabled>
                  {t("chooseCity")}
                </option>
                {groups.map((g) => (
                  <option key={g.city} value={g.city}>
                    {localized(g.areas[0]!, "city", locale)}
                  </option>
                ))}
              </select>
              <ChevronDown
                className="pointer-events-none absolute end-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
            </div>
          </div>

          {city ? (
            <fieldset className="grid gap-2">
              <legend className="mb-2 text-sm font-semibold">{t("area")}</legend>
              {inCity.length > 6 ? (
                <div className="relative">
                  <Search
                    className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                    aria-hidden
                  />
                  <input
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={t("searchAreas")}
                    aria-label={t("searchAreas")}
                    className="h-11 w-full rounded-xl border border-input bg-black ps-9 pe-3 text-base focus-visible:border-brand-amber focus-visible:outline-none"
                  />
                </div>
              ) : null}
              <div className="grid max-h-64 gap-2 overflow-y-auto pe-1">
                {shown.length === 0 ? (
                  <p className="p-2 text-sm text-muted-foreground">{t("noAreaMatch")}</p>
                ) : (
                  shown.map((a) => (
                    <label
                      key={a.area_id}
                      className="flex min-h-12 cursor-pointer items-center justify-between gap-3 rounded-xl border-2 border-border bg-black px-4 py-2 font-semibold has-[:checked]:border-primary has-[:checked]:bg-primary/10 has-[:focus-visible]:border-brand-amber"
                    >
                      <input
                        type="radio"
                        name="start-area"
                        value={a.area_id}
                        checked={areaId === a.area_id}
                        onChange={() => setAreaId(a.area_id)}
                        className="sr-only"
                      />
                      <span>{localized(a, "name", locale)}</span>
                      {areaId === a.area_id ? (
                        <Check className="size-5 text-primary" aria-hidden />
                      ) : null}
                    </label>
                  ))
                )}
              </div>
            </fieldset>
          ) : null}

          <p className="min-h-5 text-sm text-success" aria-live="polite">
            {selected
              ? t("areaInfo", {
                  fee:
                    selected.fee_fils === 0
                      ? t("freeDelivery")
                      : formatPrice(selected.fee_fils, locale),
                  minutes: selected.eta_minutes,
                  min: formatPrice(selected.min_order_fils, locale),
                })
              : ""}
          </p>
          <button
            type="button"
            disabled={!selected}
            onClick={() => selected && onChoose(selected)}
            className="btn-brand h-14 text-base disabled:opacity-40"
            data-testid="start-continue"
          >
            {t("continue")}
          </button>
        </>
      )}
      <button
        type="button"
        onClick={onNotListed}
        className="h-12 rounded-full border-2 border-input font-bold text-brand-amber hover:border-brand-amber"
      >
        {t("notListed")}
      </button>
    </div>
  );
}

function NotListedStep({ onBack, onPickup }: { onBack: () => void; onPickup: () => void }) {
  const t = useTranslations("start");
  const row = (
    href: string,
    Icon: typeof Phone,
    title: string,
    value: string,
    external = false,
  ) => (
    <a
      href={href}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      className="flex min-h-16 items-center gap-4 rounded-2xl border border-border bg-black p-3 text-foreground no-underline hover:border-brand-amber"
    >
      <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-secondary text-brand-amber">
        <Icon className="size-5" aria-hidden />
      </span>
      <span className="grid">
        <strong>{title}</strong>
        <span className="text-sm text-muted-foreground" dir="ltr">
          {value}
        </span>
      </span>
    </a>
  );
  return (
    <div className="grid gap-3">
      <StepHeader title={t("notListedTitle")} body={t("notListedBody")} onBack={onBack} />
      {row(telHref(CONTACT.phone), Phone, t("call"), CONTACT.phone)}
      {row(whatsappHref(CONTACT.whatsapp), MessageCircle, t("whatsapp"), CONTACT.whatsapp, true)}
      {row(`mailto:${CONTACT.email}`, Mail, t("email"), CONTACT.email)}
      <button type="button" onClick={onPickup} className="btn-brand mt-2 h-14 text-base">
        {t("pickupInstead")}
      </button>
    </div>
  );
}

function PickupStep({
  branches,
  initial,
  onBack,
  onChoose,
}: {
  branches: StartBranch[];
  initial: string | null;
  onBack: () => void;
  onChoose: (b: StartBranch) => void;
}) {
  const t = useTranslations("start");
  const locale = useLocale() as Locale;
  const [id, setId] = useState(initial ?? (branches.length === 1 ? branches[0]!.id : ""));
  const selected = branches.find((b) => b.id === id) ?? null;
  return (
    <div className="grid gap-4">
      <StepHeader
        title={t("pickupTitle")}
        body={t("pickupBody")}
        label={t("pickup")}
        onBack={onBack}
      />
      {branches.length === 0 ? (
        <p className="rounded-2xl bg-secondary p-4 text-sm text-muted-foreground">
          {t("noPickup")}
        </p>
      ) : (
        <fieldset className="grid gap-2">
          <legend className="sr-only">{t("pickupTitle")}</legend>
          {branches.map((b) => (
            <label
              key={b.id}
              className="flex cursor-pointer items-start gap-3 rounded-2xl border-2 border-border bg-black p-4 has-[:checked]:border-primary has-[:checked]:bg-primary/10 has-[:focus-visible]:border-brand-amber"
            >
              <input
                type="radio"
                name="start-branch"
                checked={id === b.id}
                onChange={() => setId(b.id)}
                className="mt-1 size-[18px] accent-[var(--brand-orange)]"
              />
              <span className="grid flex-1 gap-1">
                <span className="flex flex-wrap items-center justify-between gap-2">
                  <strong className="text-base">{localized(b, "name", locale)}</strong>
                  <span
                    className={cn(
                      "rounded-full px-2.5 py-0.5 text-xs font-bold",
                      b.open ? "bg-success/15 text-success" : "bg-secondary text-muted-foreground",
                    )}
                  >
                    {b.open ? t("openNow") : t("closedNow")}
                  </span>
                </span>
                {localized(b, "address", locale) ? (
                  <span className="text-sm text-muted-foreground">
                    {localized(b, "address", locale)}
                  </span>
                ) : null}
              </span>
            </label>
          ))}
        </fieldset>
      )}
      <button
        type="button"
        disabled={!selected}
        onClick={() => selected && onChoose(selected)}
        className="btn-brand h-14 text-base disabled:opacity-40"
      >
        {t("continue")}
      </button>
    </div>
  );
}
