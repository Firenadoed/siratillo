// app/api/owner/shop-data/route.ts
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { supabaseServer } from '@/lib/supabaseServer'
import { NextResponse } from 'next/server'

// Define proper TypeScript interfaces
interface Role {
  name: string;
}

interface UserRole {
  user_id: string;
  role_id: string;
  roles: Role;
}

export async function GET() {
  try {
    // Use the same server client for session check as in login
    const supabaseAuth = await supabaseServer()
    
    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser()
    
    if (userError) {
      console.error("User error:", userError)
      return NextResponse.json({ error: "Authentication error" }, { status: 401 })
    }
    
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }

    console.log("🔐 Shop-data: User authenticated - ID:", user.id)

    // Use supabaseAdmin for role query (bypasses RLS)
    const { data: roleData, error: roleError } = await supabaseAdmin
      .from("user_roles")
      .select(`
        user_id,
        role_id,
        roles (
          name
        )
      `)
      .eq("user_id", user.id) as { data: UserRole[] | null, error: any }

    console.log("📊 Shop-data role query result:", {
      data: roleData,
      error: roleError?.message,
      count: roleData?.length
    })

    if (roleError) {
      console.error("Role query error:", roleError)
      return NextResponse.json({ error: "Failed to check permissions" }, { status: 500 })
    }

    if (!roleData || roleData.length === 0) {
      return NextResponse.json({ error: "No role assigned. Please contact support." }, { status: 403 })
    }

    const hasOwnerRole = roleData.some(role => role.roles?.name === 'owner')
    console.log("🎭 Shop-data hasOwnerRole:", hasOwnerRole)

    if (!hasOwnerRole) {
      console.log("User roles:", roleData.map(r => r.roles?.name))
      return NextResponse.json({ error: "Owner access required" }, { status: 403 })
    }

    console.log("✅ Owner verified, fetching shop data...")

    // Get shop data
    const { data: shop, error: shopError } = await supabaseAdmin
      .from('shops')
      .select('id, name, description, owner_id, logo_url, cover_image_url')
      .eq('owner_id', user.id)
      .single()

    if (shopError || !shop) {
      console.log("No shop found for owner:", user.id)
      return NextResponse.json({ 
        shop: null, 
        branches: [], 
        operatingHours: [],
        error: "No shop found for this owner" 
      })
    }

    console.log("🏪 Shop found:", shop.name)

    // Get branches
    const { data: branches, error: branchesError } = await supabaseAdmin
      .from('shop_branches')
      .select('id, name, address, shop_id, is_active')
      .eq('shop_id', shop.id)
      .eq('is_active', true)
      .order('created_at', { ascending: true })

    if (branchesError) {
      console.error("Branches fetch error:", branchesError)
    }

    console.log("📍 Found branches:", branches?.length || 0)

    // ✅ FIX: GET OPERATING HOURS FOR ALL BRANCHES
    let operatingHours: any[] = []
    
    if (branches && branches.length > 0) {
      const branchIds = branches.map(branch => branch.id)
      
      const { data: hoursData, error: hoursError } = await supabaseAdmin
        .from('branch_operating_hours')
        .select('*')
        .in('branch_id', branchIds)

      if (hoursError) {
        console.error("Operating hours fetch error:", hoursError)
      } else {
        operatingHours = hoursData || []
        console.log("🕒 Found operating hours:", operatingHours.length)
        console.log("📊 Operating hours sample:", operatingHours.slice(0, 2))
      }
    }

    return NextResponse.json({
      shop,
      branches: branches || [],
      operatingHours: operatingHours, // ✅ Now includes operating hours
      error: null
    })

  } catch (error: any) {
    console.error("Shop data error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}