// app/api/admin/pending-requests/delete/route.ts
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

export async function POST(request: NextRequest) {
  try {
    // 🔒 Verify admin authentication and authorization
    const authResult = await verifyAdminAccess()
    if (!authResult.authorized) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status })
    }

    const body = await request.json();
    const { requestId } = body;

    // 🔒 Input validation
    if (!requestId || typeof requestId !== 'string') {
      return NextResponse.json({ error: "Request ID is required" }, { status: 400 })
    }

    // UUID format validation
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(requestId)) {
      return NextResponse.json({ error: "Invalid request ID format" }, { status: 400 })
    }

    // 🔒 Verify the request exists before deletion
    const { data: existingRequest, error: checkError } = await supabaseAdmin
      .from('pending_shop_requests')
      .select('id, shop_name, email')
      .eq('id', requestId)
      .single()

    if (checkError || !existingRequest) {
      return NextResponse.json({ error: "Request not found" }, { status: 404 })
    }

    // 🔒 Perform deletion
    const { error } = await supabaseAdmin
      .from('pending_shop_requests')
      .delete()
      .eq('id', requestId)

    if (error) {
      return NextResponse.json({ error: "Failed to delete request" }, { status: 500 })
    }

    // 🔒 Audit log the deletion
    try {
      await supabaseAdmin
        .from('admin_audit_logs')
        .insert({
          admin_id: authResult.userId,
          action: 'delete_pending_request',
          target_request_id: requestId,
          target_shop_name: existingRequest.shop_name,
          description: `Deleted pending request: ${existingRequest.shop_name} (${existingRequest.email})`,
          ip_address: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
          user_agent: request.headers.get('user-agent') || 'unknown',
          created_at: new Date().toISOString()
        })
    } catch (auditError) {
      // Don't fail the request if audit logging fails
    }

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}