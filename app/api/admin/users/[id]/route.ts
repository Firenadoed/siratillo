// app/api/admin/users/[id]/route.ts
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { NextResponse } from 'next/server'

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    console.log('=== DELETE USER DEBUG ===');
    console.log('User ID received:', id);
    console.log('ID type:', typeof id);
    console.log('ID length:', id.length);

    // Test the service role connection first
    console.log('Testing service role connection...');
    const { data: testData, error: testError } = await supabaseAdmin.auth.getUser();
    if (testError) {
      console.log('Service role connection test FAILED:', testError);
    } else {
      console.log('Service role connection test PASSED');
    }

    // Try to get the user
    console.log('Attempting to get user by ID...');
    const { data: user, error: userError } = await supabaseAdmin.auth.admin.getUserById(id);
    
    if (userError) {
      console.log('getUserById ERROR:', {
        message: userError.message,
        status: userError.status,
        name: userError.name,
        stack: userError.stack
      });
      
      // Try alternative: list all users and find this one
      console.log('Attempting to list all users...');
      const { data: allUsers, error: listError } = await supabaseAdmin.auth.admin.listUsers();
      
      if (listError) {
        console.log('listUsers ERROR:', listError);
      } else {
        console.log(`Found ${allUsers?.users?.length || 0} total users`);
        const foundUser = allUsers?.users?.find(u => u.id === id);
        console.log('User found in list:', !!foundUser);
        if (foundUser) {
          console.log('Found user details:', {
            id: foundUser.id,
            email: foundUser.email,
            created_at: foundUser.created_at
          });
        }
      }
      
      return NextResponse.json({ 
        error: "User not found",
        details: userError.message 
      }, { status: 404 });
    }
    
    if (!user) {
      console.log('User object is null');
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    
    console.log('User found:', {
      id: user.user.id,
      email: user.user.email,
      created_at: user.user.created_at
    });

    // Try to delete the user
    console.log('Attempting to delete user...');
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(id);

    if (deleteError) {
      console.log('deleteUser ERROR:', {
        message: deleteError.message,
        status: deleteError.status,
        name: deleteError.name
      });
      throw deleteError;
    }
    
    console.log('User deleted successfully');
    return NextResponse.json({ success: true });
    
  } catch (error: any) {
    console.error('FINAL CATCH ERROR:', error);
    return NextResponse.json({ 
      error: error.message || "Unknown error occurred" 
    }, { status: 500 });
  }
}