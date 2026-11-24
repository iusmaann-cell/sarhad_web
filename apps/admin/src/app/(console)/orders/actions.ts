"use server";

import { ORDER_STATUSES, statusErrorCode, type OrderStatus } from "@sarhad/core";
import { revalidatePath } from "next/cache";

import { loadBoard, type BoardOrder } from "@/lib/orders";
import { requireStaff } from "@/lib/staff";
import { createClient } from "@/lib/supabase/server";

export type StatusResult = { ok: true; status: OrderStatus } | { ok: false; error: string };

/** Polled by the live board. RLS limits it to the staff member's branches. */
export async function refreshBoard(
  branchId: string,
): Promise<{ orders: BoardOrder[]; accepting: boolean }> {
  await requireStaff();
  return loadBoard(branchId);
}

export async function changeOrderStatus(
  orderId: string,
  status: OrderStatus,
  reason?: string,
): Promise<StatusResult> {
  await requireStaff();
  if (!ORDER_STATUSES.includes(status)) return { ok: false, error: "invalid_status" };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("update_order_status", {
    p_order_id: orderId,
    p_status: status,
    p_reason: reason?.slice(0, 300),
  });
  if (error || !data) return { ok: false, error: statusErrorCode(error?.message) };
  revalidatePath(`/orders/${orderId}`);
  return { ok: true, status: data };
}

export async function setAcceptingOrders(
  branchId: string,
  accepting: boolean,
): Promise<{ ok: boolean; accepting: boolean }> {
  await requireStaff();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("set_accepting_orders", {
    p_branch_id: branchId,
    p_accepting: accepting,
  });
  if (error) return { ok: false, accepting: !accepting };
  revalidatePath("/orders");
  revalidatePath("/branches");
  return { ok: true, accepting: data ?? accepting };
}
