import { createClient } from "@supabase/supabase-js";

// Use import.meta.env for Vite OR fallback to process.env for CRA
const SUPABASE_URL =
  import.meta.env?.VITE_SUPABASE_URL || process.env.REACT_APP_SUPABASE_URL;
const SUPABASE_ANON_KEY =
  import.meta.env?.VITE_SUPABASE_ANON_KEY || process.env.REACT_APP_SUPABASE_ANON_KEY;

// Fallback hardcoded values (only for local testing; replace these!)
const supabaseUrl =
  SUPABASE_URL || "https://vngnfsvbcwjfilgkczsg.supabase.co";
const supabaseAnonKey =
  SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZuZ25mc3ZiY3dqZmlsZ2tjenNnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjIxNDkwOCwiZXhwIjoyMDY3NzkwOTA4fQ.3cW1nl0IKCkZd6cQspsdVuauRHIb7E2PynkEHY-U2h8";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
