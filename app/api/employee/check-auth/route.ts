import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { supabaseServer } from '@/lib/supabaseServer'
import { NextResponse } from 'next/server'

// Use the same interfaces as your owner auth
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
  description?: string;
}

interface Branch {
  id: string;
  name: string;
  address: string;
  is_active: boolean;
}

interface AssignmentWithJoins {
  shop_id: string;
  branch_id: string;
  role_in_shop: string;
  shops: Shop;
  shop_branches: Branch;
}

export async function GET() {
  try {
    // Use server-side client with getUser (recommended)
    const supabaseAuth = await supabaseServer()
    
    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser()
    
    if (userError) {
      console.error("Employee getUser error:", userError)
      return NextResponse.json({ authorized: false, error: "Authentication error" })
    }
    
    if (!user) {
      return NextResponse.json({ authorized: false, error: "Not authenticated" })
    }

    console.log("🔐 Employee check-auth: User authenticated - ID:", user.id)

    // Check for employee role
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

    console.log("📊 Employee check-auth role query result:", {
      hasRoles: !!roleData?.length,
      error: roleError?.message
    })

    if (roleError) {
      console.error("Employee Role query error:", roleError)
      return NextResponse.json({ authorized: false, error: "Failed to check permissions" })
    }

    if (!roleData || roleData.length === 0) {
      return NextResponse.json({ authorized: false, error: "No role assigned" })
    }

    // Check for employee role
    const hasEmployeeRole = roleData.some(role => role.roles?.name === 'employee')
    console.log("🎭 Employee check-auth hasEmployeeRole:", hasEmployeeRole)

    if (!hasEmployeeRole) {
      console.log("User roles:", roleData.map(r => r.roles?.name))
      return NextResponse.json({ authorized: false, error: "Employee access required" })
    }

    // Get employee assignments
    const { data: assignments, error: assignmentsError } = await supabaseAdmin
      .from('shop_user_assignments')
      .select(`
        shop_id,
        branch_id,
        role_in_shop,
        shops!inner (
          id,
          name,
          description
        ),
        shop_branches!inner (
          id, 
          name, 
          address, 
          is_active
        )
      `)
      .eq('user_id', user.id)
      .eq('is_active', true)
      .eq('role_in_shop', 'employee') as { data: AssignmentWithJoins[] | null, error: any }

    console.log("📋 Employee assignments result:", {
      assignmentsCount: assignments?.length,
      error: assignmentsError?.message
    })

    if (assignmentsError) {
      console.error("Employee Assignments error:", assignmentsError)
      return NextResponse.json({ authorized: false, error: "Error fetching assignments" })
    }

    // Transform assignments
    const transformedAssignments = (assignments || []).map(assignment => ({
      shop_id: assignment.shop_id,
      branch_id: assignment.branch_id,
      role_in_shop: assignment.role_in_shop,
      shop: assignment.shops,
      branch: assignment.shop_branches
    }));

    console.log("✅ Employee auth successful for:", user.email)

    if (transformedAssignments.length === 0) {
      return NextResponse.json({ 
        authorized: false, 
        error: "No active shop assignments found for employee" 
      })
    }

    return NextResponse.json({ 
      authorized: true,
      user: {
        id: user.id,
        email: user.email
      },
      assignments: transformedAssignments
    })

  } catch (error: any) {
    console.error("Employee auth check error:", error)
    return NextResponse.json({ 
      authorized: false, 
      error: error.message 
    }, { status: 500 })
  }
}