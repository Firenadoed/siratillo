// app/api/admin/users/[id]/route.ts
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { verifyAdminAccess } from '@/lib/auth-utils'

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 🔒 STEP 1: Use your existing auth utility
    const authResult = await verifyAdminAccess()
    if (!authResult.authorized) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status })
    }

    const { id } = await params;

    // 🔒 STEP 2: Input validation
    if (!id || typeof id !== 'string' || id.length === 0) {
      return NextResponse.json(
        { error: "Invalid user ID" },
        { status: 400 }
      );
    }

    // UUID format validation
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return NextResponse.json(
        { error: "Invalid user ID format" },
        { status: 400 }
      );
    }

    // 🔒 STEP 3: Prevent self-deletion
    if (id === authResult.userId) {
      return NextResponse.json(
        { error: "Cannot delete your own account" },
        { status: 400 }
      );
    }

    // 🔒 STEP 4: Verify target user exists and check permissions
    const { data: targetUserRoles, error: targetUserError } = await supabaseAdmin
      .from("user_roles")
      .select(`
        user_id,
        roles (
          name
        )
      `)
      .eq("user_id", id)

    if (targetUserError) {
      return NextResponse.json(
        { error: "Failed to verify user" },
        { status: 500 }
      );
    }

    // Check if target user exists
    if (!targetUserRoles || targetUserRoles.length === 0) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    // Extract target user roles
    const targetUserRoleNames = (targetUserRoles as any[]).flatMap((userRole: any) => {
      const roles = userRole.roles;
      if (Array.isArray(roles)) {
        return roles.map((role: any) => role.name);
      }
      return roles?.name ? [roles.name] : [];
    }).filter(Boolean);
    
    // Get current admin's roles to check permissions
    const { data: adminRoles, error: adminRolesError } = await supabaseAdmin
      .from("user_roles")
      .select(`
        user_id,
        roles (
          name
        )
      `)
      .eq("user_id", authResult.userId)

    if (adminRolesError) {
      return NextResponse.json(
        { error: "Failed to verify admin permissions" },
        { status: 500 }
      );
    }

    const adminRoleNames = (adminRoles as any[])?.flatMap((userRole: any) => {
      const roles = userRole.roles;
      if (Array.isArray(roles)) {
        return roles.map((role: any) => role.name);
      }
      return roles?.name ? [roles.name] : [];
    }).filter(Boolean) || [];

    // Prevent deletion of other admins
    const targetIsAdmin = targetUserRoleNames.some(roleName => 
      roleName === 'admin' || roleName === 'superadmin'
    );
    
    // Only superadmin can delete other admins
    const isSuperAdmin = adminRoleNames.includes('superadmin');
    
    if (targetIsAdmin && !isSuperAdmin) {
      return NextResponse.json(
        { error: "Only superadmin can delete admin users" },
        { status: 403 }
      );
    }

    // 🔒 STEP 5: Perform deletion with proper cleanup order

    // 1. Remove shop ownership
    const { error: shopUpdateError } = await supabaseAdmin
      .from('shops')
      .update({ owner_id: null })
      .eq('owner_id', id);

    if (shopUpdateError) {
      // Continue - user might not own a shop
    }

    // 2. Delete shop assignments
    const { error: assignmentsError } = await supabaseAdmin
      .from('shop_user_assignments')
      .delete()
      .eq('user_id', id);

    if (assignmentsError) {
      // Continue - user might not have assignments
    }

    // 3. Delete from related tables to avoid foreign key constraints
    const cleanupOperations = [
      // Delete user's orders
      supabaseAdmin.from('orders').delete().eq('customer_id', id),
      // Delete user's order history
      supabaseAdmin.from('order_history').delete().eq('customer_id', id),
      // Delete user's notifications
      supabaseAdmin.from('notifications').delete().eq('user_id', id),
      // Delete user's push tokens
      supabaseAdmin.from('user_push_tokens').delete().eq('user_id', id),
      // Delete user's deliveries (as driver)
      supabaseAdmin.from('deliveries').delete().eq('driver_id', id),
    ];

    // Execute all cleanup operations
    await Promise.allSettled(cleanupOperations);

    // 4. Delete user roles
    const { error: rolesError } = await supabaseAdmin
      .from('user_roles')
      .delete()
      .eq('user_id', id);

    if (rolesError) {
      // Continue with deletion
    }

    // 5. Delete user profile
    const { error: profileError } = await supabaseAdmin
      .from('users')
      .delete()
      .eq('id', id);

    if (profileError) {
      // Continue to auth deletion
    }

    // 6. Delete auth user (most important step)
    const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(id);

    if (authDeleteError) {
      // Check if it's a "not found" error
      if (authDeleteError.message.includes('not found') || authDeleteError.status === 404) {
        return NextResponse.json({ 
          success: true,
          message: "User data cleaned up (auth user not found)"
        });
      }
      
      return NextResponse.json(
        { error: "Failed to delete user account" },
        { status: 500 }
      );
    }

    // 🔒 STEP 6: Audit log the deletion
    try {
      await supabaseAdmin
        .from('admin_audit_logs')
        .insert({
          admin_id: authResult.userId,
          action: 'user_deletion',
          target_user_id: id,
          target_roles: targetUserRoleNames,
          admin_roles: adminRoleNames,
          description: `Admin deleted user with roles: ${targetUserRoleNames.join(', ')}`,
          ip_address: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
          user_agent: request.headers.get('user-agent') || 'unknown',
          created_at: new Date().toISOString()
        });
    } catch (auditError) {
      // Don't fail the deletion if audit logging fails
    }

    return NextResponse.json({ 
      success: true,
      message: "User successfully deleted from all systems"
    });

  } catch (error: any) {
    return NextResponse.json(
      { error: "Failed to delete user" },
      { status: 500 }
    );
  }
}