// app/api/admin/account-requests/[id]/route.ts
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { verifyAdminAccess } from '@/lib/auth-utils'
import { NextResponse } from 'next/server'
import { sendEmailNodemailer } from '@/lib/nodemailer'
import { randomBytes } from 'crypto'

// PUT /api/admin/account-requests/[id] - Update account request status (Admin only)
export async function PUT(
  request: Request,
  { params }: { params: { id: string } }  // ✅ Remove Promise
) {
  try {
    // 🔒 Verify admin authentication and authorization
    const authResult = await verifyAdminAccess()
    if (!authResult.authorized) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status })
    }

    const { id } = params;

    // 🔒 Safe JSON parsing
    let requestBody;
    try {
      requestBody = await request.json();
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      return NextResponse.json({ error: "Invalid JSON in request body" }, { status: 400 })
    }

    const { action } = requestBody;
    
    // 🔒 Input validation
    if (!action) {
      return NextResponse.json({ 
        error: "Action is required" 
      }, { status: 400 })
    }

    if (!['approve', 'reject'].includes(action)) {
      return NextResponse.json({ 
        error: "Invalid action. Must be 'approve' or 'reject'" 
      }, { status: 400 })
    }

    // 🔒 UUID validation
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return NextResponse.json({ error: "Invalid request ID" }, { status: 400 })
    }

    // 1. Get the account request
    const { data: accountRequest, error: fetchError } = await supabaseAdmin
      .from('account_requests')
      .select('*')
      .eq('id', id)
      .single()

    if (fetchError || !accountRequest) {
      return NextResponse.json({ error: "Account request not found" }, { status: 404 })
    }

    if (accountRequest.status !== 'pending') {
      return NextResponse.json({ 
        error: "Request has already been processed" 
      }, { status: 400 })
    }

    // 🔒 Check for duplicate email before approval
    if (action === 'approve') {
      const { data: existingUser, error: emailCheckError } = await supabaseAdmin
        .from('users')
        .select('id')
        .eq('email', accountRequest.email)
        .maybeSingle()

      if (emailCheckError) {
        console.error('Email check error:', emailCheckError);
        return NextResponse.json({ error: "Failed to validate email" }, { status: 500 })
      }

      if (existingUser) {
        return NextResponse.json({ error: "Email already registered" }, { status: 400 })
      }
    }

    // 2. Process based on action
    let result;
    if (action === 'approve') {
      result = await createShopFromRequest(accountRequest, authResult.userId)
    } else {
      result = await sendRejectionEmail(accountRequest.email, accountRequest.name)
    }

    // 3. DELETE the account request from table (for both approve and reject)
    const { error: deleteError } = await supabaseAdmin
      .from('account_requests')
      .delete()
      .eq('id', id)

    if (deleteError) {
      console.error('Delete error:', deleteError);
      return NextResponse.json({ error: "Failed to clean up request" }, { status: 500 })
    }

    // 🔒 Audit log the action
    try {
      await supabaseAdmin
        .from('admin_audit_logs')
        .insert({
          admin_id: authResult.userId,
          action: `account_request_${action}`,
          target_request_id: id,
          target_email: accountRequest.email,
          target_shop_name: accountRequest.shop_name,
          description: `${action === 'approve' ? 'Approved' : 'Rejected'} account request for ${accountRequest.shop_name} (${accountRequest.email})`,
          ip_address: request.headers.get('x-forwarded-for')?.split(',')[0] || request.headers.get('x-real-ip') || 'unknown',
          user_agent: request.headers.get('user-agent') || 'unknown',
          created_at: new Date().toISOString()
        })
    } catch (auditError) {
      console.error('Audit log error:', auditError);
      // Don't fail the request if audit logging fails
    }

    return NextResponse.json({ 
      success: true,
      message: `Account request ${action}ed successfully and removed from system`
    })

  } catch (error: any) {
    console.error('Error in account request update:', error);
    return NextResponse.json({ error: "Failed to process account request" }, { status: 500 })
  }
}

// GET /api/admin/account-requests/[id] - Get specific account request (Admin only)
export async function GET(
  request: Request,
  { params }: { params: { id: string } }  // ✅ Correct type
){
  try {
    // 🔒 Verify admin authentication and authorization
    const authResult = await verifyAdminAccess()
    if (!authResult.authorized) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status })
    }

    const { id } = params; 

    // 🔒 UUID validation
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return NextResponse.json({ error: "Invalid request ID" }, { status: 400 })
    }

    const { data: accountRequest, error } = await supabaseAdmin
      .from('account_requests')
      .select('*')
      .eq('id', id)
      .single()

    if (error || !accountRequest) {
      return NextResponse.json({ error: "Account request not found" }, { status: 404 })
    }

    return NextResponse.json({ request: accountRequest })
  } catch (error: any) {
    console.error('Error fetching account request:', error);
    return NextResponse.json({ error: "Failed to fetch account request" }, { status: 500 })
  }
}

