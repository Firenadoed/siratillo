// app/api/admin/users/[id]/route.ts
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { NextResponse } from 'next/server'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function DELETE(
  request: Request,
  { params }: RouteParams
) {
  try {
    const resolvedParams = await params;
    const { id } = resolvedParams;

    // Validate ID
    if (!id || typeof id !== 'string' || id.length === 0) {
      return NextResponse.json(
        { error: "Invalid user ID" },
        { status: 400 }
      );
    }

    console.log('=== DELETE USER DEBUG ===');
    console.log('User ID:', id);

    // Test service role connection
    console.log('Testing service role connection...');
    const { error: testError } = await supabaseAdmin.auth.getUser();
    if (testError) {
      console.error('Service role connection FAILED:', testError);
      return NextResponse.json(
        { error: "Service authentication failed" },
        { status: 500 }
      );
    }
    console.log('Service role connection test PASSED');

    // Verify user exists before deletion
    console.log('Verifying user exists...');
    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(id);
    
    if (userError || !userData) {
      console.log('User not found:', userError?.message);
      
      // Additional check: search in user list
      const { data: allUsers } = await supabaseAdmin.auth.admin.listUsers();
      const userExists = allUsers?.users?.some(u => u.id === id);
      
      if (!userExists) {
        return NextResponse.json(
          { error: "User not found" },
          { status: 404 }
        );
      }
    }

    console.log('User verified:', {
      id: userData?.user?.id,
      email: userData?.user?.email
    });

    // Delete user
    console.log('Deleting user...');
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(id);

    if (deleteError) {
      console.error('Delete failed:', deleteError);
      throw deleteError;
    }

    console.log('User deleted successfully');
    return NextResponse.json({ 
      success: true,
      message: "User deleted successfully"
    });

  } catch (error: any) {
    console.error('Delete user error:', error);
    
    return NextResponse.json(
      { 
        error: error.message || "Failed to delete user",
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}