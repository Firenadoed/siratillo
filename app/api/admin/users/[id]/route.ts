// app/api/admin/users/[id]/route.ts
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// Create a fresh admin client for each request to avoid session issues
const createAdminClient = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false
    }
  })
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabaseAdmin = createAdminClient()
  
  try {
    const { id } = await params;

    // Validate ID
    if (!id || typeof id !== 'string' || id.length === 0) {
      return NextResponse.json(
        { error: "Invalid user ID" },
        { status: 400 }
      );
    }

    console.log('Starting hard delete for user:', id);

    // Test the service role connection with a simple query
    console.log('Testing service role connection...');
    const { data: testData, error: testError } = await supabaseAdmin
      .from('users')
      .select('count')
      .limit(1);

    if (testError) {
      console.error('Service role test failed:', testError);
      return NextResponse.json(
        { error: `Service authentication failed: ${testError.message}` },
        { status: 500 }
      );
    }
    console.log('Service role connection successful');

    // STEP 1: Remove shop ownership
    console.log('Removing shop ownership...');
    const { error: shopUpdateError } = await supabaseAdmin
      .from('shops')
      .update({ owner_id: null })
      .eq('owner_id', id);

    if (shopUpdateError) {
      console.error('Failed to remove shop ownership:', shopUpdateError);
      // Continue anyway - we'll try to delete the user regardless
    } else {
      console.log('Shop ownership removed');
    }

    // STEP 2: Delete shop assignments
    console.log('Deleting shop assignments...');
    const { error: assignmentsError } = await supabaseAdmin
      .from('shop_user_assignments')
      .delete()
      .eq('user_id', id);

    if (assignmentsError) {
      console.error('Failed to delete shop assignments:', assignmentsError);
    } else {
      console.log('Shop assignments deleted');
    }

    // STEP 3: Delete user roles
    console.log('Deleting user roles...');
    const { error: rolesError } = await supabaseAdmin
      .from('user_roles')
      .delete()
      .eq('user_id', id);

    if (rolesError) {
      console.error('Failed to delete user roles:', rolesError);
    } else {
      console.log('User roles deleted');
    }

    // STEP 4: Delete user profile
    console.log('Deleting user profile...');
    const { error: profileError } = await supabaseAdmin
      .from('users')
      .delete()
      .eq('id', id);

    if (profileError) {
      console.error('Failed to delete user profile:', profileError);
      // Continue to auth deletion - the profile might not exist
    } else {
      console.log('User profile deleted');
    }

    // STEP 5: Delete auth user (most important step)
    console.log('Deleting auth user...');
    const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(id);

    if (authDeleteError) {
      console.error('Auth deletion failed:', authDeleteError);
      
      // Check if it's a "not found" error, which might be acceptable
      if (authDeleteError.message.includes('not found') || authDeleteError.status === 404) {
        console.log('Auth user not found, but other data was cleaned up');
        return NextResponse.json({ 
          success: true,
          message: "User data cleaned up (auth user not found)"
        });
      }
      
      throw new Error(`Auth deletion failed: ${authDeleteError.message}`);
    }

    console.log('Auth user deleted successfully');
    
    return NextResponse.json({ 
      success: true,
      message: "User completely deleted from all systems"
    });

  } catch (error: any) {
    console.error('Hard delete error:', error);
    
    return NextResponse.json(
      { 
        error: error.message || "Failed to delete user",
        details: process.env.NODE_ENV === 'development' ? {
          message: error.message,
          stack: error.stack
        } : undefined
      },
      { status: 500 }
    );
  }
}