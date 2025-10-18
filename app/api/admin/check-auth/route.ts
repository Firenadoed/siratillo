// app/api/admin/check-auth/route.ts
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
  roles: Role; // ← Object, not array!
}

export async function GET() {
  try {
    // Use the same server client for session check as in login
    const supabaseAuth = await supabaseServer()
    
    const { data: { session }, error: sessionError } = await supabaseAuth.auth.getSession()
    
    if (sessionError) {
      console.error("Session error:", sessionError)
      return NextResponse.json({ authorized: false, error: "Session error" })
    }
    
    if (!session) {
      return NextResponse.json({ authorized: false, error: "Not authenticated" })
    }

    console.log("🔐 Check-auth: User authenticated - ID:", session.user.id)

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
      .eq("user_id", session.user.id) as { data: UserRole[] | null, error: any }

    console.log("📊 Check-auth role query result:", {
      data: roleData,
      error: roleError?.message,
      count: roleData?.length
    })

    if (roleError) {
      console.error("Role query error:", roleError)
      return NextResponse.json({ authorized: false, error: "Failed to check permissions" })
    }

    if (!roleData || roleData.length === 0) {
      return NextResponse.json({ authorized: false, error: "No role data found" })
    }

    // CORRECTED: roles is an object, not array
    const isSuperadmin = roleData[0].roles?.name === 'superadmin'
    console.log("🎭 Check-auth isSuperadmin:", isSuperadmin)

    if (!isSuperadmin) {
      return NextResponse.json({ authorized: false, error: "Superadmin access required" })
    }

    return NextResponse.json({ authorized: true })
  } catch (error: any) {
    console.error("Auth check error:", error)
    return NextResponse.json({ authorized: false, error: error.message })
  }
}