import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: NextRequest) {
  const { userId } = await req.json();

  if (!userId) return NextResponse.json({ error: "Missing userId" }, { status: 400 });

  // Server-side Supabase client with service role key
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    // 1️⃣ Delete the Auth user
    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (authError) throw authError;

    // 2️⃣ Delete any assignments in shop_user_assignments (optional, often cascades)
    const { error: assignError } = await supabaseAdmin
      .from("shop_user_assignments")
      .delete()
      .eq("user_id", userId);
    if (assignError) throw assignError;

    // 3️⃣ Delete user row in users table (optional if ON DELETE CASCADE exists)
    const { error: userError } = await supabaseAdmin.from("users").delete().eq("id", userId);
    if (userError) throw userError;

    return NextResponse.json({ message: "User deleted successfully" });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to delete user" }, { status: 500 });
  }
}
