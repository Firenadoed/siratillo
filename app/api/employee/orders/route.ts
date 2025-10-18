import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    
    // Get current session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError || !session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Use service role client
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Get branch_id from query params
    const { searchParams } = new URL(request.url);
    const branchId = searchParams.get('branch_id');

    if (!branchId) {
      return NextResponse.json({ error: 'Branch ID required' }, { status: 400 });
    }

    // Verify employee is assigned to this branch
    const { data: assignment, error: assignmentError } = await supabaseAdmin
      .from('shop_user_assignments')
      .select('id')
      .eq('user_id', session.user.id)
      .eq('branch_id', branchId)
      .eq('role_in_shop', 'employee')
      .eq('is_active', true)
      .single();

    if (assignmentError || !assignment) {
      return NextResponse.json({ error: 'Not assigned to this branch' }, { status: 403 });
    }

    // Fetch orders for this branch with related data
    const { data: orders, error: ordersError } = await supabaseAdmin
      .from('orders')
      .select(`
        *,
        customer:users(full_name, phone),
        branch:shop_branches(name, address),
        method:shop_methods(code, label),
        order_items(
          quantity,
          subtotal,
          service:shop_services(
            name,
            price_per_kg
          )
        )
      `)
      .eq('branch_id', branchId)
      .order('created_at', { ascending: false });

    if (ordersError) {
      console.error('Orders fetch error:', ordersError);
      return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 });
    }

    return NextResponse.json({ orders: orders || [] });

  } catch (error: any) {
    console.error('Fetch orders error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch orders' },
      { status: 500 }
    );
  }
}