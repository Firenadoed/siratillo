// app/api/owner/reports/count/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { verifyOwnerAccess } from '@/lib/owner-auth'

export async function GET(request: NextRequest) {
  try {
    const auth = await verifyOwnerAccess()
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: auth.status || 401 })
    }

    // Count pending reports for this owner's shop
    const { count, error } = await supabaseAdmin
      .from('issue_reports')
      .select('*', { count: 'exact', head: true })
      .eq('shop_id', auth.shopId)
      .eq('status', 'pending')

    if (error) {
      console.error('Error counting reports:', error)
      return NextResponse.json({ error: 'Failed to count reports' }, { status: 500 });
    }

    return NextResponse.json({ count: count || 0 }, { status: 200 });
    
  } catch (error) {
    console.error('Error counting reports:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}