// app/api/account-requests/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { sendEmailNodemailer } from '@/lib/nodemailer';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const {
      name,
      email,
      contact,
      shopName,
      shopAddress,
      latitude,
      longitude,
      locationAddress,
    } = body;

    // Validate required fields
    if (!name || !email || !contact || !shopName || !shopAddress || !latitude || !longitude) {
      return NextResponse.json(
        { error: 'All fields are required' },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Please provide a valid email address' },
        { status: 400 }
      );
    }

    console.log('🔍 Checking for existing accounts...');

    // 1. Check if email already exists in users table (already an owner)
    const { data: existingUser, error: userError } = await supabase
      .from('users')
      .select('id, email')
      .eq('email', email.trim().toLowerCase())
      .single();

    if (userError && userError.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error('Error checking existing user:', userError);
    }

    if (existingUser) {
      return NextResponse.json(
        { error: 'This email is already registered as a shop owner' },
        { status: 409 }
      );
    }

    // 2. Check if shop name already exists in shops table
    const { data: existingShop, error: shopError } = await supabase
      .from('shops')
      .select('id, name')
      .ilike('name', shopName.trim()) // Case-insensitive search
      .single();

    if (shopError && shopError.code !== 'PGRST116') {
      console.error('Error checking existing shop:', shopError);
    }

    if (existingShop) {
      return NextResponse.json(
        { error: 'A shop with this name already exists' },
        { status: 409 }
      );
    }

    // 3. Check if there's already a pending request with this email
    const { data: pendingRequest, error: pendingError } = await supabase
      .from('account_requests')
      .select('id, email, status')
      .eq('email', email.trim().toLowerCase())
      .eq('status', 'pending')
      .single();

    if (pendingError && pendingError.code !== 'PGRST116') {
      console.error('Error checking pending requests:', pendingError);
    }

    if (pendingRequest) {
      return NextResponse.json(
        { error: 'You already have a pending account request. Please wait for our team to review it.' },
        { status: 409 }
      );
    }

    // 4. Check if there's already a pending request with this shop name
    const { data: pendingShopRequest, error: pendingShopError } = await supabase
      .from('account_requests')
      .select('id, shop_name, status')
      .ilike('shop_name', shopName.trim())
      .eq('status', 'pending')
      .single();

    if (pendingShopError && pendingShopError.code !== 'PGRST116') {
      console.error('Error checking pending shop requests:', pendingShopError);
    }

    if (pendingShopRequest) {
      return NextResponse.json(
        { error: 'There is already a pending request for a shop with this name' },
        { status: 409 }
      );
    }

    console.log('✅ No duplicates found, creating account request...');

    // ✅ SAVE TO SUPABASE DATABASE
    const { data: accountRequest, error: dbError } = await supabase
      .from('account_requests')
      .insert([
        {
          name: name.trim(),
          email: email.trim().toLowerCase(),
          contact: contact.trim(),
          shop_name: shopName.trim(),
          shop_address: shopAddress.trim(),
          latitude: parseFloat(latitude),
          longitude: parseFloat(longitude),
          location_address: locationAddress?.trim() || null,
          status: 'pending'
        }
      ])
      .select()
      .single();

    if (dbError) {
      console.error('Database error:', dbError);
      return NextResponse.json(
        { error: 'Failed to save account request' },
        { status: 500 }
      );
    }

    console.log('✅ Account request saved, sending confirmation email...');

    // Send confirmation email to user
    try {
      await sendEmailNodemailer({
        to: email.trim().toLowerCase(),
        subject: 'LaundryGo Account Request Received',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #7C3AED; text-align: center;">Thank You for Your Interest! 🎉</h2>
            
            <p>Dear <strong>${name}</strong>,</p>
            
            <p>We have received your request for a laundry shop owner account with LaundryGo. Our team will carefully review your application and contact you within 24-48 hours.</p>
            
            <div style="background: #f8fafc; padding: 20px; border-radius: 8px; border-left: 4px solid #7C3AED; margin: 20px 0;">
              <h3 style="color: #334155; margin-top: 0;">Request Details:</h3>
              <p><strong>Shop Name:</strong> ${shopName}</p>
              <p><strong>Contact:</strong> ${contact}</p>
              <p><strong>Email:</strong> ${email}</p>
              <p><strong>Submitted:</strong> ${new Date().toLocaleString()}</p>
            </div>
            
            <p><strong>What happens next?</strong></p>
            <ol>
              <li>Our team reviews your application</li>
              <li>We verify your shop location and details</li>
              <li>You'll receive an approval decision via email</li>
              <li>If approved, you'll get your shop dashboard access</li>
            </ol>
            
            <p>If you have any questions or need to update your application details, please contact us at support@laundryapp.com</p>
            
            <p>Best regards,<br>
            <strong>The LaundryGo Team</strong></p>
            
            <hr style="margin: 30px 0; border: none; border-top: 1px solid #e2e8f0;">
            <p style="color: #64748b; font-size: 12px; text-align: center;">
              This is an automated message. Please do not reply to this email.
            </p>
          </div>
        `
      });
      console.log('✅ Confirmation email sent successfully');
    } catch (emailError) {
      console.error('❌ Failed to send confirmation email:', emailError);
      // Don't fail the request if email fails
    }

    return NextResponse.json(
      { 
        success: true, 
        message: 'Account request submitted successfully',
        data: accountRequest
      },
      { status: 201 }
    );

  } catch (error) {
    console.error('💥 Account request error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}