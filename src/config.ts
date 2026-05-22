import { createClient, SupabaseClient } from "@supabase/supabase-js";
import OpenAI from "openai";

// Validate required environment variables
const required = ["OPENAI_API_KEY", "SUPABASE_URL", "SUPABASE_SERVICE_KEY", "SUPABASE_ANON_KEY"] as const;
for (const key of required) {
  if (!process.env[key]) {
    console.error(`Missing required env var: ${key}. Check your .env file.`);
    process.exit(1);
  }
}

// Supabase admin client (service key - for backend operations, bypasses RLS)
export const supabaseAdmin: SupabaseClient = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

// Supabase anon key (sent to frontend for client-side auth)
export const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY!;
export const SUPABASE_URL = process.env.SUPABASE_URL!;

// OpenAI client
export const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
