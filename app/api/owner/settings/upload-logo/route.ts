import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { supabaseServer } from '@/lib/supabaseServer'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    console.log('🔄 Starting shop logo upload process...')
    
    const supabaseAuth = await supabaseServer()
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser()

    if (authError || !user) {
      console.error('❌ Auth error:', authError)
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }

    console.log('✅ User authenticated:', user.id)

    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    console.log('📁 File details:', {
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type
    })

    // Get the user's shop (with current logo URL)
    const { data: shop, error: shopError } = await supabaseAdmin
      .from('shops')
      .select('id, name, logo_url')
      .eq('owner_id', user.id)
      .single()

    if (shopError) {
      console.error('❌ Shop query error:', shopError)
      return NextResponse.json({ error: "Failed to find shop" }, { status: 500 })
    }

    if (!shop) {
      return NextResponse.json({ error: "No shop found for this user" }, { status: 404 })
    }

    console.log('🏪 Shop found:', shop.name)
    console.log('🗑️ Current logo URL:', shop.logo_url)

    // Validate file
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
    const maxSize = 5 * 1024 * 1024 // 5MB

    if (!validTypes.includes(file.type)) {
      return NextResponse.json({ 
        error: 'Invalid file type. Please upload JPEG, PNG, or WebP image.' 
      }, { status: 400 })
    }

    if (file.size > maxSize) {
      return NextResponse.json({ 
        error: 'File too large. Maximum size is 5MB.' 
      }, { status: 400 })
    }

    // DELETE OLD LOGO IF EXISTS
    if (shop.logo_url) {
      try {
        // Extract filename from current logo URL
        const currentLogoPath = shop.logo_url.split('/').pop()
        if (currentLogoPath) {
          console.log('🗑️ Deleting old logo:', currentLogoPath)
          const { error: deleteError } = await supabaseAdmin.storage
            .from('shop-logos')
            .remove([`${shop.id}/${currentLogoPath}`])
          
          if (deleteError) {
            console.warn('⚠️ Could not delete old logo:', deleteError.message)
            // Continue with upload even if delete fails
          } else {
            console.log('✅ Old logo deleted successfully')
          }
        }
      } catch (deleteError) {
        console.warn('⚠️ Error during old logo deletion:', deleteError)
        // Continue with upload
      }
    }

    // Create unique filename
    const fileExt = file.name.split('.').pop()?.toLowerCase() || 'png'
    const fileName = `${shop.id}/logo-${Date.now()}.${fileExt}`

    console.log('📤 Uploading new file to storage:', fileName)

    // Convert file to buffer
    const fileBuffer = await file.arrayBuffer()

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
      .from('shop-logos')
      .upload(fileName, fileBuffer, {
        contentType: file.type,
        upsert: true
      })

    if (uploadError) {
      console.error('❌ Storage upload error:', uploadError)
      return NextResponse.json({ 
        error: `Failed to upload logo: ${uploadError.message}` 
      }, { status: 500 })
    }

    console.log('✅ File uploaded successfully')

    // Get public URL
    const { data: { publicUrl } } = supabaseAdmin.storage
      .from('shop-logos')
      .getPublicUrl(fileName)

    console.log('🔗 New public URL:', publicUrl)

    // Update shop with new logo URL
    const { error: updateError } = await supabaseAdmin
      .from('shops')
      .update({ 
        logo_url: publicUrl,
        updated_at: new Date().toISOString()
      })
      .eq('id', shop.id)

    if (updateError) {
      console.error('❌ Shop update error:', updateError)
      
      // Clean up: delete the newly uploaded file since update failed
      try {
        await supabaseAdmin.storage
          .from('shop-logos')
          .remove([fileName])
        console.log('🧹 Cleaned up new file due to update failure')
      } catch (deleteError) {
        console.error('Failed to cleanup uploaded file:', deleteError)
      }
      
      return NextResponse.json({ 
        error: `Failed to update shop: ${updateError.message}` 
      }, { status: 500 })
    }

    console.log('✅ Shop logo updated successfully')

    return NextResponse.json({ 
      url: publicUrl,
      message: 'Shop logo uploaded successfully'
    })

  } catch (error: any) {
    console.error('💥 Unexpected error:', error)
    return NextResponse.json({ 
      error: `Upload failed: ${error.message}` 
    }, { status: 500 })
  }
}