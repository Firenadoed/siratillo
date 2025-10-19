import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { supabaseServer } from '@/lib/supabaseServer'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  try {
    const supabaseAuth = await supabaseServer()
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const branchId = searchParams.get('branch_id')

    if (!branchId) {
      return NextResponse.json({ error: 'Branch ID is required' }, { status: 400 })
    }

    // Verify the branch belongs to owner's shop
    const { data: shop } = await supabaseAdmin
      .from('shops')
      .select('id')
      .eq('owner_id', user.id)
      .single()

    if (!shop) {
      return NextResponse.json({ error: "No shop found" }, { status: 404 })
    }

    const { data: branch } = await supabaseAdmin
      .from('shop_branches')
      .select('id, shop_id')
      .eq('id', branchId)
      .eq('shop_id', shop.id)
      .eq('is_active', true)
      .single()

    if (!branch) {
      return NextResponse.json({ error: "Invalid branch" }, { status: 400 })
    }

    // Get shop data
    const { data: shopData, error: shopError } = await supabaseAdmin
      .from('shops')
      .select('id, name, description, logo_url, cover_image_url')
      .eq('id', shop.id)
      .single()

    if (shopError) {
      console.error('Error fetching shop:', shopError)
      return NextResponse.json({ error: 'Failed to fetch shop data' }, { status: 500 })
    }

    // Get contacts
    const { data: contacts, error: contactsError } = await supabaseAdmin
      .from('branch_contacts')
      .select('*')
      .eq('branch_id', branchId)
      .order('is_primary', { ascending: false })

    if (contactsError) {
      console.error('Error fetching contacts:', contactsError)
      return NextResponse.json({ error: 'Failed to fetch contacts' }, { status: 500 })
    }

    // Get operating hours
    const { data: operatingHours, error: hoursError } = await supabaseAdmin
      .from('branch_operating_hours')
      .select('*')
      .eq('branch_id', branchId)
      .order('day_of_week')

    if (hoursError) {
      console.error('Error fetching operating hours:', hoursError)
      return NextResponse.json({ error: 'Failed to fetch operating hours' }, { status: 500 })
    }

    return NextResponse.json({
      shop: shopData,
      contacts: contacts || [],
      operatingHours: operatingHours || []
    })

  } catch (error: any) {
    console.error('Settings API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}