// Helper function to send approval email
async function sendApprovalEmail(email: string, name: string, password: string, shopName: string) {
  try {
    await sendEmailNodemailer({
      to: email,
      subject: '🎉 Your LaundryGo Shop Account Has Been Approved!',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #7C3AED; text-align: center;">Welcome to LaundryGo! 🎉</h2>
          
          <p>Dear <strong>${name}</strong>,</p>
          
          <p>We're excited to inform you that your laundry shop account has been approved! You can now access your shop dashboard and start managing your laundry business.</p>
          
          <div style="background: #f8fafc; padding: 20px; border-radius: 8px; border-left: 4px solid #7C3AED; margin: 20px 0;">
            <h3 style="color: #334155; margin-top: 0;">Your Login Credentials:</h3>
            <p><strong>Email:</strong> ${email}</p>
            <p><strong>Password:</strong> ${password}</p>
            <p><strong>Shop Name:</strong> ${shopName}</p>
          </div>
          
          <div style="background: #f0fdf4; padding: 15px; border-radius: 8px; border: 1px solid #bbf7d0; margin: 20px 0;">
            <p style="margin: 0; color: #166534;">
              <strong>🔒 Security Note:</strong> For security reasons, we recommend changing your password after your first login.
            </p>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.NEXT_PUBLIC_APP_URL}/login" 
               style="background: #7C3AED; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              🚀 Access Your Dashboard
            </a>
          </div>
          
          <p><strong>Next Steps:</strong></p>
          <ol>
            <li>Login to your owner dashboard</li>
            <li>Set up your shop profile and services</li>
            <li>Configure your pricing and operating hours</li>
            <li>Start accepting laundry orders!</li>
          </ol>
          
          <p>If you have any questions or need assistance setting up your shop, please don't hesitate to contact our support team.</p>
          
          <p>Best regards,<br>
          <strong>The LaundryGo Team</strong></p>
        </div>
      `
    });
  } catch (error) {
    console.error("Failed to send approval email:", error);
  }
}

// Helper function to send rejection email
async function sendRejectionEmail(email: string, name: string) {
  try {
    await sendEmailNodemailer({
      to: email,
      subject: 'Update on Your LaundryGo Account Request',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #7C3AED; text-align: center;">Account Request Update</h2>
          
          <p>Dear <strong>${name}</strong>,</p>
          
          <p>Thank you for your interest in joining LaundryGo as a shop owner.</p>
          
          <div style="background: #fef2f2; padding: 20px; border-radius: 8px; border-left: 4px solid #dc2626; margin: 20px 0;">
            <p style="color: #dc2626; margin: 0;">
              <strong>We're unable to approve your account request at this time.</strong>
            </p>
            <p style="margin: 10px 0 0 0; color: #7f1d1d;">
              There seems to be something wrong with your request. Please try again later or contact our support team for more information.
            </p>
          </div>
          
          <p>If you believe this was a mistake or would like more details, please reach out to our support team.</p>
          
          <p>We appreciate your understanding and hope to serve you better in the future.</p>
          
          <p>Best regards,<br>
          <strong>The LaundryGo Team</strong></p>
        </div>
      `
    });
  } catch (error) {
    console.error("Failed to send rejection email:", error);
  }
}

