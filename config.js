// ============================================================
//  CONFIG — Conexión a Supabase
//  Esta llave es PÚBLICA y segura de exponer: tus reglas de
//  seguridad (RLS) protegen los datos. NO pongas acá la "secret".
// ============================================================

const SUPABASE_URL = "https://ggloisluiqdmmixplcjk.supabase.co";

// 👇 PEGÁ ACÁ tu llave PUBLISHABLE / anon (Supabase -> API Keys).
//    Empieza con "sb_publishable_..." o con "eyJ...".
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdnbG9pc2x1aXFkbW1peHBsY2prIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIyNTYyNDksImV4cCI6MjA5NzgzMjI0OX0.Nwu3mdXc6ocFoTLEGrvQA8pK2yb9iZGkjpAoQ3jz7hY";

// Crea el cliente global que usan todas las páginas.
window.sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
