// app/api/auth/login/route.ts
import { supabaseServer } from '@/lib/supabaseServer'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { NextResponse } from 'next/server'

// CORRECTED TypeScript interfaces
interface Role {
  name: string;
}

interface UserRole {
  user_id: string;
  role_id: string;
  roles: Role; // ← CHANGED: This is an object, not array!
}

export async function POST(request: Request) {
  const { email, password } = await request.json()
  
  try {
    console.log("🔐 STEP 1: Login attempt for:", email)

    // Use the proper async server client for authentication
    const supabaseAuth = await supabaseServer()
    
    // 1. Authenticate user - this will set the session cookies properly
    const { data: authData, error: authError } = await supabaseAuth.auth.signInWithPassword({
      email,
      password,
    })
    
    if (authError) throw authError
    if (!authData.user) throw new Error("No user found")

    console.log("✅ STEP 2: User authenticated - ID:", authData.user.id)

    // 2. Get the session to ensure cookies are properly set
    const { data: { session } } = await supabaseAuth.auth.getSession()
    console.log("🔐 Session established:", !!session)

    // 3. Query roles using ADMIN client (bypasses RLS) with CORRECT typing
    const { data: roleData, error: roleError } = await supabaseAdmin
      .from("user_roles")
      .select(`
        user_id,
        role_id,
        roles (
          name
        )
      `)
      .eq("user_id", authData.user.id) as { data: UserRole[] | null, error: any }

    console.log("📊 ROLE QUERY RESULT:", {
      data: roleData,
      error: roleError?.message,
      count: roleData?.length
    })

    if (roleError) {
      throw new Error("Failed to fetch user role: " + roleError.message)
    }

    if (!roleData || roleData.length === 0) {
      throw new Error("No role assigned. Please contact support.")
    }

    // DEBUG: Check the actual structure
    console.log("🔍 Full roleData[0]:", JSON.stringify(roleData[0], null, 2))

    // CORRECTED data access - roles is an object, not array!
    const userRole = roleData[0].roles?.name  // ← REMOVED [0]
    console.log("🎭 Extracted role:", userRole)

    if (!userRole) {
      throw new Error("Role name not found.")
    }

    // 4. Return role for redirect
    const roleRoutes: { [key: string]: string } = {
      'superadmin': '/admin',
      'owner': '/owner',
      'employee': '/employee',
      'delivery': '/delivery',
      'customer': '/customer'
    }

    const redirectPath = roleRoutes[userRole] || '/login'

    return NextResponse.json({ 
      success: true, 
      redirectTo: redirectPath 
    })

  } catch (error: any) {
    console.error("💥 Login error:", error)
    return NextResponse.json(
      { error: error.message },
      { status: 400 }
    )
  }
}