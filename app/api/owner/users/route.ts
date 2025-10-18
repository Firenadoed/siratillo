// app/api/owner/users/route.ts
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

interface Shop {
  id: string;
  name: string;
}

interface Branch {
  id: string;
  name: string;
  shop_id: string;
}

interface ShopUserAssignment {
  user_id: string;
  shop_id: string;
  branch_id: string;
  role_in_shop: string;
}

interface User {
  id: string;
  full_name: string;
  email: string;
  created_at: string;
}

// Helper function to verify owner access
async function verifyOwnerAccess() {
  try {
    console.log("🔐 Verifying owner access...")
    const supabaseAuth = await supabaseServer()
    
    const { data: { session }, error: sessionError } = await supabaseAuth.auth.getSession()
    
    if (sessionError) {
      console.error("Session error:", sessionError)
      return { authorized: false, error: "Session error", status: 401 }
    }
    
    if (!session) {
      console.log("No session found")
      return { authorized: false, error: "Not authenticated", status: 401 }
    }

    console.log("✅ User authenticated:", session.user.id)

    // Check if user has owner role
    const { data: roleData, error: roleError } = await supabaseAdmin
      .from("user_roles")
      .select(`
        user_id,
        role_id,
        roles (
          name
        )
      `)
      .eq("user_id", session.user.id) as { data: UserRole[] | null, error: any }

    if (roleError) {
      console.error("Role query error:", roleError)
      return { authorized: false, error: "Failed to check permissions", status: 500 }
    }

    console.log("📋 Role data:", roleData)

    const hasOwnerRole = roleData?.some(role => role.roles?.name === 'owner')
    console.log("🎭 Has owner role:", hasOwnerRole)
    
    if (!hasOwnerRole) {
      const roles = roleData?.map(r => r.roles?.name).join(', ') || 'none'
      console.log(`User has roles: ${roles}`)
      return { authorized: false, error: "Owner access required", status: 403 }
    }

    // Get owner's shop and branches
    const { data: shop, error: shopError } = await supabaseAdmin
      .from("shops")
      .select("id, name")
      .eq("owner_id", session.user.id)
      .single() as { data: Shop | null, error: any }

    if (shopError) {
      console.error("Shop query error:", shopError)
      return { authorized: false, error: "No shop found for this owner", status: 404 }
    }

    if (!shop) {
      console.log("No shop found for user:", session.user.id)
      return { authorized: false, error: "No shop found for this owner", status: 404 }
    }

    // Get all branches for this shop
    const { data: branches, error: branchesError } = await supabaseAdmin
      .from("shop_branches")
      .select("id, name, shop_id")
      .eq("shop_id", shop.id)
      .eq("is_active", true) as { data: Branch[] | null, error: any }

    if (branchesError) {
      console.error("Branches query error:", branchesError)
      return { authorized: false, error: "Failed to fetch branches", status: 500 }
    }

    console.log("🏪 Shop found:", shop.id, "with", branches?.length, "branches")

    return { 
      authorized: true, 
      userId: session.user.id,
      shopId: shop.id,
      shopName: shop.name,
      branches: branches || []
    }

  } catch (error: any) {
    console.error("Error in verifyOwnerAccess:", error)
    return { authorized: false, error: error.message, status: 500 }
  }
}

