// app/api/admin/pending-requests/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { supabaseServer } from '@/lib/supabaseServer'

// Helper function to verify admin access
async function verifyAdminAccess() {
  try {
    const supabaseAuth = await supabaseServer()
    
    const { data: { session }, error: sessionError } = await supabaseAuth.auth.getSession()
    
    if (sessionError || !session) {
      return { authorized: false, error: "Not authenticated", status: 401 }
    }

    // Check if user has admin role
    const { data: roleData, error: roleError } = await supabaseAdmin
      .from("user_roles")
      .select(`
        user_id,
        role_id,
        roles (
          name
        )
      `)
      .eq("user_id", session.user.id)

    if (roleError) {
      return { authorized: false, error: "Failed to check permissions", status: 500 }
    }

    const hasAdminRole = roleData?.some(userRole => 
      userRole.roles?.some(role => 
        role.name === 'admin' || role.name === 'superadmin'
      )
    )
    
    if (!hasAdminRole) {
      return { authorized: false, error: "Admin access required", status: 403 }
    }

    return { 
      authorized: true, 
      userId: session.user.id
    }

  } catch (error: any) {
    return { authorized: false, error: "Authentication failed", status: 500 }
  }
}

export async function GET(request: NextRequest) {
  try {
    // 🔒 Verify admin authentication and authorization
    const authResult = await verifyAdminAccess()
    if (!authResult.authorized) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status })
    }

    // 🔒 Select only necessary fields (avoid sensitive data if possible)
    const { data: requests, error } = await supabaseAdmin
      .from('pending_shop_requests')
      .select(`
        id,
        name,
        email,
        contact,
        shop_name,
        shop_address,
        location_address,
        status,
        submitted_at,
        notes
        // ❌ EXCLUDED: latitude, longitude if sensitive
      `)
      .order('submitted_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: 'Failed to fetch requests' }, { status: 500 });
    }

    // 🔒 Audit log the access
    try {
      await supabaseAdmin
        .from('admin_audit_logs')
        .insert({
          admin_id: authResult.userId,
          action: 'view_pending_requests',
          description: `Viewed ${requests?.length || 0} pending shop requests`,
          ip_address: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
          user_agent: request.headers.get('user-agent') || 'unknown',
          created_at: new Date().toISOString()
        });
    } catch (auditError) {
      // Don't fail the request if audit logging fails
    }

    return NextResponse.json({ requests: requests || [] }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}