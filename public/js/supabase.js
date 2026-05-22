import { state } from './state.js';

let supabaseClient = null;

export async function initSupabase() {
  // Fetch config from server (non-secret values)
  const res = await fetch('/api/config');
  const { supabaseUrl, supabaseAnonKey } = await res.json();

  // Load Supabase client from CDN
  const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
  supabaseClient = createClient(supabaseUrl, supabaseAnonKey);

  // Listen for auth state changes
  supabaseClient.auth.onAuthStateChange((event, session) => {
    if (session) {
      state.setUser(session.user);
      state.setToken(session.access_token);
    } else {
      state.setUser(null);
      state.setToken(null);
    }
  });

  // Check existing session
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (session) {
    state.setUser(session.user);
    state.setToken(session.access_token);
  }

  return supabaseClient;
}

export function getSupabase() {
  return supabaseClient;
}

export async function signUp(email, password) {
  const { data, error } = await supabaseClient.auth.signUp({ email, password });
  if (error) throw error;
  return data;
}

export async function signIn(email, password) {
  const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await supabaseClient.auth.signOut();
  if (error) throw error;
}
