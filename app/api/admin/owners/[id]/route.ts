// app/api/admin/owners/[id]/route.ts
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { NextResponse } from 'next/server'

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { full_name, email, shop_id } = await request.json();

    console.log('=== UPDATE OWNER DEBUG ===');
    console.log('Owner ID:', id);
    console.log('Update data:', { full_name, email, shop_id });

    if (!full_name || !email) {
      return NextResponse.json({ 
        error: "Full name and email are required" 
      }, { status: 400 });
    }

    // First, let's check if the user exists and get current data
    console.log('Checking current user data...');
    const { data: currentUser, error: getUserError } = await supabaseAdmin.auth.admin.getUserById(id);
    
    if (getUserError) {
      console.log('Get user error:', getUserError);
      return NextResponse.json({ 
        error: "User not found: " + getUserError.message 
      }, { status: 404 });
    }

    console.log('Current user data:', {
      email: currentUser.user.email,
      user_metadata: currentUser.user.user_metadata
    });

    // Update the user in auth with proper user_metadata merge
    console.log('Updating user in auth...');
    const { data: authUpdate, error: authError } = await supabaseAdmin.auth.admin.updateUserById(
      id,
      { 
        email: email,
        user_metadata: { 
          ...currentUser.user.user_metadata, // Keep existing metadata
          full_name: full_name // Update full_name
        }
      }
    );

    if (authError) {
      console.log('Auth update error:', authError);
      return NextResponse.json({ 
        error: "Failed to update user: " + authError.message 
      }, { status: 500 });
    }

    console.log('Auth update successful:', {
      email: authUpdate.user.email,
      user_metadata: authUpdate.user.user_metadata
    });

    // Update the shop_owners record
    console.log('Updating shop_owners record...');
    
    // First, check if shop_owners record exists
    const { data: existingOwner, error: checkError } = await supabaseAdmin
      .from('shop_owners')
      .select('*')
      .eq('user_id', id)
      .single();

    let ownerUpdate;
    let ownerError;

    if (existingOwner) {
      // Update existing record
      const { data, error } = await supabaseAdmin
        .from('shop_owners')
        .update({ shop_id: shop_id })
        .eq('user_id', id);
      ownerUpdate = data;
      ownerError = error;
    } else {
      // Create new record
      const { data, error } = await supabaseAdmin
        .from('shop_owners')
        .insert({ 
          user_id: id, 
          shop_id: shop_id 
        });
      ownerUpdate = data;
      ownerError = error;
    }

    if (ownerError) {
      console.log('Shop owners update error:', ownerError);
      // Don't fail the entire request if shop_owners update fails
      console.log('Continuing without shop_owners update...');
    } else {
      console.log('Shop owners update successful');
    }

    // Also update the public.users table if it exists
    console.log('Updating public.users table...');
    const { error: usersTableError } = await supabaseAdmin
      .from('users')
      .update({ 
        full_name: full_name,
        email: email
      })
      .eq('id', id);

    if (usersTableError) {
      console.log('Users table update error (may be expected):', usersTableError);
    } else {
      console.log('Users table update successful');
    }

    console.log('Owner update completed successfully');
    return NextResponse.json({ 
      success: true, 
      owner: {
        id: authUpdate.user.id,
        full_name: full_name,
        email: authUpdate.user.email,
        shop_id: shop_id
      }
    });

  } catch (error: any) {
    console.error('Update owner error:', error);
    return NextResponse.json({ 
      error: error.message || "Unknown error occurred" 
    }, { status: 500 });
  }
}