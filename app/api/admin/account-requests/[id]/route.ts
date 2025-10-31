import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { NextRequest, NextResponse } from 'next/server'
import { sendEmailNodemailer } from '@/lib/nodemailer'

// PUT /api/admin/account-requests/[id] - Update account request status
export async function PUT(
  request: NextRequest, // ✅ FIXED: Changed from Request to NextRequest
  { params }: { params: { id: string } }
) {
  try {
    const { action } = await request.json()
    
    if (!action) {
      return NextResponse.json({ 
        error: "Action is required" 
      }, { status: 400 })
    }

    const requestId = params.id

    console.log(`👤 Processing account request:`, { action, requestId })

    // 1. Get the account request
    const { data: accountRequest, error: fetchError } = await supabaseAdmin
      .from('account_requests')
      .select('*')
      .eq('id', requestId)
      .single()

    if (fetchError || !accountRequest) {
      return NextResponse.json({ error: "Account request not found" }, { status: 404 })
    }

    if (accountRequest.status !== 'pending') {
      return NextResponse.json({ 
        error: "Request has already been processed" 
      }, { status: 400 })
    }

    // 2. Process based on action
    if (action === 'approve') {
      await createShopFromRequest(accountRequest)
    } else {
      await sendRejectionEmail(accountRequest.email, accountRequest.name)
    }

    // 3. DELETE the account request from table (for both approve and reject)
    const { error: deleteError } = await supabaseAdmin
      .from('account_requests')
      .delete()
      .eq('id', requestId)

    if (deleteError) throw deleteError

    console.log(`✅ Account request ${action}ed and deleted from database`)

    return NextResponse.json({ 
      success: true,
      message: `Account request ${action}ed successfully and removed from system`
    })

  } catch (error: any) {
    console.error("💥 Account request processing error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
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
    
    console.log("✅ Approval email sent to:", email);
  } catch (error) {
    console.error("❌ Failed to send approval email:", error);
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
    
    console.log("✅ Rejection email sent to:", email);
  } catch (error) {
    console.error("❌ Failed to send rejection email:", error);
  }
}

// Helper function to create shop from approved request
async function createShopFromRequest(accountRequest: any) {
  // Generate a random password for the owner
  const randomPassword = Math.random().toString(36).slice(-8) + 'Aa1!'

  console.log("🏪 Creating shop from request:", accountRequest.id)

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

  if (authError) throw authError
  console.log("✅ Auth user created:", authData.user.id)

  // 2. Create user profile
  const { error: profileError } = await supabaseAdmin
    .from('users')
    .insert([{ 
      id: authData.user.id, 
      full_name: accountRequest.name, 
      email: accountRequest.email,
      phone: accountRequest.contact
    }])

  if (profileError) throw profileError
  console.log("✅ User profile created")

  // 3. Get owner role
  const { data: role, error: roleError } = await supabaseAdmin
    .from('roles')
    .select('id')
    .eq('name', 'owner')
    .single()

  if (roleError) {
    console.error("Role fetch error:", roleError)
    // If role doesn't exist, create it
    const { data: newRole, error: createRoleError } = await supabaseAdmin
      .from('roles')
      .insert([{ name: 'owner' }])
      .select()
      .single()
    
    if (createRoleError) throw createRoleError
    console.log("✅ Owner role created:", newRole.id)
    
    // Assign the new role
    const { error: userRoleError } = await supabaseAdmin
      .from('user_roles')
      .insert([{ 
        user_id: authData.user.id, 
        role_id: newRole.id 
      }])
    
    if (userRoleError) throw userRoleError
    console.log("✅ User role assigned")
  } else {
    // Assign existing role
    const { error: userRoleError } = await supabaseAdmin
      .from('user_roles')
      .insert([{ 
        user_id: authData.user.id, 
        role_id: role.id 
      }])

    if (userRoleError) throw userRoleError
    console.log("✅ User role assigned")
  }

  // 4. Create shop
  const { data: shop, error: shopError } = await supabaseAdmin
    .from('shops')
    .insert([{
      name: accountRequest.shop_name,
      description: `Laundry shop at ${accountRequest.shop_address}`,
      owner_id: authData.user.id
    }])
    .select()
    .single()

  if (shopError) throw shopError
  console.log("✅ Shop created:", shop.id)

  // 5. Create shop branch
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

  if (branchError) throw branchError
  console.log("✅ Shop branch created")

  // 6. Create shop user assignment (CRITICAL - this is what your frontend expects)
  const { error: assignmentError } = await supabaseAdmin
    .from('shop_user_assignments')
    .insert([{
      user_id: authData.user.id,
      shop_id: shop.id,
      branch_id: branch.id,
      role_in_shop: 'owner',
      is_active: true
    }])

  if (assignmentError) throw assignmentError
  console.log("✅ Shop user assignment created")

  // 7. Create default services for the branch
  await createDefaultServices(branch.id)
  console.log("✅ Default services created")

  // 8. Send approval email with credentials
  await sendApprovalEmail(
    accountRequest.email,
    accountRequest.name,
    randomPassword,
    accountRequest.shop_name
  )

  console.log("🎉 Shop owner account created and email sent")
}

// Helper function to create default services for a new branch
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

    if (servicesError) throw servicesError

  } catch (error) {
    console.error("Error creating default services:", error)
    // Don't throw here - services creation shouldn't block the main flow
  }
}

// Optional: Add GET method to fetch specific account request
export async function GET(
  request: NextRequest, // ✅ Also use NextRequest here
  { params }: { params: { id: string } }
) {
  try {
    const requestId = params.id

    const { data: accountRequest, error } = await supabaseAdmin
      .from('account_requests')
      .select('*')
      .eq('id', requestId)
      .single()

    if (error || !accountRequest) {
      return NextResponse.json({ error: "Account request not found" }, { status: 404 })
    }

    return NextResponse.json({ request: accountRequest })
  } catch (error: any) {
    console.error("Error fetching account request:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}