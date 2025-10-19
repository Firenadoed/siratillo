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

    const { branchId, contacts } = await request.json()

    if (!branchId || !contacts) {
      return NextResponse.json({ error: "Branch ID and contacts are required" }, { status: 400 })
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

    // Delete existing contacts for this branch
    await supabaseAdmin
      .from('branch_contacts')
      .delete()
      .eq('branch_id', branchId)

    // Insert new contacts
    const contactsToInsert = contacts.map((contact: any) => ({
      branch_id: branchId,
      contact_type: contact.contact_type,
      value: contact.value,
      is_primary: contact.is_primary
    }))

    const { error: insertError } = await supabaseAdmin
      .from('branch_contacts')
      .insert(contactsToInsert)

    if (insertError) {
      console.error('Contacts insert error:', insertError)
      return NextResponse.json({ error: "Failed to update contacts" }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true,
      message: 'Contacts updated successfully'
    })

  } catch (error: any) {
    console.error('Contacts update error:', error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}