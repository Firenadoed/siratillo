// app/api/owner/reports/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { verifyOwnerAccess } from '@/lib/owner-auth'

export async function GET(request: NextRequest) {
  try {
    const auth = await verifyOwnerAccess()
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: auth.status || 401 })
    }

    const { searchParams } = new URL(request.url)
    const branchId = searchParams.get('branch_id')
    
    if (!branchId) {
      return NextResponse.json({ error: 'Branch ID required' }, { status: 400 })
    }

    // Get all reports for this shop - ONLY columns that exist in your table
    const { data: reports, error } = await supabaseAdmin
      .from('issue_reports')
      .select(`
        id,
        type,
        description,
        status,
        customer_name,
        customer_email,
        created_at,
        resolved_at,
        notes,
        user_id,
        shop_id,
        branch_id
      `)
      .eq('shop_id', auth.shopId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching reports:', error)
      return NextResponse.json({ error: 'Failed to fetch reports' }, { status: 500 });
    }

    // Audit log
    try {
      await supabaseAdmin
        .from('admin_audit_logs')
        .insert({
          admin_id: auth.userId,
          action: 'view_shop_reports',
          description: `Viewed ${reports?.length || 0} reports for shop ${auth.shopId}`,
          ip_address: request.headers.get('x-forwarded-for') || 'unknown',
          user_agent: request.headers.get('user-agent') || 'unknown',
          created_at: new Date().toISOString()
        });
    } catch (auditError) {
      // Don't fail the request if audit logging fails
    }

    return NextResponse.json({ reports: reports || [] }, { status: 200 });
    
  } catch (error) {
    console.error('Error fetching reports:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const auth = await verifyOwnerAccess()
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: auth.status || 401 })
    }

    const { reportId, status } = await request.json()

    if (!reportId || !status) {
      return NextResponse.json({ error: 'Report ID and status required' }, { status: 400 })
    }

    // First verify the report belongs to this owner's shop
    const { data: reportCheck, error: checkError } = await supabaseAdmin
      .from('issue_reports')
      .select('shop_id')
      .eq('id', reportId)
      .single()

    if (checkError || !reportCheck) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 })
    }

    if (reportCheck.shop_id !== auth.shopId) {
      return NextResponse.json({ error: 'Unauthorized - report does not belong to your shop' }, { status: 403 })
    }

    // Update report status
    const { error } = await supabaseAdmin
      .from('issue_reports')
      .update({ 
        status, 
        resolved_at: status === 'resolved' ? new Date().toISOString() : null
      })
      .eq('id', reportId)

    if (error) {
      return NextResponse.json({ error: 'Failed to update report' }, { status: 500 });
    }

    // Audit log
    try {
      await supabaseAdmin
        .from('admin_audit_logs')
        .insert({
          admin_id: auth.userId,
          action: 'update_report_status',
          description: `Updated report ${reportId} status to ${status}`,
          ip_address: request.headers.get('x-forwarded-for') || 'unknown',
          user_agent: request.headers.get('user-agent') || 'unknown',
          created_at: new Date().toISOString()
        });
    } catch (auditError) {
      // Don't fail the request
    }

    return NextResponse.json({ success: true }, { status: 200 });
    
  } catch (error) {
    console.error('Error updating report:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}