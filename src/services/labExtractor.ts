import { openai } from "../config";
import { LabValue } from "../types";

interface ExtractedValue {
  parameter_name: string;
  parameter_label: string;
  value: number;
  unit: string;
  ref_min: number | null;
  ref_max: number | null;
}

interface ExtractionResult {
  values: ExtractedValue[];
  raw_output: string;
}

const EXTRACTION_PROMPT = `Kamu adalah asisten ekstraksi data hasil laboratorium kucing. Tugasmu adalah membaca gambar hasil lab/rekam medis kucing dan mengekstrak semua parameter tes yang ada.

Ekstrak SETIAP parameter yang terlihat di dokumen. Untuk setiap parameter, kembalikan:
- parameter_name: nama singkat/kode (contoh: "HCT", "BUN", "ALT")
- parameter_label: nama lengkap (contoh: "Hematocrit", "Blood Urea Nitrogen", "Alanine Aminotransferase")
- value: nilai numerik hasil tes (angka saja, tanpa satuan)
- unit: satuan pengukuran (contoh: "%", "g/dL", "U/L", "mg/dL")
- ref_min: batas bawah nilai normal (null jika tidak ada)
- ref_max: batas atas nilai normal (null jika tidak ada)

Kembalikan HANYA JSON valid dengan format:
{
  "values": [
    {
      "parameter_name": "HCT",
      "parameter_label": "Hematocrit",
      "value": 35.2,
      "unit": "%",
      "ref_min": 30,
      "ref_max": 45
    }
  ]
}

Jika gambar bukan hasil lab atau tidak bisa dibaca, kembalikan: {"values": [], "error": "Gambar tidak dapat diproses"}`;

export async function extractLabValues(imageDataUrl: string): Promise<ExtractionResult> {
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: EXTRACTION_PROMPT },
          { type: "image_url", image_url: { url: imageDataUrl, detail: "high" } },
        ],
      },
    ],
    max_tokens: 2000,
    temperature: 0,
  });

  const raw_output = response.choices[0]?.message?.content ?? "";

  // Parse JSON from response
  const jsonMatch = raw_output.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("AI tidak dapat mengekstrak data dari gambar ini");
  }

  const parsed = JSON.parse(jsonMatch[0]);

  if (parsed.error) {
    throw new Error(parsed.error);
  }

  return { values: parsed.values ?? [], raw_output };
}

export function computeFlag(
  value: number,
  ref_min: number | null,
  ref_max: number | null
): LabValue["flag"] {
  if (ref_min === null && ref_max === null) return "normal";

  const below = ref_min !== null && value < ref_min;
  const above = ref_max !== null && value > ref_max;

  if (!below && !above) return "normal";

  // Consider critically abnormal if > 50% outside the range
  if (below) {
    const deviation = ref_min! > 0 ? (ref_min! - value) / ref_min! : 0;
    return deviation > 0.5 ? "critical_low" : "low";
  }

  const deviation = ref_max! > 0 ? (value - ref_max!) / ref_max! : 0;
  return deviation > 0.5 ? "critical_high" : "high";
}
