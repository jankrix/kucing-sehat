import { supabaseAdmin } from "../../config";

export interface VetVisit {
  id: string;
  cat_id: string;
  user_id: string;
  visit_date: string;
  clinic_name: string | null;
  vet_name: string | null;
  reason: string | null;
  diagnosis: string | null;
  cost_idr: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface VetVisitInput {
  visit_date: string;
  clinic_name?: string | null;
  vet_name?: string | null;
  reason?: string | null;
  diagnosis?: string | null;
  cost_idr?: number | null;
  notes?: string | null;
}

export async function create(
  catId: string,
  userId: string,
  input: VetVisitInput
): Promise<VetVisit> {
  const { data, error } = await supabaseAdmin
    .from("vet_visits")
    .insert({ cat_id: catId, user_id: userId, ...input })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function listByCat(catId: string): Promise<VetVisit[]> {
  const { data, error } = await supabaseAdmin
    .from("vet_visits")
    .select("*")
    .eq("cat_id", catId)
    .order("visit_date", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

// Used by lab upload dropdown — recent visits within the last N days
export async function getRecentByCat(
  catId: string,
  daysBack = 30
): Promise<Pick<VetVisit, "id" | "visit_date" | "clinic_name" | "reason" | "cost_idr">[]> {
  const since = new Date();
  since.setDate(since.getDate() - daysBack);

  const { data, error } = await supabaseAdmin
    .from("vet_visits")
    .select("id,visit_date,clinic_name,reason,cost_idr")
    .eq("cat_id", catId)
    .gte("visit_date", since.toISOString().split("T")[0])
    .order("visit_date", { ascending: false });

  if (error) throw error;
  return data ?? [];
}