// Helper function to create shop from approved request
async function createShopFromRequest(accountRequest: any, adminId: string) {
  // 🔒 Better password generation
  const randomPassword = generateSecurePassword()

  // 1. Create auth user (owner)
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email: accountRequest.email,
    password: randomPassword,
    email_confirm: true,
    user_metadata: { 
      full_name: accountRequest.name,
      phone: accountRequest.contact
    }
  })

  if (authError) {
    console.error('Auth user creation error:', authError);
    throw new Error("Failed to create user account")
  }

  // 2. Create user profile
  const { error: profileError } = await supabaseAdmin
    .from('users')
    .insert([{ 
      id: authData.user.id, 
      full_name: accountRequest.name, 
      email: accountRequest.email,
      phone: accountRequest.contact
    }])

  if (profileError) {
    console.error('Profile creation error:', profileError);
    // Cleanup auth user
    await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
    throw new Error("Failed to create user profile")
  }

  // 3. Get owner role
  const { data: role, error: roleError } = await supabaseAdmin
    .from('roles')
    .select('id')
    .eq('name', 'owner')
    .single()

  if (roleError || !role) {
    console.error('Role fetch error:', roleError);
    // Cleanup
    await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
    await supabaseAdmin.from('users').delete().eq('id', authData.user.id)
    throw new Error("Failed to assign owner role")
  }

  // 4. Assign role to user
  const { error: userRoleError } = await supabaseAdmin
    .from('user_roles')
    .insert([{ 
      user_id: authData.user.id, 
      role_id: role.id 
    }])

  if (userRoleError) {
    console.error('User role assignment error:', userRoleError);
    // Cleanup
    await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
    await supabaseAdmin.from('users').delete().eq('id', authData.user.id)
    throw new Error("Failed to assign user role")
  }

  // 5. Create shop
  const { data: shop, error: shopError } = await supabaseAdmin
    .from('shops')
    .insert([{
      name: accountRequest.shop_name,
      description: `Laundry shop at ${accountRequest.shop_address}`,
      owner_id: authData.user.id
    }])
    .select()
    .single()

  if (shopError) {
    console.error('Shop creation error:', shopError);
    // Cleanup
    await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
    await supabaseAdmin.from('users').delete().eq('id', authData.user.id)
    await supabaseAdmin.from('user_roles').delete().eq('user_id', authData.user.id)
    throw new Error("Failed to create shop")
  }

  // 6. Create shop branch
  const { data: branch, error: branchError } = await supabaseAdmin
    .from('shop_branches')
    .insert([{
      shop_id: shop.id,
      name: 'Main Branch',
      address: accountRequest.shop_address,
      latitude: accountRequest.latitude,
      longitude: accountRequest.longitude
    }])
    .select()
    .single()

  if (branchError) {
    console.error('Branch creation error:', branchError);
    // Cleanup
    await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
    await supabaseAdmin.from('users').delete().eq('id', authData.user.id)
    await supabaseAdmin.from('user_roles').delete().eq('user_id', authData.user.id)
    await supabaseAdmin.from('shops').delete().eq('id', shop.id)
    throw new Error("Failed to create shop branch")
  }

  // 7. Create shop user assignment
  const { error: assignmentError } = await supabaseAdmin
    .from('shop_user_assignments')
    .insert([{
      user_id: authData.user.id,
      shop_id: shop.id,
      branch_id: branch.id,
      role_in_shop: 'owner',
      is_active: true
    }])

  if (assignmentError) {
    console.error('Assignment creation error:', assignmentError);
    // Cleanup
    await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
    await supabaseAdmin.from('users').delete().eq('id', authData.user.id)
    await supabaseAdmin.from('user_roles').delete().eq('user_id', authData.user.id)
    await supabaseAdmin.from('shops').delete().eq('id', shop.id)
    await supabaseAdmin.from('shop_branches').delete().eq('id', branch.id)
    throw new Error("Failed to create shop assignment")
  }

  // 8. Create default services for the branch
  await createDefaultServices(branch.id)

  // 9. Send approval email with credentials
  await sendApprovalEmail(
    accountRequest.email,
    accountRequest.name,
    randomPassword,
    accountRequest.shop_name
  )

  return {
    shopId: shop.id,
    branchId: branch.id,
    ownerId: authData.user.id
  }
}

// 🔒 Secure password generation
function generateSecurePassword(): string {
  const length = 12;
  const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
  let password = "";
  
  // Ensure at least one of each required character type
  password += randomBytes(1).toString('hex')[0]; // lowercase
  password += randomBytes(1).toString('hex')[0].toUpperCase(); // uppercase  
  password += Math.floor(Math.random() * 10); // number
  password += "!@#$%^&*"[Math.floor(Math.random() * 8)]; // special
  
  // Fill the rest randomly
  for (let i = password.length; i < length; i++) {
    password += charset[Math.floor(Math.random() * charset.length)];
  }
  
  // Shuffle the password
  return password.split('').sort(() => 0.5 - Math.random()).join('');
}

// Helper function to create default services
async function createDefaultServices(branchId: string) {
  try {
    const defaultServices = [
      {
        name: 'Wash & Fold',
        description: 'Professional washing and folding service',
        price_per_kg: 60,
        unit: 'kg',
        is_active: true
      },
      {
        name: 'Wash & Iron',
        description: 'Washing with professional ironing',
        price_per_kg: 80,
        unit: 'kg',
        is_active: true
      },
      {
        name: 'Dry Clean',
        description: 'Professional dry cleaning service',
        price_per_kg: 120,
        unit: 'kg',
        is_active: true
      }
    ]

    const servicesWithBranchId = defaultServices.map(service => ({
      ...service,
      branch_id: branchId
    }))

    const { error: servicesError } = await supabaseAdmin
      .from('shop_services')
      .insert(servicesWithBranchId)

    if (servicesError) {
      // Log but don't throw - services creation shouldn't block the main flow
      console.error("Error creating default services:", servicesError)
    }

  } catch (error) {
    console.error("Error creating default services:", error)
  }
}