import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Full-privilege client that bypasses Row Level Security. Only ever call this
 * from trusted server-side code that has already verified the caller is an
 * admin — this key grants unrestricted read/write to every table and the
 * ability to create/invite auth users.
 */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}
