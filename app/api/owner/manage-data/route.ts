import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { supabaseServer } from '@/lib/supabaseServer'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const supabaseAuth = await supabaseServer()
    
    const { data: { session }, error: sessionError } = await supabaseAuth.auth.getSession()
    
    if (sessionError || !session) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }

    // Get shop for this owner
    const { data: shop, error: shopError } = await supabaseAdmin
      .from("shops")
      .select("id")
      .eq("owner_id", session.user.id)
      .single()

    if (shopError || !shop) {
      return NextResponse.json({ error: "No shop found" }, { status: 404 })
    }

    // Get employees and deliverymen for this shop
    const { data: accounts, error: accountsError } = await supabaseAdmin
      .from("users")
      .select("id, name, email, role, created_at")
      .eq("shop_id", shop.id)
      .in("role", ["employee", "deliveryman"])
      .order("created_at", { ascending: false })

    if (accountsError) {
      return NextResponse.json({ error: "Failed to fetch accounts" }, { status: 500 })
    }

    return NextResponse.json({ 
      accounts: accounts || [],
      shopId: shop.id
    })

  } catch (error: any) {
    console.error("Manage accounts error:", error)
    return NextResponse.json({ 
      error: error.message 
    }, { status: 500 })
  }
}