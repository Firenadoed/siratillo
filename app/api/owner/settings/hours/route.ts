import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { supabaseServer } from '@/lib/supabaseServer'
import { NextResponse } from 'next/server'

export async function PUT(request: Request) {
  try {
    const supabaseAuth = await supabaseServer()
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }

    const { branchId, hours } = await request.json()

    if (!branchId || !hours) {
      return NextResponse.json({ error: "Branch ID and hours are required" }, { status: 400 })
    }

    // Verify the branch belongs to user's shop
    const { data: branch, error: branchError } = await supabaseAdmin
      .from('shop_branches')
      .select('id, shop_id')
      .eq('id', branchId)
      .single()

    if (branchError || !branch) {
      return NextResponse.json({ error: "Branch not found" }, { status: 404 })
    }

    const { data: shop } = await supabaseAdmin
      .from('shops')
      .select('id')
      .eq('id', branch.shop_id)
      .eq('owner_id', user.id)
      .single()

    if (!shop) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    // Update operating hours
    for (const hour of hours) {
      const { error: upsertError } = await supabaseAdmin
        .from('branch_operating_hours')
        .upsert({
          branch_id: branchId,
          day_of_week: hour.day_of_week,
          open_time: hour.open_time,
          close_time: hour.close_time,
          is_closed: hour.is_closed,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'branch_id,day_of_week'
        })

      if (upsertError) {
        console.error('Hours upsert error:', upsertError)
        return NextResponse.json({ error: "Failed to update operating hours" }, { status: 500 })
      }
    }

    return NextResponse.json({ 
      success: true,
      message: 'Operating hours updated successfully'
    })

  } catch (error: any) {
    console.error('Hours update error:', error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}