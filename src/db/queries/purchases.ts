import { supabaseAdmin } from "../../config";
import { PurchaseLog } from "../../types";
import { CreatePurchaseInput } from "../../types/api";

export async function listByCat(catId: string): Promise<PurchaseLog[]> {
  const { data, error } = await supabaseAdmin
    .from("purchase_log")
    .select("*")
    .eq("cat_id", catId)
    .order("purchase_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function create(
  catId: string,
  userId: string,
  input: CreatePurchaseInput
): Promise<PurchaseLog> {
  const { data, error } = await supabaseAdmin
    .from("purchase_log")
    .insert({ cat_id: catId, user_id: userId, ...input })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function remove(id: string, userId: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from("purchase_log")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (error) throw error;
}
