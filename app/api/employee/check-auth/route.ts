// app/api/employee/check-auth/route.ts
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { supabaseServer } from '@/lib/supabaseServer'
import { NextResponse } from 'next/server'

// Use the same interface pattern as your login route
interface Role {
  name: string;
}

interface UserRole {
  user_id: string;
  role_id: string;
  roles: Role; // Single object, not array
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

// Match the pattern from your login route - single objects, not arrays
interface AssignmentWithJoins {
  shop_id: string;
  branch_id: string;
  role_in_shop: string;
  shops: Shop; // Single object
  shop_branches: Branch; // Single object
}

export async function GET() {
  try {
    const supabaseAuth = await supabaseServer()
    
    const { data: { session }, error: sessionError } = await supabaseAuth.auth.getSession()
    
    if (sessionError) {
      console.error("Session error:", sessionError)
      return NextResponse.json({ authorized: false, error: "Session error" })
    }
    
    if (!session) {
      return NextResponse.json({ authorized: false, error: "Not authenticated" })
    }

    console.log("🔐 Employee check-auth: User authenticated - ID:", session.user.id)

    // Use the same pattern as your login route with proper TypeScript casting
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
      return NextResponse.json({ authorized: false, error: "Failed to check permissions" })
    }

    if (!roleData || roleData.length === 0) {
      return NextResponse.json({ authorized: false, error: "No role assigned" })
    }

    // Use the same access pattern as your login route
    console.log("🔍 Full roleData[0]:", JSON.stringify(roleData[0], null, 2))
    
    const hasEmployeeRole = roleData.some(role => role.roles?.name === 'employee')
    console.log("🎭 Employee check-auth hasEmployeeRole:", hasEmployeeRole)

    if (!hasEmployeeRole) {
      console.log("User roles:", roleData.map(r => r.roles?.name))
      return NextResponse.json({ authorized: false, error: "Employee access required" })
    }

    // Get shop assignments with the same TypeScript pattern as login route
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
      .eq('user_id', session.user.id)
      .eq('is_active', true)
      .eq('role_in_shop', 'employee') as { data: AssignmentWithJoins[] | null, error: any }

    if (assignmentsError) {
      console.error("Assignments error:", assignmentsError)
      return NextResponse.json({ authorized: false, error: "Error fetching assignments: " + assignmentsError.message })
    }

    console.log("✅ Employee auth successful for:", session.user.email)
    console.log("🏪 Employee assignments raw:", assignments)

    // Simplify transformation - since we're using the same pattern as login, we don't need complex array handling
    const transformedAssignments = (assignments || []).map(assignment => ({
      shop_id: assignment.shop_id,
      branch_id: assignment.branch_id,
      role_in_shop: assignment.role_in_shop,
      shop: assignment.shops,
      branch: assignment.shop_branches
    }));

    console.log("🏪 Transformed assignments:", transformedAssignments);

    // Check if we have valid assignments
    if (transformedAssignments.length === 0) {
      return NextResponse.json({ 
        authorized: false, 
        error: "No active shop assignments found for employee" 
      })
    }

    return NextResponse.json({ 
      authorized: true,
      user: {
        id: session.user.id,
        email: session.user.email
      },
      assignments: transformedAssignments
    })

  } catch (error: any) {
    console.error("Employee auth check error:", error)
    return NextResponse.json({ 
      authorized: false, 
      error: error.message || "Internal server error"
    }, { status: 500 })
  }
}