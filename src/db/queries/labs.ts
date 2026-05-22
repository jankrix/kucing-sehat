import { supabaseAdmin } from "../../config";
import { LabResult, LabResultWithValues, LabValue } from "../../types";
import { computeFlag } from "../../services/labExtractor";

interface CreateLabInput {
  test_date: string;
  lab_name?: string;
  document_url?: string;
  ai_raw_output?: string;
  vet_visit_id?: string;
  status?: LabResult["status"];
}

interface UpsertLabValueInput {
  parameter_name: string;
  parameter_label?: string;
  value: number;
  unit: string;
  ref_min?: number | null;
  ref_max?: number | null;
}

export async function create(
  catId: string,
  userId: string,
  input: CreateLabInput
): Promise<LabResult> {
  const { data, error } = await supabaseAdmin
    .from("lab_results")
    .insert({ cat_id: catId, user_id: userId, ...input })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateStatus(
  labId: string,
  status: LabResult["status"],
  extra: Partial<{ ai_raw_output: string }> = {}
): Promise<void> {
  const { error } = await supabaseAdmin
    .from("lab_results")
    .update({ status, ...extra, updated_at: new Date().toISOString() })
    .eq("id", labId);

  if (error) throw error;
}

export async function insertValues(
  labResultId: string,
  values: UpsertLabValueInput[]
): Promise<LabValue[]> {
  const rows = values.map((v) => {
    const flag = computeFlag(v.value, v.ref_min ?? null, v.ref_max ?? null);
    return {
      lab_result_id: labResultId,
      parameter_name: v.parameter_name,
      parameter_label: v.parameter_label ?? null,
      value: v.value,
      unit: v.unit,
      ref_min: v.ref_min ?? null,
      ref_max: v.ref_max ?? null,
      is_abnormal: flag !== "normal",
      flag,
    };
  });

  const { data, error } = await supabaseAdmin
    .from("lab_values")
    .insert(rows)
    .select();

  if (error) throw error;
  return data;
}

export async function replaceValues(
  labResultId: string,
  values: UpsertLabValueInput[]
): Promise<LabValue[]> {
  // Delete existing values then insert new ones (for confirm/edit flow)
  const { error: delError } = await supabaseAdmin
    .from("lab_values")
    .delete()
    .eq("lab_result_id", labResultId);

  if (delError) throw delError;

  return insertValues(labResultId, values);
}

export async function listByCat(catId: string): Promise<LabResultWithValues[]> {
  const { data, error } = await supabaseAdmin
    .from("lab_results")
    .select("*, lab_values(*)")
    .eq("cat_id", catId)
    .order("test_date", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function getById(
  labId: string,
  userId: string
): Promise<LabResultWithValues | null> {
  const { data, error } = await supabaseAdmin
    .from("lab_results")
    .select("*, lab_values(*)")
    .eq("id", labId)
    .eq("user_id", userId)
    .single();

  if (error && error.code !== "PGRST116") throw error;
  return data;
}
