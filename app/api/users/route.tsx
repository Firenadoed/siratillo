import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // ✅ Must be set in .env.local
)

export async function POST(req: Request) {
  try {
    const { email, password, name, role, shop_id } = await req.json()

    // Step 1: Create user in Supabase Auth
    const { data: userData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })
    if (authError) throw authError

    const userId = userData.user?.id
    if (!userId) throw new Error("User not created")

    // Step 2: Insert into custom users table
    const { error: insertError } = await supabaseAdmin.from("users").insert([
      { id: userId, name, email, password, role, shop_id },
    ])
    if (insertError) throw insertError

    return NextResponse.json({ success: true, userId })
  } catch (error: any) {
    console.error("Error creating user:", error)
    return NextResponse.json({ message: error.message }, { status: 500 })
  }
}
