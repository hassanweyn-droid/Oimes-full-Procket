// ─────────────────────────────────────────────────────────────────────────────
// OIMES — Supabase clients
// Reads your project URL + anon key from .env (see .env.example).
//
// TWO SEPARATE CLIENTS, ON PURPOSE: the customer app and the admin portal
// both run at the same origin (localhost:5173), and Supabase's JS client
// keeps its session in localStorage under one key by default. Without doing
// this, logging into the admin portal in one tab would silently log the
// customer out in another tab (and vice versa), since they'd overwrite the
// same stored session. Giving each client its own `storageKey` keeps the two
// sessions completely independent.
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    '[OIMES] Supabase credentials are missing. Copy .env.example to .env and fill in ' +
      'VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY from your Supabase project settings (Settings → API).'
  );
}

// Customer app session
export const supabase = createClient(supabaseUrl ?? '', supabaseAnonKey ?? '', {
  auth: { storageKey: 'oimes-customer-auth' },
});

// Admin portal session — independent from the customer session above
export const supabaseAdmin = createClient(supabaseUrl ?? '', supabaseAnonKey ?? '', {
  auth: { storageKey: 'oimes-admin-auth-session' },
});

