// app/api/admin/owners/route.ts
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { NextResponse } from 'next/server'

// GET /api/admin/owners - Get all owners
export async function GET() {
  try {
    const { data: owners, error } = await supabaseAdmin
      .from('shop_user_assignments')
      .select(`
        user_id,
        role_in_shop,
        created_at,
        users(id, full_name, email),
        shops(id, name)
      `)
      .eq('role_in_shop', 'owner')
      .order('created_at', { ascending: false })

    if (error) throw error
    return NextResponse.json({ owners: owners || [] })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST /api/admin/owners - Create new owner
export async function POST(request: Request) {
  try {
    const { full_name, email, password, shop_id } = await request.json()
    
    if (!full_name?.trim() || !email?.trim() || !password || !shop_id) {
      return NextResponse.json({ 
        error: "Full name, email, password, and shop are required" 
      }, { status: 400 })
    }

    console.log("👤 Creating owner:", { full_name, email, shop_id })

    // 1. Create user with auth (admin API)
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email.trim(),
      password: password,
      email_confirm: true,
      user_metadata: { full_name: full_name.trim() }
    })

    if (authError) {
      console.error("Auth creation error:", authError)
      throw authError
    }
    if (!authData.user) throw new Error('Failed to create user')

    console.log("✅ Auth user created:", authData.user.id)

    // 2. Create user profile
    const { error: profileError } = await supabaseAdmin
      .from('users')
      .insert([{ 
        id: authData.user.id, 
        full_name: full_name.trim(), 
        email: email.trim()
      }])

    if (profileError) {
      console.error("Profile creation error:", profileError)
      throw profileError
    }

    console.log("✅ User profile created")

    // 3. Get owner role
    const { data: role, error: roleError } = await supabaseAdmin
      .from('roles')
      .select('id')
      .eq('name', 'owner')
      .single()

    if (roleError) {
      console.error("Role fetch error:", roleError)
      throw roleError
    }

    console.log("✅ Owner role found:", role.id)

    // 4. Assign role to user
    const { error: userRoleError } = await supabaseAdmin
      .from('user_roles')
      .insert([{ 
        user_id: authData.user.id, 
        role_id: role.id 
      }])

    if (userRoleError) {
      console.error("User role assignment error:", userRoleError)
      throw userRoleError
    }

    console.log("✅ User role assigned")

    // 5. Assign to shop in shop_user_assignments
    const { error: assignError } = await supabaseAdmin
      .from('shop_user_assignments')
      .insert([{ 
        user_id: authData.user.id, 
        shop_id, 
        role_in_shop: 'owner' 
      }])

    if (assignError) {
      console.error("Shop assignment error:", assignError)
      throw assignError
    }

    console.log("✅ Shop user assignment created")

    // 6. ✅ CRITICAL: Update the shops table with owner_id
    const { error: shopUpdateError } = await supabaseAdmin
      .from('shops')
      .update({ 
        owner_id: authData.user.id,
        updated_at: new Date().toISOString()
      })
      .eq('id', shop_id)

    if (shopUpdateError) {
      console.error("Shop update error:", shopUpdateError)
      throw shopUpdateError
    }

    console.log("✅ Shop owner_id updated")

    return NextResponse.json({ 
      success: true,
      owner: {
        id: authData.user.id,
        full_name: full_name.trim(),
        email: email.trim(),
        shop_id
      }
    })

  } catch (error: any) {
    console.error("💥 Owner creation error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}