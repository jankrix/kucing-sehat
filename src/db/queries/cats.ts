import { supabaseAdmin } from "../../config";
import { Cat } from "../../types";
import { CreateCatInput, UpdateCatInput } from "../../types/api";

export async function listByUser(userId: string): Promise<Cat[]> {
  const { data, error } = await supabaseAdmin
    .from("cats")
    .select("*")
    .eq("user_id", userId)
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function getByIdAndUser(
  catId: string,
  userId: string
): Promise<Cat | null> {
  const { data, error } = await supabaseAdmin
    .from("cats")
    .select("*")
    .eq("id", catId)
    .eq("user_id", userId)
    .eq("is_active", true)
    .single();

  if (error && error.code !== "PGRST116") throw error;
  return data;
}

export async function create(
  userId: string,
  input: CreateCatInput
): Promise<Cat> {
  const { data, error } = await supabaseAdmin
    .from("cats")
    .insert({ user_id: userId, ...input })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function update(
  catId: string,
  userId: string,
  input: UpdateCatInput
): Promise<Cat> {
  const { data, error } = await supabaseAdmin
    .from("cats")
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq("id", catId)
    .eq("user_id", userId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function softDelete(
  catId: string,
  userId: string
): Promise<void> {
  const { error } = await supabaseAdmin
    .from("cats")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("id", catId)
    .eq("user_id", userId);

  if (error) throw error;
}

export async function updatePhoto(
  catId: string,
  userId: string,
  photoUrl: string
): Promise<void> {
  const { error } = await supabaseAdmin
    .from("cats")
    .update({ photo_url: photoUrl, updated_at: new Date().toISOString() })
    .eq("id", catId)
    .eq("user_id", userId);

  if (error) throw error;
}
