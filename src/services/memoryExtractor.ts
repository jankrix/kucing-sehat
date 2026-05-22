import { openai, supabaseAdmin } from "../config";
import { Cat, ChatSessionMessage } from "../types";

const MAX_MEMORY_CHARS = 1500;
const MIN_MESSAGES_TO_EXTRACT = 2; // don't bother on trivial sessions

const SYSTEM_PROMPT = `Kamu adalah sistem ekstraksi catatan kesehatan kucing. Tugasmu: baca percakapan antara pemilik kucing dan Dr. Meow, lalu perbarui catatan memori kucing secara singkat.`;

const USER_PROMPT = `Catatan memori kucing saat ini:
{current_memory}

Percakapan sesi ini:
{conversation}

Tulis catatan memori yang diperbarui. Aturan ketat:
- Hanya catat apa yang SECARA EKSPLISIT disebutkan pemilik (bukan saran Dr. Meow)
- Catat: gejala yang dialami, perilaku abnormal, alergi/pantangan, obat yang diberikan sendiri, kekhawatiran berkelanjutan, pola makan
- JANGAN catat: nilai lab (sudah di database), data profil (usia, ras, berat), saran umum, informasi umum tentang kucing
- Ganti info lama yang sudah tidak relevan, jangan sekadar menambah
- Jika tidak ada info baru yang penting, kembalikan catatan yang sudah ada tanpa perubahan
- Format: poin-poin singkat dalam Bahasa Indonesia
- Maksimal ${MAX_MEMORY_CHARS} karakter`;

export async function extractSessionMemory(
  cat: Cat,
  sessionId: string,
  messages: ChatSessionMessage[]
): Promise<void> {
  if (messages.length < MIN_MESSAGES_TO_EXTRACT) return;

  const conversation = messages
    .map((m) => `${m.role === "user" ? "Pemilik" : "Dr. Meow"}: ${m.content}`)
    .join("\n")
    .slice(0, 8000); // cap input to avoid huge token bills

  const prompt = USER_PROMPT
    .replace("{current_memory}", cat.memory_notes || "(belum ada catatan)")
    .replace("{conversation}", conversation);

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: prompt },
    ],
    temperature: 0.2,
    max_tokens: 400,
  });

  const newMemory = (response.choices[0]?.message?.content ?? "").slice(0, MAX_MEMORY_CHARS);
  if (!newMemory) return;

  // Save history entry first (for rollback)
  await supabaseAdmin.from("cat_memory_history").insert({
    cat_id: cat.id,
    session_id: sessionId,
    memory_notes: newMemory,
  });

  // Update cat's memory_notes
  await supabaseAdmin
    .from("cats")
    .update({ memory_notes: newMemory, updated_at: new Date().toISOString() })
    .eq("id", cat.id);
}
