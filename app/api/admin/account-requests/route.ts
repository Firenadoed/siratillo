// app/api/admin/account-requests/route.ts
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { verifyAdminAccess } from '@/lib/auth-utils'
import { NextResponse } from 'next/server'

// GET /api/admin/account-requests - Get all account requests (Admin only)
export async function GET(request: Request) {
  try {
    // 🔒 Verify admin authentication and authorization
    const authResult = await verifyAdminAccess()
    if (!authResult.authorized) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')

    // 🔒 Input validation for status parameter
    const validStatuses = ['pending', 'approved', 'rejected', 'all']
    if (status && !validStatuses.includes(status)) {
      return NextResponse.json({ error: "Invalid status parameter" }, { status: 400 })
    }

    let query = supabaseAdmin
      .from('account_requests')
      .select(`
        id,
        name,
        email,
        contact,
        shop_name,
        shop_address,
        location_address,
        status,
        submitted_at,
        notes
      `)
      .order('submitted_at', { ascending: false })

    // Apply status filter if provided and valid
    if (status && status !== 'all') {
      query = query.eq('status', status)
    }

    const { data: requests, error } = await query

    if (error) {
      console.error('Error fetching account requests:', error)
      return NextResponse.json({ error: "Failed to fetch account requests" }, { status: 500 })
    }

    // 🔒 Audit log the access
    try {
      await supabaseAdmin
        .from('admin_audit_logs')
        .insert({
          admin_id: authResult.userId,
          action: 'view_account_requests',
          description: `Viewed ${requests?.length || 0} account requests${status ? ` with status: ${status}` : ''}`,
          ip_address: request.headers.get('x-forwarded-for')?.split(',')[0] || request.headers.get('x-real-ip') || 'unknown',
          user_agent: request.headers.get('user-agent') || 'unknown',
          created_at: new Date().toISOString()
        })
    } catch (auditError) {
      console.error('Audit log error:', auditError)
      // Don't fail the request if audit logging fails
    }

    return NextResponse.json({ requests: requests || [] })

  } catch (error: any) {
    console.error('Error in account requests GET:', error)
    return NextResponse.json({ error: "Failed to fetch account requests" }, { status: 500 })
  }
}

// POST /api/admin/account-requests - Create new account request (Public - no auth required)
export async function POST(request: Request) {
  try {
    // 🔒 Safe JSON parsing
    let requestBody;
    try {
      requestBody = await request.json();
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      return NextResponse.json({ error: "Invalid JSON in request body" }, { status: 400 })
    }

    const { 
      name, 
      email, 
      contact, 
      shop_name, 
      shop_address, 
      latitude, 
      longitude, 
      location_address 
    } = requestBody;

    // 🔒 Input validation
    if (!name?.trim() || !email?.trim() || !contact?.trim() || !shop_name?.trim() || !shop_address?.trim()) {
      return NextResponse.json({ 
        error: "Name, email, contact, shop name, and shop address are required" 
      }, { status: 400 })
    }

    if (latitude === undefined || longitude === undefined) {
      return NextResponse.json({ 
        error: "Shop location is required" 
      }, { status: 400 })
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      return NextResponse.json({ error: "Invalid email format" }, { status: 400 })
    }

    // Length validation
    if (name.trim().length > 100) return NextResponse.json({ error: "Name too long" }, { status: 400 })
    if (email.trim().length > 100) return NextResponse.json({ error: "Email too long" }, { status: 400 })
    if (contact.trim().length > 20) return NextResponse.json({ error: "Contact too long" }, { status: 400 })
    if (shop_name.trim().length > 100) return NextResponse.json({ error: "Shop name too long" }, { status: 400 })
    if (shop_address.trim().length > 200) return NextResponse.json({ error: "Shop address too long" }, { status: 400 })
    if (location_address?.trim().length > 200) return NextResponse.json({ error: "Location address too long" }, { status: 400 })

    // Coordinate validation
    if (typeof latitude !== 'number' || typeof longitude !== 'number') {
      return NextResponse.json({ error: "Invalid coordinates" }, { status: 400 })
    }

    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      return NextResponse.json({ error: "Invalid coordinate values" }, { status: 400 })
    }

    // 🔒 Check for duplicate pending requests with same email or shop name
    const { data: existingRequest, error: duplicateError } = await supabaseAdmin
      .from('account_requests')
      .select('id')
      .or(`email.eq.${email.trim()},shop_name.eq.${shop_name.trim()}`)
      .eq('status', 'pending')
      .maybeSingle()

    if (duplicateError) {
      console.error('Duplicate check error:', duplicateError)
      return NextResponse.json({ error: "Failed to validate request" }, { status: 500 })
    }

    if (existingRequest) {
      return NextResponse.json({ error: "A pending request with this email or shop name already exists" }, { status: 400 })
    }

    // Create the account request
    const { data: accountRequest, error } = await supabaseAdmin
      .from('account_requests')
      .insert([{ 
        name: name.trim(),
        email: email.trim(),
        contact: contact.trim(),
        shop_name: shop_name.trim(),
        shop_address: shop_address.trim(),
        latitude,
        longitude,
        location_address: location_address?.trim(),
        status: 'pending'
      }])
      .select()
      .single()

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json({ error: "Failed to create account request" }, { status: 500 })
    }

    return NextResponse.json({ accountRequest }, { status: 201 })

  } catch (error: any) {
    console.error('Unexpected error in account request creation:', error)
    return NextResponse.json({ error: "Failed to create account request" }, { status: 500 })
  }
}