// app/api/employee/shop-data/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { supabaseServer } from '@/lib/supabaseServer'

export async function GET(request: NextRequest) {
  try {
    console.log('🔄 [SHOP DATA] Starting shop data API');
    
    const supabaseAuth = await supabaseServer()
    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser()
    
    if (userError || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const branchId = searchParams.get('branch_id');

    console.log('🏪 Branch ID from request:', branchId);

    if (!branchId) {
      return NextResponse.json({ error: 'Branch ID required' }, { status: 400 });
    }

    // Verify employee assignment
    const { data: assignment, error: assignmentError } = await supabaseAdmin
      .from('shop_user_assignments')
      .select('id, shop_id, user_id')
      .eq('user_id', user.id)
      .eq('branch_id', branchId)
      .eq('role_in_shop', 'employee')
      .eq('is_active', true)
      .single();

    if (assignmentError || !assignment) {
      return NextResponse.json({ 
        error: 'Not assigned to this branch'
      }, { status: 403 });
    }

    console.log('✅ Employee assignment verified for shop data');

    // Fetch all required data in parallel
    const [
      servicesResponse,
      detergentsResponse, 
      softenersResponse,
      methodsResponse
    ] = await Promise.all([
      // 1. Get services for this branch
      supabaseAdmin
        .from('shop_services')
        .select('id, name, price_per_kg, description')
        .eq('branch_id', branchId)
        .eq('is_active', true)
        .order('name'),

      // 2. Get available detergents for this branch
      supabaseAdmin
        .from('branch_detergents')
        .select(`
          id,
          custom_price,
          is_available,
          detergent:detergent_types(
            id,
            name,
            base_price,
            description
          )
        `)
        .eq('branch_id', branchId)
        .eq('is_available', true)
        .order('display_order'),

      // 3. Get available softeners for this branch
      supabaseAdmin
        .from('branch_softeners')
        .select(`
          id,
          custom_price,
          is_available,
          softener:softener_types(
            id,
            name,
            base_price,
            description
          )
        `)
        .eq('branch_id', branchId)
        .eq('is_available', true)
        .order('display_order'),

      // 4. Get available methods for this branch (EXCLUDE PICKUP)
      supabaseAdmin
        .from('branch_methods')
        .select(`
          is_enabled,
          method:shop_methods(
            id,
            code,
            label
          )
        `)
        .eq('branch_id', branchId)
        .eq('is_enabled', true)
        .neq('method.code', 'pickup') // Exclude pickup method
    ]);

    // Handle responses
    if (servicesResponse.error) {
      console.error('❌ Error fetching services:', servicesResponse.error);
      return NextResponse.json({ error: 'Failed to fetch services' }, { status: 500 });
    }

    if (detergentsResponse.error) {
      console.error('❌ Error fetching detergents:', detergentsResponse.error);
      return NextResponse.json({ error: 'Failed to fetch detergents' }, { status: 500 });
    }

    if (softenersResponse.error) {
      console.error('❌ Error fetching softeners:', softenersResponse.error);
      return NextResponse.json({ error: 'Failed to fetch softeners' }, { status: 500 });
    }

    if (methodsResponse.error) {
      console.error('❌ Error fetching methods:', methodsResponse.error);
      return NextResponse.json({ error: 'Failed to fetch methods' }, { status: 500 });
    }

    // Transform data for frontend with proper type handling
    const services = servicesResponse.data || [];
    
    // Fix for detergents - properly access nested properties
    const detergents = (detergentsResponse.data || []).map((item: any) => {
      const detergentData = item.detergent;
      return {
        id: detergentData?.id,
        name: detergentData?.name,
        base_price: detergentData?.base_price,
        custom_price: item.custom_price,
        final_price: item.custom_price || detergentData?.base_price || 0,
        is_available: item.is_available,
        description: detergentData?.description
      };
    }).filter((d: any) => d.id); // Filter out any null entries

    // Fix for softeners - properly access nested properties
    const softeners = (softenersResponse.data || []).map((item: any) => {
      const softenerData = item.softener;
      return {
        id: softenerData?.id,
        name: softenerData?.name,
        base_price: softenerData?.base_price,
        custom_price: item.custom_price,
        final_price: item.custom_price || softenerData?.base_price || 0,
        is_available: item.is_available,
        description: softenerData?.description
      };
    }).filter((s: any) => s.id); // Filter out any null entries

    // Fix for methods - properly access nested properties and EXCLUDE PICKUP
    const methods = (methodsResponse.data || []).map((item: any) => {
      const methodData = item.method;
      return {
        code: methodData?.code,
        label: methodData?.label,
        enabled: item.is_enabled
      };
    }).filter((m: any) => m.code && m.code !== 'pickup'); // Filter out pickup and null entries

    console.log('📊 Shop data results:', {
      services: services.length,
      detergents: detergents.length,
      softeners: softeners.length,
      methods: methods.length
    });

    return NextResponse.json({
      services,
      detergents,
      softeners,
      methods
    });

  } catch (error: any) {
    console.error('💥 Shop data API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch shop data: ' + error.message },
      { status: 500 }
    );
  }
}