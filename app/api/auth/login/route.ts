// app/api/auth/login/route.ts
import { supabaseServer } from '@/lib/supabaseServer'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { NextResponse } from 'next/server'
import { logActivity } from '@/lib/activity-logger'

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
    
    if (authError) {
      // ✅ LOG FAILED LOGIN ATTEMPT
      await logActivity({
        actorName: email,
        actorType: 'customer', // Default, will be updated if we know the actual type
        action: 'login_failed',
        entityType: 'user',
        entityId: email, // Using email as identifier since we don't have user ID yet
        entityName: email,
        description: `Failed login attempt for ${email}: ${authError.message}`,
        severity: 'warning',
        shopId: 'system' // Using 'system' for auth-related logs
      });
      
      throw authError;
    }
    
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
      // ✅ LOG LOGIN WITH NO ROLE ASSIGNED
      await logActivity({
        actorName: authData.user.email || 'Unknown',
        actorType: 'customer', // Default type
        action: 'login_failed',
        entityType: 'user',
        entityId: authData.user.id,
        entityName: authData.user.email || 'User',
        description: `User ${authData.user.email || authData.user.id} logged in but has no role assigned`,
        severity: 'warning',
        shopId: 'system'
      });
      
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

    // 4. Get user details for logging
    const { data: userDetails } = await supabaseAdmin
      .from('users')
      .select('full_name, phone')
      .eq('id', authData.user.id)
      .single();

    const actorName = userDetails?.full_name || authData.user.email || 'User';
    
    // Map role to actor type
    const roleToActorType: Record<string, 'customer' | 'employee' | 'driver' | 'system' | 'owner'> = {
      'customer': 'customer',
      'employee': 'employee',
      'delivery': 'driver',
      'owner': 'owner',
      'superadmin': 'system'
    };

    const actorType = roleToActorType[userRole] || 'customer';

    // 5. Get shop/branch assignment if applicable
    let shopId = 'system';
    let branchId: string | undefined = undefined;
    
    if (['employee', 'driver', 'owner'].includes(actorType)) {
      // Get shop assignment for non-customer roles
      const { data: assignment } = await supabaseAdmin
        .from('shop_user_assignments')
        .select('shop_id, branch_id')
        .eq('user_id', authData.user.id)
        .eq('is_active', true)
        .maybeSingle();
      
      if (assignment) {
        shopId = assignment.shop_id;
        branchId = assignment.branch_id;
      }
    }

    // ✅ LOG SUCCESSFUL LOGIN
    await logActivity({
      actorName,
      actorType,
      action: 'login_success',
      entityType: 'user',
      entityId: authData.user.id,
      entityName: actorName,
      description: `${actorName} (${userRole}) logged in successfully`,
      severity: 'info',
      branchId,
      shopId
    });

    // 6. Return role for redirect
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
      redirectTo: redirectPath,
      user: {
        id: authData.user.id,
        email: authData.user.email,
        role: userRole,
        name: actorName
      }
    })

  } catch (error: any) {
    console.error("💥 Login error:", error);
    
    // ✅ LOG GENERIC LOGIN ERROR
    try {
      await logActivity({
        actorName: email || 'Unknown',
        actorType: 'customer',
        action: 'login_failed',
        entityType: 'user',
        entityId: email || 'unknown',
        entityName: email || 'Unknown User',
        description: `Login error for ${email || 'unknown user'}: ${error.message}`,
        severity: 'error',
        shopId: 'system'
      });
    } catch (logError) {
      console.error("Failed to log login error:", logError);
    }
    
    return NextResponse.json(
      { error: error.message },
      { status: 400 }
    )
  }
}