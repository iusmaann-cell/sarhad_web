import "server-only";

import type { OrderAddress, Tables } from "@sarhad/core";

import type { StaffContext } from "./staff";
import { createClient } from "./supabase/server";

export type OrderOption = { name_en: string; name_ar: string; price_delta_fils: number };
export type OrderLine = Pick<
  Tables<"order_items">,
  "id" | "name_en" | "name_ar" | "quantity" | "notes" | "sort_order" | "line_total_fils"
> & { options: OrderOption[] };

export type BoardOrder = Pick<
  Tables<"orders">,
  | "id"
  | "order_number"
  | "type"
  | "status"
  | "customer_name"
  | "customer_phone"
  | "total_fils"
  | "created_at"
  | "payment_status"
  | "notes"
> & { address: OrderAddress | null; items: OrderLine[] };

export type OrderDetail = Omit<Tables<"orders">, "address"> & {
  address: OrderAddress | null;
  items: OrderLine[];
  events: Pick<Tables<"order_events">, "id" | "status" | "note" | "created_at">[];
  branch: Pick<Tables<"branches">, "id" | "name_en" | "name_ar"> | null;
};

export type BranchOption = Pick<
  Tables<"branches">,
  "id" | "name_en" | "name_ar" | "accepting_orders" | "is_active"
>;

const ITEM_FIELDS = "id, name_en, name_ar, quantity, notes, sort_order, line_total_fils, options";

/** Branches this staff member works in (all of them for admins). */
export async function staffBranches(staff: StaffContext): Promise<BranchOption[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("branches")
    .select("id, name_en, name_ar, accepting_orders, is_active")
    .order("sort_order");
  return (data ?? []).filter((b) => staff.isAdmin || staff.roles.some((r) => r.branch_id === b.id));
}

/** Open orders of a branch, oldest first, with the branch's pause state. */
export async function loadBoard(
  branchId: string,
): Promise<{ orders: BoardOrder[]; accepting: boolean }> {
  const supabase = await createClient();
  const [{ data: orders }, { data: branch }] = await Promise.all([
    supabase
      .from("orders")
      .select(
        `id, order_number, type, status, customer_name, customer_phone, total_fils, created_at, payment_status, notes, address, items:order_items(${ITEM_FIELDS})`,
      )
      .eq("branch_id", branchId)
      .not("status", "in", "(completed,cancelled)")
      .order("created_at")
      .limit(200),
    supabase.from("branches").select("accepting_orders").eq("id", branchId).maybeSingle(),
  ]);
  const list = (orders ?? []) as unknown as BoardOrder[];
  for (const o of list) o.items.sort((a, b) => a.sort_order - b.sort_order);
  return { orders: list, accepting: branch?.accepting_orders ?? false };
}

export async function getOrderDetail(id: string): Promise<OrderDetail | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("orders")
    .select(
      `*, items:order_items(${ITEM_FIELDS}), events:order_events(id, status, note, created_at), branch:branches(id, name_en, name_ar)`,
    )
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;
  const order = data as unknown as OrderDetail;
  order.items.sort((a, b) => a.sort_order - b.sort_order);
  order.events.sort((a, b) => a.id - b.id);
  return order;
}

export type HistoryFilters = {
  branch?: string;
  status?: Tables<"orders">["status"];
  from?: string;
  to?: string;
  q?: string;
  page: number;
};

export const HISTORY_PAGE_SIZE = 50;

export type HistoryRow = Pick<
  Tables<"orders">,
  | "id"
  | "order_number"
  | "type"
  | "status"
  | "customer_name"
  | "customer_phone"
  | "total_fils"
  | "created_at"
> & { branch: Pick<Tables<"branches">, "name_en" | "name_ar"> | null };

/** Past and current orders, newest first. Dates are Kuwait days (YYYY-MM-DD). */
export async function searchOrders(
  f: HistoryFilters,
): Promise<{ rows: HistoryRow[]; more: boolean }> {
  const supabase = await createClient();
  let query = supabase
    .from("orders")
    .select(
      "id, order_number, type, status, customer_name, customer_phone, total_fils, created_at, branch:branches(name_en, name_ar)",
    )
    .order("created_at", { ascending: false });
  if (f.branch) query = query.eq("branch_id", f.branch);
  if (f.status) query = query.eq("status", f.status);
  if (f.from) query = query.gte("created_at", `${f.from}T00:00:00+03:00`);
  if (f.to) query = query.lt("created_at", nextDay(f.to));
  const q = f.q?.trim();
  if (q) {
    const digits = q.replace(/\D/g, "");
    if (/^#?\d{1,7}$/.test(q)) query = query.eq("order_number", Number(digits));
    else if (digits.length >= 4) query = query.ilike("customer_phone", `%${digits}%`);
    else query = query.ilike("customer_name", `%${q.replace(/[%_,()]/g, "")}%`);
  }
  const start = (f.page - 1) * HISTORY_PAGE_SIZE;
  const { data } = await query.range(start, start + HISTORY_PAGE_SIZE);
  const rows = (data ?? []) as unknown as HistoryRow[];
  return { rows: rows.slice(0, HISTORY_PAGE_SIZE), more: rows.length > HISTORY_PAGE_SIZE };
}

function nextDay(day: string): string {
  const d = new Date(`${day}T00:00:00+03:00`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString();
}
