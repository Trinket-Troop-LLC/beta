"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type SignInParams = {
  email: string;
  password: string;
  nextPath: string;
};

export async function signInWithPassword({
  email,
  password,
  nextPath,
}: SignInParams) {
  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { error: error.message };
  }

  // Cookies from signInWithPassword above are already queued on this same
  // response via the server client's setAll -> cookieStore.set. redirect()
  // throws internally and Next.js ships that redirect alongside those
  // Set-Cookie headers in one response, so the browser's next request
  // (for nextPath) is guaranteed to carry the session cookie. No race.
  redirect(nextPath);
}