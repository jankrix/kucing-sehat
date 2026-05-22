import * as labQueries from "../db/queries/labs";
import { Cat } from "../types";

export async function buildCatContext(cat: Cat): Promise<string> {
  const labs = await labQueries.listByCat(cat.id);
  const confirmed = labs.filter(
    (l) => l.status === "confirmed" && l.lab_values?.length > 0
  );

  let context = `## Data Kucing: ${cat.name}\n`;
  context += `- Ras: ${cat.breed || "Tidak diketahui"}\n`;
  if (cat.birth_date) {
    const birth = new Date(cat.birth_date);
    const now = new Date();
    const totalMonths =
      (now.getFullYear() - birth.getFullYear()) * 12 +
      (now.getMonth() - birth.getMonth());
    const years = Math.floor(totalMonths / 12);
    const months = totalMonths % 12;
    const ageStr =
      years > 0
        ? `${years} tahun${months > 0 ? ` ${months} bulan` : ""}`
        : `${months} bulan`;
    context += `- Usia: ${ageStr} (lahir ${cat.birth_date})\n`;
  }
  context += `- Jenis kelamin: ${cat.gender}\n`;
  if (cat.weight_kg) context += `- Berat badan: ${cat.weight_kg} kg\n`;
  if (cat.notes) context += `- Catatan: ${cat.notes}\n`;

  if (cat.memory_notes) {
    context += `\n## Catatan Kesehatan Sebelumnya\n${cat.memory_notes}\n`;
  }

  if (confirmed.length === 0) {
    context += `\nBelum ada hasil lab yang dikonfirmasi untuk ${cat.name}.\n`;
    return context;
  }

  context += `\n## Riwayat Hasil Lab (${confirmed.length} pemeriksaan terakhir)\n\n`;

  for (const lab of confirmed.slice(0, 5)) {
    context += `### ${lab.lab_name || "Hasil Lab"} — ${lab.test_date}\n`;

    const abnormal = lab.lab_values.filter((v) => v.is_abnormal);
    const normal = lab.lab_values.filter((v) => !v.is_abnormal);

    if (abnormal.length > 0) {
      context += `**Nilai Abnormal:**\n`;
      for (const v of abnormal) {
        const ref =
          v.ref_min !== null || v.ref_max !== null
            ? ` (ref: ${v.ref_min ?? "?"}-${v.ref_max ?? "?"})`
            : "";
        context += `- ${v.parameter_name}: **${v.value} ${v.unit}**${ref} → ${v.flag.replace("_", " ").toUpperCase()}\n`;
      }
    }

    if (normal.length > 0) {
      context += `**Nilai Normal:** ${normal
        .map((v) => `${v.parameter_name}: ${v.value} ${v.unit}`)
        .join(", ")}\n`;
    }
    context += "\n";
  }

  // Flag recurring abnormalities across labs
  const allAbnormal = confirmed.flatMap((l) =>
    l.lab_values.filter((v) => v.is_abnormal)
  );
  const counts: Record<string, number> = {};
  for (const v of allAbnormal) {
    counts[v.parameter_name] = (counts[v.parameter_name] || 0) + 1;
  }
  const recurring = Object.entries(counts).filter(([, n]) => n >= 2);

  if (recurring.length > 0) {
    context += `## Nilai Yang Terus Abnormal\n`;
    for (const [param, n] of recurring) {
      context += `- ${param}: abnormal dalam ${n} dari ${confirmed.length} pemeriksaan\n`;
    }
    context += "\n";
  }

  context +=
    "Gunakan data di atas sebagai konteks saat menjawab pertanyaan pemilik kucing ini.";
  return context;
}
