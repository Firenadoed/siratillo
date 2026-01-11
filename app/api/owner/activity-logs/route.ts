// app/api/owner/activity-logs/route.ts
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { supabaseServer } from '@/lib/supabaseServer'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const branchId = searchParams.get('branch_id')
    const limit = searchParams.get('limit') || '10'
    
    console.log('📝 Activity logs API called:', { branchId, limit })

    // 1. Check session (same as dashboard)
    const supabaseAuth = await supabaseServer()
    const { data: { session } } = await supabaseAuth.auth.getSession()

    if (!session) {
      return NextResponse.json({ 
        logs: [],
        error: "Not authenticated" 
      }, { status: 401 })
    }

    console.log("📝 Activity logs for owner:", session.user.id)

    // 2. Verify owner role (same as dashboard)
    const { data: roleData } = await supabaseAdmin
      .from("user_roles")
      .select(`
        user_id,
        roles (name)
      `)
      .eq("user_id", session.user.id)

    const hasOwnerRole = roleData?.some((role: any) => role.roles?.name === 'owner')
    if (!hasOwnerRole) {
      return NextResponse.json({ 
        logs: [],
        error: "Owner access required" 
      }, { status: 403 })
    }

    // 3. Get owner's shop (same as dashboard)
    const { data: shop, error: shopError } = await supabaseAdmin
      .from('shops')
      .select('id, name')
      .eq('owner_id', session.user.id)
      .single()

    if (shopError || !shop) {
      console.log("⚠️ No shop found for owner:", session.user.id)
      return NextResponse.json({ 
        logs: [],
        error: "No shop found for this owner"
      })
    }

    console.log('🏪 Shop found:', shop.name)

    // 4. Handle branch filtering
    let branchIds: string[] = []
    
    if (branchId) {
      // Single branch mode - verify it belongs to owner's shop
      const { data: branch, error: branchError } = await supabaseAdmin
        .from('shop_branches')
        .select('id, shop_id')
        .eq('id', branchId)
        .eq('is_active', true)
        .single()

      if (branchError || !branch) {
        return NextResponse.json({ 
          logs: [],
          error: "Invalid branch" 
        }, { status: 400 })
      }

      if (branch.shop_id !== shop.id) {
        return NextResponse.json({ 
          logs: [],
          error: "Branch access denied" 
        }, { status: 403 })
      }

      branchIds = [branchId]
    } else {
      // All branches mode
      const { data: branches, error: branchesError } = await supabaseAdmin
        .from('shop_branches')
        .select('id')
        .eq('shop_id', shop.id)
        .eq('is_active', true)

      if (branchesError || !branches) {
        console.log("📝 No branches found for shop")
        // Return empty if no branches
        return NextResponse.json({ 
          logs: [],
          shop: shop
        })
      }

      branchIds = branches.map(branch => branch.id)
    }

    // 5. Query activity logs
    let query = supabaseAdmin
      .from('activity_logs')
      .select('*')
      .eq('shop_id', shop.id)
      .order('created_at', { ascending: false })
      .limit(parseInt(limit))

    // Filter by branch if provided
    if (branchId) {
      query = query.eq('branch_id', branchId)
    } else if (branchIds.length > 0) {
      // If no branch specified, show logs from all branches
      query = query.in('branch_id', branchIds)
    }

    const { data: logs, error: logsError } = await query

    if (logsError) {
      console.error('❌ Database query error:', logsError.message)
      // Return empty array instead of error
      return NextResponse.json({ 
        logs: [],
        shop: shop,
        debug: 'Query error, returning empty'
      })
    }

    console.log(`✅ Found ${logs?.length || 0} activity logs for shop: ${shop.name}`)
    
    // 6. If no logs, check if table has any data at all
    if (!logs || logs.length === 0) {
      // Check if table exists and has any data
      const { count } = await supabaseAdmin
        .from('activity_logs')
        .select('*', { count: 'exact', head: true })
        .limit(1)
      
      if (count === 0) {
        console.log('📝 Activity logs table is empty')
        return NextResponse.json({
          logs: getMockLogs(shop.id),
          shop: shop,
          debug: 'Using mock data - table empty',
          message: 'No activity logs found. Add logging to your APIs.'
        })
      }
    }
    
    // 7. Return logs
    return NextResponse.json({
      logs: logs || [],
      shop: {
        id: shop.id,
        name: shop.name
      },
      count: logs?.length || 0,
      branch: branchId ? { id: branchId } : null
    })

  } catch (error) {
    console.error('🔥 Activity logs API error:', error)
    return NextResponse.json({ 
      logs: getMockLogs(),
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

// Helper function for mock data
function getMockLogs(shopId?: string): any[] {
  return [
    {
      id: 'mock-1',
      created_at: new Date().toISOString(),
      actor_name: 'Customer',
      actor_type: 'customer',
      action: 'order_created',
      entity_type: 'order',
      entity_name: 'Order #1001',
      description: 'New laundry order placed for ₱350',
      severity: 'info',
      shop_id: shopId || 'mock-shop-id',
      branch_id: null
    },
    {
      id: 'mock-2',
      created_at: new Date(Date.now() - 3600000).toISOString(),
      actor_name: 'System',
      actor_type: 'system',
      action: 'payment_received',
      entity_type: 'payment',
      entity_name: 'Payment #2001',
      description: 'Payment of ₱250 processed successfully',
      severity: 'info',
      shop_id: shopId || 'mock-shop-id',
      branch_id: null
    },
    {
      id: 'mock-3',
      created_at: new Date(Date.now() - 7200000).toISOString(),
      actor_name: 'Employee',
      actor_type: 'employee',
      action: 'delivery_assigned',
      entity_type: 'delivery',
      entity_name: 'Delivery #3001',
      description: 'Delivery assigned to driver',
      severity: 'info',
      shop_id: shopId || 'mock-shop-id',
      branch_id: null
    }
  ]
}