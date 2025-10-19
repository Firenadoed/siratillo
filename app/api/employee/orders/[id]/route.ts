import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: orderId } = await params;
    const supabase = createRouteHandlerClient({ cookies });
    
    // Get current session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError || !session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { order_status } = await request.json();

    if (!order_status) {
      return NextResponse.json({ error: 'Order status required' }, { status: 400 });
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

    // Get order to verify branch assignment
    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .select('branch_id, order_status')
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // Verify employee is assigned to this branch
    const { data: assignment, error: assignmentError } = await supabaseAdmin
      .from('shop_user_assignments')
      .select('id')
      .eq('user_id', session.user.id)
      .eq('branch_id', order.branch_id)
      .eq('role_in_shop', 'employee')
      .eq('is_active', true)
      .single();

    if (assignmentError || !assignment) {
      return NextResponse.json({ error: 'Not authorized to update this order' }, { status: 403 });
    }

    // Update order status
    const { data: updatedOrder, error: updateError } = await supabaseAdmin
      .from('orders')
      .update({
        order_status,
        updated_at: new Date().toISOString()
      })
      .eq('id', orderId)
      .select(`
        *,
        customer:users(full_name, phone),
        branch:shop_branches(name, address),
        method:shop_methods(code, label)
      `)
      .single();

    if (updateError) {
      console.error('Update error:', updateError);
      return NextResponse.json({ error: 'Failed to update order' }, { status: 500 });
    }

    // Add to order history
    await supabaseAdmin
      .from('order_history')
      .insert({
        order_id: orderId,
        prev_status: order.order_status,
        new_status: order_status,
        changed_by: session.user.id,
        note: `Status updated by employee`
      });

    return NextResponse.json({ order: updatedOrder });

  } catch (error: any) {
    console.error('Update order error:', error);
    return NextResponse.json(
      { error: 'Failed to update order' },
      { status: 500 }
    );
  }
}