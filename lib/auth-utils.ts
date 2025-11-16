// lib/admin-auth.ts
import { supabaseServer } from './supabaseServer'
import { supabaseAdmin } from './supabaseAdmin'

export type AuthResult = {
  authorized: boolean;
  error?: string;
  status?: number;
  userId?: string;
}

export async function verifyAdminAccess(): Promise<AuthResult> {
  try {
    const supabase = await supabaseServer()
    
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError || !user) {
      return { authorized: false, error: "Not authenticated", status: 401 }
    }

    // Check if user has admin role
    const { data: roleData, error: roleError } = await supabaseAdmin
      .from("user_roles")
      .select(`
        roles (
          name
        )
      `)
      .eq("user_id", user.id)

    if (roleError) {
      console.error("Admin auth - Role check error:", roleError)
      return { authorized: false, error: "Failed to check permissions", status: 500 }
    }

    // Handle the data structure safely
    const hasAdminRole = (roleData as any[])?.some((userRole: any) => {
      const role = userRole.roles;
      const roleName = Array.isArray(role) ? role[0]?.name : role?.name;
      return roleName === 'admin' || roleName === 'superadmin';
    })
    
    if (!hasAdminRole) {
      return { authorized: false, error: "Admin access required", status: 403 }
    }

    return { 
      authorized: true, 
      userId: user.id
    }

  } catch (error: any) {
    console.error("Admin auth - Unexpected error:", error)
    return { authorized: false, error: "Authentication failed", status: 500 }
  }
}

// Convenience function that throws error for use in endpoints
export async function requireAdmin(): Promise<{ userId: string }> {
  const result = await verifyAdminAccess()
  if (!result.authorized) {
    throw new Error(result.error || "Admin access required")
  }
  return { userId: result.userId! }
}

// Check if user has specific role
export async function hasRole(userId: string, roleName: string): Promise<boolean> {
  try {
    const { data: roleData } = await supabaseAdmin
      .from("user_roles")
      .select(`roles(name)`)
      .eq("user_id", userId)

    return (roleData as any[])?.some((userRole: any) => {
      const role = userRole.roles;
      const currentRoleName = Array.isArray(role) ? role[0]?.name : role?.name;
      return currentRoleName === roleName;
    }) || false

  } catch (error) {
    console.error("hasRole error:", error)
    return false
  }
}

// Get user roles
export async function getUserRoles(userId: string): Promise<string[]> {
  try {
    const { data: roleData } = await supabaseAdmin
      .from("user_roles")
      .select(`roles(name)`)
      .eq("user_id", userId)

    return (roleData as any[])?.map((userRole: any) => {
      const role = userRole.roles;
      return Array.isArray(role) ? role[0]?.name : role?.name;
    }).filter(Boolean) || []

  } catch (error) {
    console.error("getUserRoles error:", error)
    return []
  }
}