// GET - Fetch all users for owner's shop with branch info
export async function GET() {
  try {
    console.log("🚀 GET /api/owner/users called")
    
    const authResult = await verifyOwnerAccess()
    console.log("🔑 Auth result:", authResult)
    
    if (!authResult.authorized) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status })
    }

    // Get users with their branch assignments
    const { data: assignments, error: assignmentsError } = await supabaseAdmin
      .from("shop_user_assignments")
      .select(`
        user_id,
        role_in_shop,
        branch_id,
        users (
          id,
          full_name,
          email,
          created_at
        ),
        branch:shop_branches(
          id,
          name
        )
      `)
      .eq("shop_id", authResult.shopId)
      .in("role_in_shop", ["employee", "delivery"])
      .eq("is_active", true) as { data: any[] | null, error: any }

    if (assignmentsError) {
      console.error("Assignments query error:", assignmentsError)
      return NextResponse.json({ error: "Failed to fetch accounts: " + assignmentsError.message }, { status: 500 })
    }

    console.log(`📊 Found ${assignments?.length || 0} assignments`)

    // Transform data to match frontend expectations
    const transformedAccounts = assignments?.map(assignment => ({
      id: assignment.users.id,
      name: assignment.users.full_name || "No Name",
      email: assignment.users.email,
      role: assignment.role_in_shop === "delivery" ? "deliveryman" : assignment.role_in_shop,
      branch_id: assignment.branch_id,
      branch_name: assignment.branch?.name || "No Branch",
      created_at: assignment.users.created_at
    })) || []

    console.log("📋 Transformed accounts:", transformedAccounts)

    return NextResponse.json({ 
      accounts: transformedAccounts,
      shopId: authResult.shopId,
      shopName: authResult.shopName,
      branches: authResult.branches
    })

  } catch (error: any) {
    console.error("💥 GET /api/owner/users error:", error)
    return NextResponse.json({ 
      error: "Internal server error: " + error.message 
    }, { status: 500 })
  }
}

