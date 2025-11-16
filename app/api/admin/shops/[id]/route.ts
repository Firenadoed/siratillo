// app/api/admin/shops/[id]/route.ts
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { verifyAdminAccess } from '@/lib/auth-utils' // Import from your existing utils
import { NextResponse } from 'next/server'

// PUT /api/admin/shops/[id] - Update shop (Admin only)
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 🔒 Use your existing auth utility
    const authResult = await verifyAdminAccess()
    if (!authResult.authorized) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status })
    }

    const { id } = await params
    
    // 🔒 Input validation
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return NextResponse.json({ error: "Invalid shop ID" }, { status: 400 })
    }

    const { name, description } = await request.json()
    
    // 🔒 Input validation
    if (!name?.trim()) {
      return NextResponse.json({ error: "Shop name is required" }, { status: 400 })
    }

    if (name.trim().length > 100) {
      return NextResponse.json({ error: "Shop name too long" }, { status: 400 })
    }

    if (description && description.length > 500) {
      return NextResponse.json({ error: "Description too long" }, { status: 400 })
    }

    // Check if shop exists
    const { data: existingShop, error: checkError } = await supabaseAdmin
      .from('shops')
      .select('id')
      .eq('id', id)
      .single()

    if (checkError || !existingShop) {
      return NextResponse.json({ error: "Shop not found" }, { status: 404 })
    }

    // Check for duplicate shop names (excluding current shop)
    const { data: duplicateShop, error: duplicateError } = await supabaseAdmin
      .from('shops')
      .select('id')
      .eq('name', name.trim())
      .neq('id', id)
      .maybeSingle()

    if (duplicateError) {
      return NextResponse.json({ error: "Failed to validate shop" }, { status: 500 })
    }

    if (duplicateShop) {
      return NextResponse.json({ error: "Shop name already exists" }, { status: 400 })
    }

    const { data: shop, error } = await supabaseAdmin
      .from('shops')
      .update({ 
        name: name.trim(), 
        description: description?.trim() || null 
      })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: "Failed to update shop" }, { status: 500 })
    }
    
    if (!shop) {
      return NextResponse.json({ error: "Shop not found" }, { status: 404 })
    }

    // 🔒 Audit log the update
    try {
      await supabaseAdmin
        .from('admin_audit_logs')
        .insert({
          admin_id: authResult.userId,
          action: 'shop_update',
          target_shop_id: id,
          description: `Updated shop: ${shop.name}`,
          created_at: new Date().toISOString()
        })
    } catch (auditError) {
      // Don't fail the request if audit logging fails
    }

    return NextResponse.json({ shop })
  } catch (error: any) {
    return NextResponse.json({ error: "Failed to update shop" }, { status: 500 })
  }
}

// DELETE /api/admin/shops/[id] - Delete shop (Admin only)
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 🔒 Use your existing auth utility
    const authResult = await verifyAdminAccess()
    if (!authResult.authorized) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status })
    }

    const { id } = await params
    
    // 🔒 Input validation
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return NextResponse.json({ error: "Invalid shop ID" }, { status: 400 })
    }

    // Check if shop exists first
    const { data: shop, error: shopCheckError } = await supabaseAdmin
      .from('shops')
      .select('id, name')
      .eq('id', id)
      .single()

    if (shopCheckError || !shop) {
      return NextResponse.json({ error: "Shop not found" }, { status: 404 })
    }

    // 🔒 Consider adding confirmation for destructive operations
    // For now, proceed with deletion but log extensively

    // Your existing deletion logic here (with proper error handling)
    // [Keep your existing deletion code but wrap each operation in try-catch]
    
    // Example of secured deletion approach:
    let deletionErrors = []

    try {
      // 1. Delete order history related to this shop
      const { error: orderHistoryError } = await supabaseAdmin
        .from('order_history')
        .delete()
        .eq('shop_id', id)

      if (orderHistoryError) deletionErrors.push(`Order history: ${orderHistoryError.message}`)
    } catch (error) {
      deletionErrors.push(`Order history: ${error.message}`)
    }

    // Continue with other deletion operations...
    // [Wrap all your existing deletion operations in try-catch blocks]

    // Final shop deletion
    try {
      const { error: finalDeleteError } = await supabaseAdmin
        .from('shops')
        .delete()
        .eq('id', id)

      if (finalDeleteError) {
        return NextResponse.json({ error: "Failed to delete shop" }, { status: 500 })
      }
    } catch (error) {
      return NextResponse.json({ error: "Failed to delete shop" }, { status: 500 })
    }

    // 🔒 Audit log the deletion (CRITICAL)
    try {
      await supabaseAdmin
        .from('admin_audit_logs')
        .insert({
          admin_id: authResult.userId,
          action: 'shop_deletion',
          target_shop_id: id,
          target_shop_name: shop.name,
          description: `Deleted shop: ${shop.name} with ${deletionErrors.length} partial errors`,
          deletion_errors: deletionErrors.length > 0 ? deletionErrors : null,
          ip_address: request.headers.get('x-forwarded-for') || 'unknown',
          user_agent: request.headers.get('user-agent') || 'unknown',
          created_at: new Date().toISOString()
        })
    } catch (auditError) {
      // Log audit failure but don't fail the request
    }

    return NextResponse.json({ 
      success: true,
      message: "Shop successfully deleted",
      partialErrors: deletionErrors.length > 0 ? deletionErrors : undefined
    })

  } catch (error: any) {
    return NextResponse.json({ error: "Failed to delete shop" }, { status: 500 })
  }
}