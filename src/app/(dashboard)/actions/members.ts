"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/get-current-user";

export async function getAllMembers() {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") return [];

  const supabase = await createClient();

  const { data } = await supabase
    .from("users")
    .select("id, name, email, role, work_type, created_at")
    .order("created_at", { ascending: true });

  return data ?? [];
}
