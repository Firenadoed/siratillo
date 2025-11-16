// app/api/admin/owners/[id]/route.ts
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { verifyAdminAccess } from '@/lib/auth-utils'
import { NextResponse } from 'next/server'

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }  // ✅ Remove Promise wrapper
) {
  console.log('Starting owner update request...');
  
  try {
    // 🔒 Use your existing auth utility
    console.log('Verifying admin access...');
    const authResult = await verifyAdminAccess()
    if (!authResult.authorized) {
      console.log('Admin access denied:', authResult.error);
      return NextResponse.json({ error: authResult.error }, { status: authResult.status })
    }
    console.log('Admin access verified for user:', authResult.userId);

    const { id } = params;
    console.log('Processing owner ID:', id);
    
    // 🔒 Input validation
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      console.log('Invalid UUID format:', id);
      return NextResponse.json({ error: "Invalid owner ID" }, { status: 400 })
    }

    const body = await request.json();
    const { full_name, email, shop_id } = body;
    console.log('Update data:', { full_name, email, shop_id });

    // 🔒 Input validation
    if (!full_name?.trim() || !email?.trim()) {
      return NextResponse.json({ 
        error: "Full name and email are required" 
      }, { status: 400 });
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      return NextResponse.json({ error: "Invalid email format" }, { status: 400 })
    }

    if (full_name.trim().length > 100) {
      return NextResponse.json({ error: "Full name too long" }, { status: 400 })
    }

    // 🔒 Verify target user exists and is an owner
    console.log('Verifying target user is an owner...');
    const { data: targetUserRoles, error: rolesError } = await supabaseAdmin
      .from("user_roles")
      .select(`
        user_id,
        roles (
          name
        )
      `)
      .eq("user_id", id)

    if (rolesError) {
      console.error('Roles query error:', rolesError);
      return NextResponse.json({ error: "Failed to verify user" }, { status: 500 })
    }

    console.log('Target user roles:', targetUserRoles);

    if (!targetUserRoles || targetUserRoles.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    const isOwner = targetUserRoles.some(userRole => 
      (userRole.roles as any)?.name === 'owner'
    )
    
    if (!isOwner) {
      return NextResponse.json({ error: "User is not an owner" }, { status: 404 })
    }

    // 🔒 Check for duplicate email (excluding current user)
    console.log('Checking for duplicate email...');
    const { data: duplicateUser, error: emailCheckError } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('email', email.trim())
      .neq('id', id)
      .maybeSingle()

    if (emailCheckError) {
      console.error('Email check error:', emailCheckError);
      return NextResponse.json({ error: "Failed to validate email" }, { status: 500 })
    }

    if (duplicateUser) {
      return NextResponse.json({ error: "Email already registered" }, { status: 400 })
    }

    // Get current user data for audit logging
    console.log('Getting current user data...');
    const { data: currentUser, error: getUserError } = await supabaseAdmin
      .from('users')
      .select('full_name, email')
      .eq('id', id)
      .single()

    if (getUserError) {
      console.error('Get user error:', getUserError);
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    console.log('Current user data:', currentUser);

    // Get current shop assignment for comparison
    console.log('Getting current shop assignment...');
    const { data: currentAssignment, error: assignmentError } = await supabaseAdmin
      .from('shop_user_assignments')
      .select('id, shop_id')
      .eq('user_id', id)
      .eq('role_in_shop', 'owner')
      .maybeSingle()

    if (assignmentError && assignmentError.code !== 'PGRST116') {
      console.error('Assignment error:', assignmentError);
    }

    const currentShopId = currentAssignment?.shop_id || null;
    console.log('Current shop assignment:', currentAssignment);

    // Update the user in auth
    console.log('Updating auth user...');
    const { data: authUpdate, error: authError } = await supabaseAdmin.auth.admin.updateUserById(
      id,
      { 
        email: email.trim(),
        user_metadata: { 
          full_name: full_name.trim()
        }
      }
    );

    if (authError) {
      console.error('Auth update error:', authError);
      return NextResponse.json({ 
        error: "Failed to update user account: " + authError.message 
      }, { status: 500 })
    }

    console.log('Auth update successful');

    // Update the public.users table
    console.log('Updating public users table...');
    const { error: usersTableError } = await supabaseAdmin
      .from('users')
      .update({ 
        full_name: full_name.trim(),
        email: email.trim(),
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    if (usersTableError) {
      console.error('Users table error:', usersTableError);
      return NextResponse.json({ 
        error: "Failed to update user profile: " + usersTableError.message 
      }, { status: 500 })
    }

    console.log('Public users table updated successfully');

    // Handle shop assignment if shop_id provided
    let updatedShopId = currentShopId;
    let newShopName = null;

    if (shop_id) {
      console.log('Processing shop assignment for shop:', shop_id);
      
      // Validate new shop exists
      const { data: newShop, error: shopError } = await supabaseAdmin
        .from('shops')
        .select('id, name, owner_id')
        .eq('id', shop_id)
        .single()

      if (shopError || !newShop) {
        console.error('Shop validation error:', shopError);
        return NextResponse.json({ error: "Shop not found" }, { status: 404 })
      }

      console.log('New shop found:', newShop);
      newShopName = newShop.name;

      // Prepare assignment data according to your schema
      const assignmentData = {
        user_id: id,
        shop_id: shop_id,
        role_in_shop: 'owner',
        branch_id: null, // Set to null for owner assignments
        is_active: true
      };

      let assignmentUpdateError = null;

      if (currentAssignment?.id) {
        // Update existing assignment
        const { error } = await supabaseAdmin
          .from('shop_user_assignments')
          .update(assignmentData)
          .eq('id', currentAssignment.id)

        assignmentUpdateError = error;
        console.log('Updated existing shop assignment');
      } else {
        // Insert new assignment
        const { error } = await supabaseAdmin
          .from('shop_user_assignments')
          .insert(assignmentData)

        assignmentUpdateError = error;
        console.log('Created new shop assignment');
      }

      if (assignmentUpdateError) {
        console.error('Shop assignment error:', assignmentUpdateError);
        return NextResponse.json({ 
          error: "Failed to update shop assignment: " + assignmentUpdateError.message 
        }, { status: 500 })
      }

      // Clear previous shop ownership if changing shops
      if (currentShopId && currentShopId !== shop_id) {
        console.log('Clearing previous shop ownership for shop:', currentShopId);
        const { error: clearOwnerError } = await supabaseAdmin
          .from('shops')
          .update({ owner_id: null })
          .eq('id', currentShopId)

        if (clearOwnerError) {
          console.error('Clear owner error:', clearOwnerError);
          // Continue anyway - this shouldn't block the update
        }
      }

      // Update new shop ownership
      console.log('Setting new shop ownership for shop:', shop_id);
      const { error: shopOwnerError } = await supabaseAdmin
        .from('shops')
        .update({ owner_id: id })
        .eq('id', shop_id)

      if (shopOwnerError) {
        console.error('Shop owner update error:', shopOwnerError);
        return NextResponse.json({ 
          error: "Failed to update shop ownership: " + shopOwnerError.message 
        }, { status: 500 })
      }

      updatedShopId = shop_id;
      console.log('Shop assignment updated successfully');
    } else if (currentShopId) {
      // If no shop_id provided but user currently has a shop, remove the assignment
      console.log('Removing shop assignment...');
      
      // Delete the shop_user_assignment
      const { error: deleteAssignmentError } = await supabaseAdmin
        .from('shop_user_assignments')
        .delete()
        .eq('user_id', id)
        .eq('role_in_shop', 'owner')

      if (deleteAssignmentError) {
        console.error('Delete assignment error:', deleteAssignmentError);
        // Continue anyway - this shouldn't block the update
      }

      // Clear shop ownership
      const { error: clearOwnerError } = await supabaseAdmin
        .from('shops')
        .update({ owner_id: null })
        .eq('owner_id', id)

      if (clearOwnerError) {
        console.error('Clear owner error:', clearOwnerError);
        // Continue anyway
      }

      updatedShopId = null;
      console.log('Shop assignment removed successfully');
    }

    // 🔒 Audit log the update
    try {
      console.log('Creating audit log...');
      
      // Get current shop name for audit log
      let currentShopName = null;
      if (currentShopId) {
        const { data: currentShop } = await supabaseAdmin
          .from('shops')
          .select('name')
          .eq('id', currentShopId)
          .single()
        currentShopName = currentShop?.name || null;
      }

      await supabaseAdmin
        .from('admin_audit_logs')
        .insert({
          admin_id: authResult.userId,
          action: 'owner_update',
          target_user_id: id,
          target_shop_id: updatedShopId,
          description: `Updated owner ${currentUser.full_name} (${currentUser.email}) to ${full_name.trim()} (${email.trim()})${shop_id ? ` and reassigned shop to ${newShopName}` : currentShopId ? ' and removed shop assignment' : ''}`,
          old_values: {
            full_name: currentUser.full_name,
            email: currentUser.email,
            shop_id: currentShopId,
            shop_name: currentShopName
          },
          new_values: {
            full_name: full_name.trim(),
            email: email.trim(),
            shop_id: updatedShopId,
            shop_name: newShopName
          },
          ip_address: request.headers.get('x-forwarded-for')?.split(',')[0] || request.headers.get('x-real-ip') || 'unknown',
          user_agent: request.headers.get('user-agent') || 'unknown',
          created_at: new Date().toISOString()
        })
      
      console.log('Audit log created successfully');
    } catch (auditError) {
      console.error('Audit log error:', auditError);
      // Don't fail the request if audit logging fails
    }

    console.log('Owner update completed successfully');

    return NextResponse.json({ 
      success: true, 
      owner: {
        id: authUpdate.user.id,
        full_name: full_name.trim(),
        email: authUpdate.user.email,
        shop_id: updatedShopId
      }
    });

  } catch (error: any) {
    console.error('Unexpected error in owner update:', error);
    return NextResponse.json({ 
      error: "Internal server error" 
    }, { status: 500 });
  }
}