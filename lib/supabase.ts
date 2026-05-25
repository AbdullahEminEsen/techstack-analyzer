import { createClient } from "@supabase/supabase-js";

// Bu client SADECE sunucu tarafında (API route'larda) kullanılır.
// service_role anahtarı RLS'i bypass eder, asla tarayıcıya sızmamalı.
const supabaseUrl = process.env.SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
