// app/api/admin/branches/route.ts
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { verifyAdminAccess } from '@/lib/auth-utils'
import { NextResponse } from 'next/server'

// POST /api/admin/branches - Create new branch (Admin only)
export async function POST(request: Request) {
  try {
    console.log('Starting branch creation request...');
    
    // 🔒 Verify admin authentication and authorization
    const authResult = await verifyAdminAccess()
    if (!authResult.authorized) {
      console.log('Admin access denied:', authResult.error);
      return NextResponse.json({ error: authResult.error }, { status: authResult.status })
    }
    console.log('Admin access verified for user:', authResult.userId);

    // 🔒 Safe JSON parsing
    let requestBody;
    try {
      requestBody = await request.json();
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      return NextResponse.json({ error: "Invalid JSON in request body" }, { status: 400 })
    }

    const { shop_id, name, address, latitude, longitude } = requestBody;
    console.log('Creating branch with data:', { shop_id, name, address, latitude, longitude });
    
    // 🔒 Input validation
    if (!shop_id || !name?.trim() || !address?.trim()) {
      return NextResponse.json({ 
        error: "Shop ID, branch name, and address are required" 
      }, { status: 400 })
    }

    if (latitude === undefined || longitude === undefined) {
      return NextResponse.json({ 
        error: "Branch location is required" 
      }, { status: 400 })
    }

    // UUID validation
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(shop_id)) {
      return NextResponse.json({ error: "Invalid shop ID" }, { status: 400 })
    }

    // Length validation
    if (name.trim().length > 100) {
      return NextResponse.json({ error: "Branch name too long" }, { status: 400 })
    }

    if (address.trim().length > 200) {
      return NextResponse.json({ error: "Address too long" }, { status: 400 })
    }

    // Coordinate validation
    if (typeof latitude !== 'number' || typeof longitude !== 'number') {
      return NextResponse.json({ error: "Invalid coordinates" }, { status: 400 })
    }

    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      return NextResponse.json({ error: "Invalid coordinate values" }, { status: 400 })
    }

    // 🔒 Verify shop exists
    console.log('Verifying shop exists:', shop_id);
    const { data: shop, error: shopError } = await supabaseAdmin
      .from('shops')
      .select('id, name')
      .eq('id', shop_id)
      .single()

    if (shopError || !shop) {
      console.error('Shop not found:', shopError);
      return NextResponse.json({ error: "Shop not found" }, { status: 404 })
    }

    // 🔒 Check for duplicate branch names in same shop
    console.log('Checking for duplicate branch names...');
    const { data: existingBranch, error: duplicateError } = await supabaseAdmin
      .from('shop_branches')
      .select('id')
      .eq('shop_id', shop_id)
      .eq('name', name.trim())
      .maybeSingle()

    if (duplicateError) {
      console.error('Duplicate check error:', duplicateError);
      return NextResponse.json({ error: "Failed to validate branch" }, { status: 500 })
    }

    if (existingBranch) {
      return NextResponse.json({ error: "Branch name already exists for this shop" }, { status: 400 })
    }

    // Create the branch
    console.log('Creating branch in database...');
    const { data: branch, error } = await supabaseAdmin
      .from('shop_branches')
      .insert([{ 
        shop_id, 
        name: name.trim(), 
        address: address.trim(), 
        latitude, 
        longitude,
        is_active: true
      }])
      .select()
      .single()

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json({ error: "Failed to create branch" }, { status: 500 })
    }

    console.log('Branch created successfully:', branch.id);

    // 🔒 Audit log the branch creation
    try {
      console.log('Creating audit log...');
      await supabaseAdmin
        .from('admin_audit_logs')
        .insert({
          admin_id: authResult.userId,
          action: 'branch_creation',
          target_shop_id: shop_id,
          target_branch_id: branch.id,
          target_shop_name: shop.name,
          description: `Created branch: ${name.trim()} for shop: ${shop.name}`,
          ip_address: request.headers.get('x-forwarded-for')?.split(',')[0] || request.headers.get('x-real-ip') || 'unknown',
          user_agent: request.headers.get('user-agent') || 'unknown',
          created_at: new Date().toISOString()
        })
      console.log('Audit log created successfully');
    } catch (auditError) {
      console.error('Audit log error:', auditError);
      // Don't fail the request if audit logging fails
    }

    return NextResponse.json({ branch });
  } catch (error: any) {
    console.error('Unexpected error in branch creation:', error);
    return NextResponse.json({ error: "Failed to create branch" }, { status: 500 });
  }
}

// GET /api/admin/branches - Get all branches with pagination and filtering (Admin only)
export async function GET(request: Request) {
  try {
    console.log('Fetching branches...');
    
    // 🔒 Verify admin authentication and authorization
    const authResult = await verifyAdminAccess()
    if (!authResult.authorized) {
      console.log('Admin access denied:', authResult.error);
      return NextResponse.json({ error: authResult.error }, { status: authResult.status })
    }

    const { searchParams } = new URL(request.url)
    const shop_id = searchParams.get('shop_id')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const search = searchParams.get('search')

    console.log('Fetching branches with params:', { shop_id, page, limit, search });

    // Validate pagination parameters
    if (page < 1 || limit < 1 || limit > 100) {
      return NextResponse.json({ error: "Invalid pagination parameters" }, { status: 400 })
    }

    const from = (page - 1) * limit
    const to = from + limit - 1

    let query = supabaseAdmin
      .from('shop_branches')
      .select(`
        *,
        shops (
          id,
          name
        )
      `, { count: 'exact' })

    // Apply filters
    if (shop_id) {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(shop_id)) {
        return NextResponse.json({ error: "Invalid shop ID" }, { status: 400 })
      }
      query = query.eq('shop_id', shop_id)
    }

    if (search) {
      query = query.or(`name.ilike.%${search}%,address.ilike.%${search}%`)
    }

    // Apply pagination and ordering
    const { data: branches, error, count } = await query
      .order('created_at', { ascending: false })
      .range(from, to)

    if (error) {
      console.error('Error fetching branches:', error);
      return NextResponse.json({ error: "Failed to fetch branches" }, { status: 500 })
    }

    console.log(`Fetched ${branches?.length || 0} branches`);

    return NextResponse.json({
      branches,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      }
    })
  } catch (error: any) {
    console.error('Error fetching branches:', error);
    return NextResponse.json({ error: "Failed to fetch branches" }, { status: 500 })
  }
}