// POST - Create new user (employee/deliveryman) with branch assignment
export async function POST(request: Request) {
  try {
    console.log("🚀 POST /api/owner/users called")
    
    const authResult = await verifyOwnerAccess()
    if (!authResult.authorized) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status })
    }

    const body = await request.json()
    console.log("📦 Request body:", body)
    
    const { email, password, name, role, branch_id } = body

    if (!email || !password || !name || !role || !branch_id) {
      return NextResponse.json({ 
        error: "Missing required fields: email, password, name, role, and branch_id are required" 
      }, { status: 400 })
    }

    // Validate branch belongs to owner's shop
    const isValidBranch = authResult.branches.some(branch => branch.id === branch_id)
    if (!isValidBranch) {
      return NextResponse.json({ 
        error: "Invalid branch selected" 
      }, { status: 400 })
    }

    // Map frontend role to database role
    const dbRole = role === "deliveryman" ? "delivery" : role
    
    if (!["employee", "delivery"].includes(dbRole)) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 })
    }

    console.log(`👤 Creating ${dbRole}: ${name} (${email}) for branch: ${branch_id}`)

    // Create user in auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { 
        name: name,
        role: dbRole, 
        shop_id: authResult.shopId,
        branch_id: branch_id
      }
    })

    if (authError) {
      console.error("Auth create error:", authError)
      return NextResponse.json({ error: `Failed to create user: ${authError.message}` }, { status: 400 })
    }

    console.log("✅ Auth user created:", authData.user.id)

    // Step 1: Create user in users table
    const { error: userError } = await supabaseAdmin
      .from('users')
      .insert({
        id: authData.user.id,
        email: email,
        full_name: name,
      })

    if (userError) {
      // Clean up auth user if DB insert fails
      console.error("User insert error, cleaning up auth user...")
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
      console.error("User insert error:", userError)
      return NextResponse.json({ error: `Failed to create user record: ${userError.message}` }, { status: 400 })
    }

    console.log("✅ User record created successfully")

    // Step 2: Add to user_roles table
    const { data: roleData, error: roleLookupError } = await supabaseAdmin
      .from('roles')
      .select('id')
      .eq('name', dbRole)
      .single()

    if (roleLookupError || !roleData) {
      console.error("Role lookup error:", roleLookupError)
      // Clean up
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
      await supabaseAdmin.from('users').delete().eq('id', authData.user.id)
      return NextResponse.json({ error: `Failed to find role: ${dbRole}` }, { status: 400 })
    }

    const { error: userRoleError } = await supabaseAdmin
      .from('user_roles')
      .insert({
        user_id: authData.user.id,
        role_id: roleData.id
      })

    if (userRoleError) {
      console.error("User role insert error:", userRoleError)
      // Clean up
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
      await supabaseAdmin.from('users').delete().eq('id', authData.user.id)
      return NextResponse.json({ error: `Failed to assign role: ${userRoleError.message}` }, { status: 400 })
    }

    console.log("✅ User role assigned successfully")

    // Step 3: Add to shop_user_assignments table with branch
    const { error: assignmentError } = await supabaseAdmin
      .from('shop_user_assignments')
      .insert({
        user_id: authData.user.id,
        shop_id: authResult.shopId,
        branch_id: branch_id,
        role_in_shop: dbRole,
        is_active: true
      })

    if (assignmentError) {
      console.error("Shop assignment error:", assignmentError)
      // Clean up
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
      await supabaseAdmin.from('users').delete().eq('id', authData.user.id)
      await supabaseAdmin.from('user_roles').delete().eq('user_id', authData.user.id)
      return NextResponse.json({ error: `Failed to assign to shop: ${assignmentError.message}` }, { status: 400 })
    }

    console.log("✅ Shop assignment created successfully with branch")

    return NextResponse.json({ 
      success: true,
      user: {
        id: authData.user.id,
        email,
        name,
        role,
        branch_id
      }
    })

  } catch (error: any) {
    console.error("💥 POST /api/owner/users error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// PUT - Update user (including branch assignment)
export async function PUT(request: Request) {
  try {
    const authResult = await verifyOwnerAccess()
    if (!authResult.authorized) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status })
    }

    const { id, name, password, branch_id } = await request.json()

    if (!id) {
      return NextResponse.json({ error: "User ID required" }, { status: 400 })
    }

    // Verify the user belongs to owner's shop
    const { data: assignment, error: assignmentError } = await supabaseAdmin
      .from('shop_user_assignments')
      .select('user_id, branch_id')
      .eq('user_id', id)
      .eq('shop_id', authResult.shopId)
      .single() as { data: { user_id: string; branch_id: string } | null, error: any }

    if (assignmentError || !assignment) {
      return NextResponse.json({ error: "User not found or access denied" }, { status: 404 })
    }

    // Update user's name
    const { error: updateError } = await supabaseAdmin
      .from('users')
      .update({ full_name: name })
      .eq('id', id)

    if (updateError) {
      return NextResponse.json({ error: `Failed to update user: ${updateError.message}` }, { status: 400 })
    }

    // Update branch assignment if provided
    if (branch_id) {
      // Validate new branch belongs to owner's shop
      const isValidBranch = authResult.branches.some(branch => branch.id === branch_id)
      if (!isValidBranch) {
        return NextResponse.json({ error: "Invalid branch selected" }, { status: 400 })
      }

      const { error: branchUpdateError } = await supabaseAdmin
        .from('shop_user_assignments')
        .update({ branch_id })
        .eq('user_id', id)
        .eq('shop_id', authResult.shopId)

      if (branchUpdateError) {
        return NextResponse.json({ error: `Failed to update branch: ${branchUpdateError.message}` }, { status: 400 })
      }
    }

    // Update password if provided
    if (password) {
      const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(
        id,
        { password }
      )
      if (authError) {
        console.error("Password update error:", authError)
        // Don't fail the entire request if password update fails
      }
    }

    return NextResponse.json({ success: true })

  } catch (error: any) {
    console.error("Update user error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// DELETE - Delete user (soft delete from shop_user_assignments)
export async function DELETE(request: Request) {
  try {
    const authResult = await verifyOwnerAccess()
    if (!authResult.authorized) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status })
    }

    const { id } = await request.json()

    if (!id) {
      return NextResponse.json({ error: "User ID required" }, { status: 400 })
    }

    // Verify the user belongs to owner's shop
    const { data: assignment, error: assignmentError } = await supabaseAdmin
      .from('shop_user_assignments')
      .select('user_id')
      .eq('user_id', id)
      .eq('shop_id', authResult.shopId)
      .single() as { data: { user_id: string } | null, error: any }

    if (assignmentError || !assignment) {
      return NextResponse.json({ error: "User not found or access denied" }, { status: 404 })
    }

    // Delete from shop_user_assignments (soft delete by setting is_active to false)
    const { error: assignmentUpdateError } = await supabaseAdmin
      .from('shop_user_assignments')
      .update({ is_active: false })
      .eq('user_id', id)
      .eq('shop_id', authResult.shopId)

    if (assignmentUpdateError) {
      console.error("Assignment update error:", assignmentUpdateError)
      return NextResponse.json({ error: "Failed to delete user" }, { status: 500 })
    }

    return NextResponse.json({ success: true })

  } catch (error: any) {
    console.error("Delete user error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}