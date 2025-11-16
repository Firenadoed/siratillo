// app/api/account-requests/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { sendEmailNodemailer } from '@/lib/nodemailer';
import { createClient } from '@/lib/supabaseClient'; // Use regular client

const supabase = createClient();
export async function POST(request: NextRequest) {
  try {
    // 🔒 Request size validation
    const contentLength = request.headers.get('content-length');
    if (contentLength && parseInt(contentLength) > 10000) {
      return NextResponse.json(
        { error: 'Request too large' },
        { status: 413 }
      );
    }

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

    // 🔒 Enhanced input validation
    if (!name?.trim() || !email?.trim() || !contact?.trim() || !shopName?.trim() || !shopAddress?.trim() || !latitude || !longitude) {
      return NextResponse.json(
        { error: 'All fields are required' },
        { status: 400 }
      );
    }

    // Length validation
    if (name.trim().length > 100) {
      return NextResponse.json({ error: 'Name too long' }, { status: 400 });
    }
    if (email.trim().length > 100) {
      return NextResponse.json({ error: 'Email too long' }, { status: 400 });
    }
    if (contact.trim().length > 20) {
      return NextResponse.json({ error: 'Contact too long' }, { status: 400 });
    }
    if (shopName.trim().length > 100) {
      return NextResponse.json({ error: 'Shop name too long' }, { status: 400 });
    }
    if (shopAddress.trim().length > 200) {
      return NextResponse.json({ error: 'Shop address too long' }, { status: 400 });
    }

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      return NextResponse.json(
        { error: 'Please provide a valid email address' },
        { status: 400 }
      );
    }

    // Enhanced coordinate validation
    let lat: number, lng: number;
    try {
      // Handle both string and number inputs
      lat = typeof latitude === 'string' ? parseFloat(latitude) : latitude;
      lng = typeof longitude === 'string' ? parseFloat(longitude) : longitude;
      
      // Check if conversion resulted in valid numbers
      if (isNaN(lat) || isNaN(lng)) {
        return NextResponse.json(
          { error: 'Coordinates must be valid numbers' },
          { status: 400 }
        );
      }
      
      // Validate coordinate ranges
      if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        return NextResponse.json(
          { 
            error: 'Invalid coordinate values. Latitude must be between -90 and 90, longitude between -180 and 180' 
          },
          { status: 400 }
        );
      }
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid coordinate format' },
        { status: 400 }
      );
    }

    // 🔒 Check for existing accounts with proper error handling
    let existingUser, existingShop, pendingRequest, pendingShopRequest;

    try {
      // 1. Check if email already exists in users table
      const userResult = await supabase
        .from('users')
        .select('id')
        .eq('email', email.trim().toLowerCase())
        .maybeSingle();

      existingUser = userResult.data;

      // 2. Check if shop name already exists
      const shopResult = await supabase
        .from('shops')
        .select('id')
        .ilike('name', shopName.trim())
        .maybeSingle();

      existingShop = shopResult.data;

      // 3. Check for pending requests with this email
      const pendingResult = await supabase
        .from('account_requests')
        .select('id')
        .eq('email', email.trim().toLowerCase())
        .eq('status', 'pending')
        .maybeSingle();

      pendingRequest = pendingResult.data;

      // 4. Check for pending requests with this shop name
      const pendingShopResult = await supabase
        .from('account_requests')
        .select('id')
        .ilike('shop_name', shopName.trim())
        .eq('status', 'pending')
        .maybeSingle();

      pendingShopRequest = pendingShopResult.data;

    } catch (dbError) {
      // Use generic error message to avoid information disclosure
      return NextResponse.json(
        { error: 'Failed to validate request' },
        { status: 500 }
      );
    }

    // Return appropriate error messages
    if (existingUser) {
      return NextResponse.json(
        { error: 'This email is already registered' },
        { status: 409 }
      );
    }

    if (existingShop) {
      return NextResponse.json(
        { error: 'A shop with this name already exists' },
        { status: 409 }
      );
    }

    if (pendingRequest) {
      return NextResponse.json(
        { error: 'You already have a pending account request' },
        { status: 409 }
      );
    }

    if (pendingShopRequest) {
      return NextResponse.json(
        { error: 'There is already a pending request for a shop with this name' },
        { status: 409 }
      );
    }

    // 🔒 Save to database using regular client
    const { error: dbError } = await supabase
      .from('account_requests')
      .insert([
        {
          name: name.trim(),
          email: email.trim().toLowerCase(),
          contact: contact.trim(),
          shop_name: shopName.trim(),
          shop_address: shopAddress.trim(),
          latitude: lat,
          longitude: lng,
          location_address: locationAddress?.trim() || null,
          status: 'pending'
        }
      ]);

    if (dbError) {
      console.error('Database error:', dbError);
      
      // More specific error messages
      if (dbError.code === '42501') {
        return NextResponse.json(
          { error: 'Permission denied. Please check RLS policies.' },
          { status: 500 }
        );
      }
      
      if (dbError.code === '23505') {
        return NextResponse.json(
          { error: 'Duplicate entry found' },
          { status: 409 }
        );
      }
      
      return NextResponse.json(
        { error: 'Failed to submit account request' },
        { status: 500 }
      );
    }

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
            
            <p>If you have any questions, please contact our support team.</p>
            
            <p>Best regards,<br>
            <strong>The LaundryGo Team</strong></p>
          </div>
        `
      });
    } catch (emailError) {
      // Don't fail the request if email fails
      console.error('Failed to send confirmation email:', emailError);
    }

    return NextResponse.json(
      { 
        success: true, 
        message: 'Account request submitted successfully'
      },
      { status: 201 }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    );
  }
}