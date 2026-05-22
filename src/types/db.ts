export interface Cat {
  id: string;
  user_id: string;
  name: string;
  breed: string | null;
  birth_date: string | null;
  gender: "male" | "female" | "unknown";
  weight_kg: number | null;
  photo_url: string | null;
  notes: string | null;
  memory_notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface LabResult {
  id: string;
  cat_id: string;
  user_id: string;
  test_date: string;
  lab_name: string | null;
  document_url: string | null;
  ai_raw_output: string | null;
  status: "processing" | "extracted" | "confirmed" | "error";
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface LabValue {
  id: string;
  lab_result_id: string;
  parameter_name: string;
  parameter_label: string | null;
  value: number;
  unit: string;
  ref_min: number | null;
  ref_max: number | null;
  is_abnormal: boolean;
  flag: "normal" | "low" | "high" | "critical_low" | "critical_high";
  created_at: string;
}

export interface LabResultWithValues extends LabResult {
  lab_values: LabValue[];
}

export interface PurchaseLog {
  id: string;
  cat_id: string;
  user_id: string;
  category: "food" | "vitamin" | "medicine" | "supplement" | "other";
  product_name: string;
  brand: string | null;
  quantity: string | null;
  price_idr: number | null;
  purchase_date: string;
  notes: string | null;
  created_at: string;
}

export interface ChatSession {
  id: string;
  cat_id: string | null;
  user_id: string;
  title: string | null;
  messages: ChatSessionMessage[];
  created_at: string;
  updated_at: string;
}

export interface ChatSessionMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

export interface Subscription {
  id: string;
  user_id: string;
  plan: "free" | "basic" | "premium";
  status: "active" | "expired" | "cancelled";
  started_at: string;
  expires_at: string | null;
  payment_ref: string | null;
  created_at: string;
}
