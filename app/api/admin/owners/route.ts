// app/api/admin/owners/route.ts
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { verifyAdminAccess } from '@/lib/auth-utils' // Import from your existing utils
import { NextResponse } from 'next/server'

// GET /api/admin/owners - Get all owners (Admin only)
export async function GET() {
  try {
    // 🔒 Use your existing auth utility
    const authResult = await verifyAdminAccess()
    if (!authResult.authorized) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status })
    }

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

    if (error) {
      return NextResponse.json({ error: "Failed to fetch owners" }, { status: 500 })
    }

    return NextResponse.json({ owners: owners || [] })
  } catch (error: any) {
    return NextResponse.json({ error: "Failed to fetch owners" }, { status: 500 })
  }
}

// POST /api/admin/owners - Create new owner (Admin only)
export async function POST(request: Request) {
  try {
    // 🔒 Use your existing auth utility
    const authResult = await verifyAdminAccess()
    if (!authResult.authorized) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status })
    }

    const { full_name, email, password, shop_id } = await request.json()
    
    // 🔒 Input validation
    if (!full_name?.trim() || !email?.trim() || !password || !shop_id) {
      return NextResponse.json({ 
        error: "Full name, email, password, and shop are required" 
      }, { status: 400 })
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      return NextResponse.json({ error: "Invalid email format" }, { status: 400 })
    }

    // Password strength
    if (password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 })
    }

    // UUID validation for shop_id
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(shop_id)) {
      return NextResponse.json({ error: "Invalid shop ID" }, { status: 400 })
    }

    // 🔒 Check if shop exists and doesn't already have an owner
    const { data: shop, error: shopError } = await supabaseAdmin
      .from('shops')
      .select('id, name, owner_id')
      .eq('id', shop_id)
      .single()

    if (shopError || !shop) {
      return NextResponse.json({ error: "Shop not found" }, { status: 404 })
    }

    if (shop.owner_id) {
      return NextResponse.json({ 
        error: "Shop already has an owner assigned" 
      }, { status: 400 })
    }

    // 🔒 Check for duplicate email
    const { data: existingUser, error: emailCheckError } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('email', email.trim())
      .maybeSingle()

    if (emailCheckError) {
      return NextResponse.json({ error: "Failed to validate email" }, { status: 500 })
    }

    if (existingUser) {
      return NextResponse.json({ error: "Email already registered" }, { status: 400 })
    }

    // 1. Create user with auth (admin API)
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email.trim(),
      password: password,
      email_confirm: true,
      user_metadata: { full_name: full_name.trim() }
    })

    if (authError) {
      return NextResponse.json({ error: "Failed to create user account" }, { status: 500 })
    }

    if (!authData.user) {
      return NextResponse.json({ error: "Failed to create user" }, { status: 500 })
    }

    // 2. Create user profile
    const { error: profileError } = await supabaseAdmin
      .from('users')
      .insert([{ 
        id: authData.user.id, 
        full_name: full_name.trim(), 
        email: email.trim()
      }])

    if (profileError) {
      // Cleanup auth user
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
      return NextResponse.json({ error: "Failed to create user profile" }, { status: 500 })
    }

    // 3. Get owner role
    const { data: role, error: roleError } = await supabaseAdmin
      .from('roles')
      .select('id')
      .eq('name', 'owner')
      .single()

    if (roleError || !role) {
      // Cleanup
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
      await supabaseAdmin.from('users').delete().eq('id', authData.user.id)
      return NextResponse.json({ error: "Failed to assign owner role" }, { status: 500 })
    }

    // 4. Assign role to user
    const { error: userRoleError } = await supabaseAdmin
      .from('user_roles')
      .insert([{ 
        user_id: authData.user.id, 
        role_id: role.id 
      }])

    if (userRoleError) {
      // Cleanup
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
      await supabaseAdmin.from('users').delete().eq('id', authData.user.id)
      return NextResponse.json({ error: "Failed to assign user role" }, { status: 500 })
    }

    // 5. Assign to shop in shop_user_assignments
    const { error: assignError } = await supabaseAdmin
      .from('shop_user_assignments')
      .insert([{ 
        user_id: authData.user.id, 
        shop_id, 
        role_in_shop: 'owner' 
      }])

    if (assignError) {
      // Cleanup
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
      await supabaseAdmin.from('users').delete().eq('id', authData.user.id)
      await supabaseAdmin.from('user_roles').delete().eq('user_id', authData.user.id)
      return NextResponse.json({ error: "Failed to assign shop" }, { status: 500 })
    }

    // 6. Update the shops table with owner_id
    const { error: shopUpdateError } = await supabaseAdmin
      .from('shops')
      .update({ 
        owner_id: authData.user.id,
        updated_at: new Date().toISOString()
      })
      .eq('id', shop_id)

    if (shopUpdateError) {
      // Cleanup
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
      await supabaseAdmin.from('users').delete().eq('id', authData.user.id)
      await supabaseAdmin.from('user_roles').delete().eq('user_id', authData.user.id)
      await supabaseAdmin.from('shop_user_assignments').delete().eq('user_id', authData.user.id)
      return NextResponse.json({ error: "Failed to update shop ownership" }, { status: 500 })
    }

    // 🔒 Audit log the owner creation
    try {
      await supabaseAdmin
        .from('admin_audit_logs')
        .insert({
          admin_id: authResult.userId,
          action: 'owner_creation',
          target_user_id: authData.user.id,
          target_shop_id: shop_id,
          target_shop_name: shop.name,
          description: `Created owner ${full_name.trim()} for shop: ${shop.name}`,
          created_at: new Date().toISOString()
        })
    } catch (auditError) {
      // Don't fail the request if audit logging fails
    }

    return NextResponse.json({ 
      success: true,
      owner: {
        id: authData.user.id,
        full_name: full_name.trim(),
        email: email.trim(),
        shop_id,
        shop_name: shop.name
      }
    })

  } catch (error: any) {
    return NextResponse.json({ error: "Failed to create owner" }, { status: 500 })
  }
}