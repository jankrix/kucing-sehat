import { supabaseAdmin } from "../../config";
import { ChatSession } from "../../types";

export async function getOrCreate(
  catId: string,
  userId: string
): Promise<ChatSession> {
  // Return the most recent session for this cat
  const { data: existing } = await supabaseAdmin
    .from("chat_sessions")
    .select("*")
    .eq("cat_id", catId)
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .single();

  if (existing) return existing;

  const { data, error } = await supabaseAdmin
    .from("chat_sessions")
    .insert({ cat_id: catId, user_id: userId, messages: [] })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function createNew(
  catId: string,
  userId: string
): Promise<ChatSession> {
  const { data, error } = await supabaseAdmin
    .from("chat_sessions")
    .insert({ cat_id: catId, user_id: userId, messages: [] })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function appendMessages(
  sessionId: string,
  newMessages: Array<{ role: string; content: string; timestamp: string }>,
  title?: string
): Promise<void> {
  const { data: session } = await supabaseAdmin
    .from("chat_sessions")
    .select("messages, title")
    .eq("id", sessionId)
    .single();

  const messages = [...(session?.messages ?? []), ...newMessages];

  const update: Record<string, any> = {
    messages,
    updated_at: new Date().toISOString(),
  };
  // Auto-title from first user message if not set
  if (!session?.title && title) update.title = title.slice(0, 80);

  await supabaseAdmin
    .from("chat_sessions")
    .update(update)
    .eq("id", sessionId);
}

export async function listByCat(
  catId: string,
  userId: string
): Promise<Pick<ChatSession, "id" | "title" | "updated_at">[]> {
  const { data, error } = await supabaseAdmin
    .from("chat_sessions")
    .select("id,title,updated_at")
    .eq("cat_id", catId)
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(20);

  if (error) throw error;
  return data ?? [];
}

export async function getLatest(
  catId: string,
  userId: string
): Promise<ChatSession | null> {
  const { data } = await supabaseAdmin
    .from("chat_sessions")
    .select("*")
    .eq("cat_id", catId)
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .single();

  return data ?? null;
}

export async function getById(
  sessionId: string,
  userId: string
): Promise<ChatSession | null> {
  const { data, error } = await supabaseAdmin
    .from("chat_sessions")
    .select("*")
    .eq("id", sessionId)
    .eq("user_id", userId)
    .single();

  if (error && error.code !== "PGRST116") throw error;
  return data;
}
