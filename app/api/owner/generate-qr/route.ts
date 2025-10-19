import { NextRequest, NextResponse } from 'next/server';
import QRCode from 'qrcode';
import { supabaseServer } from '@/lib/supabaseServer';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

// Define TypeScript interfaces
interface ShopBranch {
  id: string;
  shop_id: string;
  name: string;
}

interface Shop {
  id: string;
  owner_id: string;
  name: string;
}

interface ShopUserAssignment {
  role_in_shop: string;
  shop_id: string;
  shops: Shop[];
}

export async function POST(request: NextRequest) {
  try {
    console.log('🔵 QR Generation API Called');

    // Use the same server client pattern as your auth API
    const supabaseAuth = await supabaseServer();
    
    const { data: { session }, error: sessionError } = await supabaseAuth.auth.getSession();
    
    console.log('👤 Session check:', { 
      hasSession: !!session,
      userId: session?.user?.id,
      sessionError: sessionError?.message 
    });

    if (sessionError || !session) {
      console.log('❌ Session authentication failed:', sessionError?.message || 'No session');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { branch_id } = await request.json();
    console.log('📦 Request body:', { branch_id });

    if (!branch_id) {
      console.log('❌ Missing branch_id');
      return NextResponse.json({ error: 'Branch ID is required' }, { status: 400 });
    }

    console.log('✅ User authenticated:', session.user.id);

    // STEP 1: First get the branch and its shop_id
    console.log('🔍 Getting branch details...');
    const { data: branch, error: branchError } = await supabaseAdmin
      .from('shop_branches')
      .select('id, shop_id, name')
      .eq('id', branch_id)
      .single();

    if (branchError || !branch) {
      console.log('❌ Branch not found:', branchError?.message);
      return NextResponse.json({ error: 'Branch not found' }, { status: 404 });
    }

    console.log('🏪 Branch found:', { 
      branchName: branch.name, 
      shopId: branch.shop_id 
    });

    // STEP 2: Check if user is owner of the shop (not necessarily assigned to the specific branch)
    console.log('👑 Checking shop ownership...');
    const { data: shopAssignment, error: shopError } = await supabaseAdmin
      .from('shop_user_assignments')
      .select(`
        role_in_shop,
        shops!inner(id, owner_id)
      `)
      .eq('user_id', session.user.id)
      .eq('shop_id', branch.shop_id)
      .eq('role_in_shop', 'owner')
      .limit(1);

    console.log('📋 Shop ownership check result:', {
      hasShopAssignment: !!shopAssignment?.length,
      assignmentCount: shopAssignment?.length,
      shopError: shopError?.message,
      assignmentData: shopAssignment?.[0]
    });

    if (shopError) {
      console.log('❌ Shop assignment query error:', shopError);
      return NextResponse.json({ 
        error: 'Database error checking shop ownership',
        details: shopError.message
      }, { status: 500 });
    }

    if (!shopAssignment || shopAssignment.length === 0) {
      console.log('❌ User is not owner of this shop');
      
      // Debug: Check what shops the user actually owns
      const { data: userShops } = await supabaseAdmin
        .from('shop_user_assignments')
        .select('shop_id, role_in_shop, shops(name)')
        .eq('user_id', session.user.id)
        .eq('role_in_shop', 'owner');

      console.log('👤 User shop ownership debug:', {
        ownedShops: userShops?.length,
        shops: userShops?.map(s => ({
          shop_id: s.shop_id,
          shop_name: s.shops?.[0]?.name, // Access first element of array
          role: s.role_in_shop
        }))
      });

      return NextResponse.json({ 
        error: 'Not authorized - you are not the owner of this shop',
        details: {
          branchName: branch.name,
          shopId: branch.shop_id,
          userOwnsShops: userShops?.length || 0,
          userId: session.user.id
        }
      }, { status: 403 });
    }

    console.log('✅ User is owner of the shop:', branch.shop_id);

    // Generate QR code data - this will be scanned by the customer app
    const qrData = JSON.stringify({
      type: 'laundry_dropoff',
      branch_id: branch_id,
      branch_name: branch.name,
      timestamp: new Date().toISOString()
    });

    console.log('🎯 QR Code data generated:', qrData);

    // Generate QR code as data URL
    console.log('🖼️ Generating QR code image...');
    const qrCodeDataURL = await QRCode.toDataURL(qrData, {
      width: 400,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    });

    console.log('✅ QR code image generated');

    // Store QR code in database or update branch with QR info using admin client
    console.log('💾 Storing QR data in database...');
    const { error: updateError } = await supabaseAdmin
      .from('shop_branches')
      .update({ 
        qr_code_data: qrData,
        qr_generated_at: new Date().toISOString()
      })
      .eq('id', branch_id);

    if (updateError) {
      console.error('❌ Error storing QR data:', updateError);
      return NextResponse.json({ error: 'Failed to store QR code data' }, { status: 500 });
    }

    console.log('✅ QR data stored successfully');
    console.log('🎉 QR generation completed successfully');

    return NextResponse.json({
      qr_code: qrCodeDataURL,
      branch_id: branch_id,
      branch_name: branch.name,
      generated_at: new Date().toISOString()
    });

  } catch (error) {
    console.error('💥 QR generation error:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}