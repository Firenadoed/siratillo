// app/api/admin/check-auth/route.ts
import { supabaseServer } from '@/lib/supabaseServer'
import { NextResponse } from 'next/server'

// Define proper types for the response
interface Role {
  name: string;
}

interface UserRoleWithArray {
  roles: Role[]; // Array structure
}

interface UserRoleWithObject {
  roles: Role; // Object structure
}

type UserRole = UserRoleWithArray | UserRoleWithObject;

export async function GET() {
  try {
    console.log("🔐 Check-auth: Starting authentication check...")
    
    const supabase = await supabaseServer()
    
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      console.log("🔐 No valid session found")
      return NextResponse.json({ authorized: false, error: "No session" })
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      console.log("🔐 User verification failed")
      return NextResponse.json({ authorized: false, error: "User verification failed" })
    }

    console.log("🔐 Checking roles for user:", user.id)
    
    // Use regular client - RLS policies will work now!
    const { data: roleData, error: roleError } = await supabase
      .from("user_roles")
      .select(`
        roles (
          name
        )
      `)
      .eq("user_id", user.id)

    console.log("🔐 Role query result:", { 
      roleData, 
      roleError: roleError?.message,
      count: roleData?.length 
    })

    if (roleError) {
      console.error("🔐 Role query error:", roleError)
      return NextResponse.json({ authorized: false, error: "Role query failed" })
    }

    if (!roleData || roleData.length === 0) {
      console.log("🔐 No roles found for user")
      return NextResponse.json({ authorized: false, error: "No roles found" })
    }

    // 🔥 FIXED: Handle the data structure correctly with type safety
    console.log("🔐 DEBUG - Full roleData:", JSON.stringify(roleData, null, 2))
    
    // Extract role names - handle the actual structure safely
    const roleNames = (roleData as UserRole[]).map(userRole => {
      const roles = userRole.roles;
      
      // Type-safe handling of both structures
      if (Array.isArray(roles)) {
        return roles[0]?.name; // If it's an array
      } else if (roles && typeof roles === 'object' && 'name' in roles) {
        return (roles as Role).name; // If it's an object with name property
      }
      return null;
    }).filter(Boolean) as string[];
    
    console.log("🔐 User roles:", roleNames)

    const isSuperadmin = roleNames.includes('superadmin')
    console.log("🔐 Is superadmin:", isSuperadmin)

    if (!isSuperadmin) {
      console.log("🔐 User is not superadmin")
      return NextResponse.json({ authorized: false, error: "Not superadmin" })
    }

    console.log("🔐 ✅ User authorized as superadmin")
    return NextResponse.json({ 
      authorized: true,
      user: {
        id: user.id,
        email: user.email,
        roles: roleNames
      }
    })

  } catch (error: any) {
    console.error("🔐 Auth check unexpected error:", error)
    return NextResponse.json({ authorized: false, error: error.message })
  }
}