import { openai } from "../config";
import { LabResultWithValues } from "../types";

export interface TrendPoint {
  date: string;
  value: number;
  flag: string;
  lab_name: string | null;
}

export interface TrendParameter {
  name: string;
  label: string | null;
  unit: string;
  ref_min: number | null;
  ref_max: number | null;
  points: TrendPoint[];
}

export function groupByParameter(labs: LabResultWithValues[]): TrendParameter[] {
  const confirmed = labs.filter((l) => l.status === "confirmed");
  const map: Record<string, TrendParameter> = {};

  for (const lab of confirmed) {
    for (const v of lab.lab_values) {
      if (!map[v.parameter_name]) {
        map[v.parameter_name] = {
          name: v.parameter_name,
          label: v.parameter_label,
          unit: v.unit,
          ref_min: v.ref_min,
          ref_max: v.ref_max,
          points: [],
        };
      }
      map[v.parameter_name].points.push({
        date: lab.test_date,
        value: v.value,
        flag: v.flag,
        lab_name: lab.lab_name,
      });
    }
  }

  for (const param of Object.values(map)) {
    param.points.sort((a, b) => a.date.localeCompare(b.date));
  }

  // Return all params sorted by name; caller decides whether to filter by >= 2 points
  return Object.values(map).sort((a, b) => a.name.localeCompare(b.name));
}

export async function analyzeTrends(
  catName: string,
  trends: TrendParameter[]
): Promise<string> {
  const trendable = trends.filter((t) => t.points.length >= 2);

  if (trendable.length === 0) {
    return "Belum cukup data untuk analisis tren. Upload minimal 2 hasil lab yang sudah dikonfirmasi.";
  }

  const summary = trendable
    .map((t) => {
      const points = t.points
        .map((p) => `${p.date}: ${p.value} ${t.unit} (${p.flag})`)
        .join(" → ");
      return `${t.name}${t.label ? ` (${t.label})` : ""}${t.ref_min !== null ? ` [normal: ${t.ref_min}-${t.ref_max}]` : ""}: ${points}`;
    })
    .join("\n");

  const prompt = `Kamu adalah Dr. Meow, dokter hewan AI yang ramah. Analisis tren kesehatan kucing bernama "${catName}" berdasarkan data berikut:

${summary}

Berikan analisis dalam Bahasa Indonesia yang ramah dan mudah dipahami oleh pemilik kucing awam:
1. Ringkasan kondisi kesehatan keseluruhan
2. Parameter yang tren-nya membaik, memburuk, atau stabil — jelaskan apa artinya
3. Parameter yang perlu perhatian lebih
4. Rekomendasi praktis untuk pemilik
5. Apakah perlu kunjungan dokter hewan dalam waktu dekat

Gunakan format yang rapi dengan emoji. Bahasa santai tapi informatif.

⚠️ Disclaimer: Ini adalah analisis AI, bukan diagnosis medis. Selalu konsultasikan ke dokter hewan untuk penanganan yang tepat.`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.7,
    max_tokens: 1500,
  });

  return (
    response.choices[0]?.message?.content ?? "Gagal menganalisis tren."
  );
}
