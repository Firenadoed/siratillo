import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { supabaseServer } from '@/lib/supabaseServer'
import { NextResponse } from 'next/server'

// GET - Fetch services and methods for a specific branch
export async function GET(request: Request) {
  try {
    const supabaseAuth = await supabaseServer()
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }

    // Get branch_id from query parameters
    const { searchParams } = new URL(request.url)
    const branchId = searchParams.get('branch_id')

    // Get owner's shop
    const { data: shop, error: shopError } = await supabaseAdmin
      .from('shops')
      .select('id')
      .eq('owner_id', user.id)
      .single()

    if (shopError || !shop) {
      return NextResponse.json({ error: "No shop found" }, { status: 404 })
    }

    let targetBranchId: string | null = null

    if (branchId) {
      // Verify the requested branch belongs to the owner's shop
      const { data: branch } = await supabaseAdmin
        .from('shop_branches')
        .select('id, name')
        .eq('id', branchId)
        .eq('shop_id', shop.id)
        .eq('is_active', true)
        .single()

      if (!branch) {
        return NextResponse.json({ error: "Invalid branch" }, { status: 400 })
      }
      targetBranchId = branchId
    } else {
      // Get first active branch if no branch_id provided
      const { data: branch } = await supabaseAdmin
        .from('shop_branches')
        .select('id, name')
        .eq('shop_id', shop.id)
        .eq('is_active', true)
        .limit(1)
        .single()

      if (!branch) {
        return NextResponse.json({ 
          shopId: shop.id,
          branchId: null,
          branchName: null,
          methods: {
            dropoff_enabled: false,
            delivery_enabled: false,
            pickup_enabled: false,
            self_service_enabled: false
          },
          services: [],
          error: "No active branch found"
        })
      }
      targetBranchId = branch.id
    }

    // Get methods from shop_methods and branch_methods for the specific branch
    const { data: shopMethods } = await supabaseAdmin
      .from('shop_methods')
      .select('id, code, label')

    // Get enabled methods for the specific branch
    const { data: branchMethods } = await supabaseAdmin
      .from('branch_methods')
      .select('method_id, is_enabled')
      .eq('branch_id', targetBranchId)

    // Transform methods data to match your frontend expectations
    const methodsMap = new Map()
    shopMethods?.forEach(method => {
      const branchMethod = branchMethods?.find(bm => bm.method_id === method.id)
      methodsMap.set(method.code, branchMethod?.is_enabled ?? false)
    })

    // Get services from shop_services for the specific branch
    const { data: services } = await supabaseAdmin
      .from('shop_services')
      .select('*')
      .eq('branch_id', targetBranchId)
      .eq('is_active', true)
      .order('created_at', { ascending: true })

    // Get branch name for response
    const { data: currentBranch } = await supabaseAdmin
      .from('shop_branches')
      .select('name')
      .eq('id', targetBranchId)
      .single()

    return NextResponse.json({
      shopId: shop.id,
      branchId: targetBranchId,
      branchName: currentBranch?.name || 'Unknown Branch',
      methods: {
        dropoff_enabled: methodsMap.get('dropoff') ?? false,
        delivery_enabled: methodsMap.get('delivery') ?? false,
        pickup_enabled: methodsMap.get('pickup') ?? false,
        self_service_enabled: methodsMap.get('self_service') ?? false
      },
      services: (services || []).map(service => ({
        id: service.id,
        name: service.name,
        price: service.price_per_kg,
        description: service.description,
        image_url: service.image_url
      })),
      error: null
    })

  } catch (error: any) {
    console.error("Services GET error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST - Add new service to a specific branch with image
export async function POST(request: Request) {
  try {
    const supabaseAuth = await supabaseServer()
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }

    const formData = await request.formData()
    const name = formData.get('name') as string
    const price = formData.get('price') as string
    const description = formData.get('description') as string
    const branchId = formData.get('branchId') as string
    const imageFile = formData.get('image') as File | null

    if (!name || !price || !description || !branchId) {
      return NextResponse.json({ error: "All fields are required" }, { status: 400 })
    }

    // Verify the branch belongs to owner's shop
    const { data: shop } = await supabaseAdmin
      .from('shops')
      .select('id')
      .eq('owner_id', user.id)
      .single()

    if (!shop) {
      return NextResponse.json({ error: "No shop found" }, { status: 404 })
    }

    const { data: branch } = await supabaseAdmin
      .from('shop_branches')
      .select('id')
      .eq('id', branchId)
      .eq('shop_id', shop.id)
      .eq('is_active', true)
      .single()

    if (!branch) {
      return NextResponse.json({ error: "Invalid branch" }, { status: 400 })
    }

    // Check if service name already exists in this branch
    const { data: existing } = await supabaseAdmin
      .from('shop_services')
      .select('id')
      .eq('branch_id', branchId)
      .ilike('name', name.trim())

    if (existing && existing.length > 0) {
      return NextResponse.json({ error: "A service with this name already exists in this branch" }, { status: 409 })
    }

    let imageUrl = null

    // Upload image if provided
    if (imageFile) {
      const fileExt = imageFile.name.split('.').pop()
      const fileName = `${user.id}/${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`
      const filePath = `service-icons/${fileName}`

      const { data: uploadData, error: uploadError } = await supabaseAdmin
        .storage
        .from('services')
        .upload(filePath, imageFile)

      if (uploadError) {
        console.error("Image upload error:", uploadError)
        return NextResponse.json({ error: "Failed to upload image" }, { status: 500 })
      }

      // Get public URL
      const { data: { publicUrl } } = supabaseAdmin
        .storage
        .from('services')
        .getPublicUrl(filePath)

      imageUrl = publicUrl
    }

    // Insert into shop_services for the specific branch
    const { data, error } = await supabaseAdmin
      .from('shop_services')
      .insert([
        {
          branch_id: branchId,
          name: name.trim(),
          price_per_kg: parseFloat(price),
          description: description.trim(),
          image_url: imageUrl,
          is_active: true,
        },
      ])
      .select()

    if (error) {
      console.error("Insert service error:", error)
      return NextResponse.json({ error: "Failed to add service" }, { status: 500 })
    }

    // Transform response to match frontend expectations
    const transformedService = {
      id: data[0].id,
      name: data[0].name,
      price: data[0].price_per_kg,
      description: data[0].description,
      image_url: data[0].image_url
    }

    return NextResponse.json({ service: transformedService, error: null })

  } catch (error: any) {
    console.error("Services POST error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// PUT - Update service with optional image update
export async function PUT(request: Request) {
  try {
    const supabaseAuth = await supabaseServer()
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }

    const formData = await request.formData()
    const id = formData.get('id') as string
    const name = formData.get('name') as string
    const price = formData.get('price') as string
    const description = formData.get('description') as string
    const imageFile = formData.get('image') as File | null
    const removeImage = formData.get('removeImage') === 'true'

    if (!id || !name || !price || !description) {
      return NextResponse.json({ error: "All fields are required" }, { status: 400 })
    }

    // Verify the service belongs to owner's shop
    const { data: shop } = await supabaseAdmin
      .from('shops')
      .select('id')
      .eq('owner_id', user.id)
      .single()

    if (!shop) {
      return NextResponse.json({ error: "No shop found" }, { status: 404 })
    }

    // Check service ownership through branch and shop
    const { data: service } = await supabaseAdmin
      .from('shop_services')
      .select('id, branch_id, image_url')
      .eq('id', id)
      .single()

    if (!service) {
      return NextResponse.json({ error: "Service not found" }, { status: 404 })
    }

    // Verify branch belongs to shop
    const { data: branch } = await supabaseAdmin
      .from('shop_branches')
      .select('id')
      .eq('id', service.branch_id)
      .eq('shop_id', shop.id)
      .single()

    if (!branch) {
      return NextResponse.json({ error: "Service access denied" }, { status: 403 })
    }

    let imageUrl = service.image_url

    // Handle image removal
    if (removeImage && service.image_url) {
      // Extract file path from URL and delete from storage
      const urlParts = service.image_url.split('/')
      const fileName = urlParts[urlParts.length - 1]
      const filePath = `service-icons/${user.id}/${fileName}`

      await supabaseAdmin
        .storage
        .from('services')
        .remove([filePath])

      imageUrl = null
    }

    // Upload new image if provided
    if (imageFile) {
      // Delete old image if exists
      if (service.image_url) {
        const urlParts = service.image_url.split('/')
        const fileName = urlParts[urlParts.length - 1]
        const filePath = `service-icons/${user.id}/${fileName}`

        await supabaseAdmin
          .storage
          .from('services')
          .remove([filePath])
      }

      const fileExt = imageFile.name.split('.').pop()
      const fileName = `${user.id}/${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`
      const filePath = `service-icons/${fileName}`

      const { data: uploadData, error: uploadError } = await supabaseAdmin
        .storage
        .from('services')
        .upload(filePath, imageFile)

      if (uploadError) {
        console.error("Image upload error:", uploadError)
        return NextResponse.json({ error: "Failed to upload image" }, { status: 500 })
      }

      const { data: { publicUrl } } = supabaseAdmin
        .storage
        .from('services')
        .getPublicUrl(filePath)

      imageUrl = publicUrl
    }

    // Update shop_services
    const { error } = await supabaseAdmin
      .from('shop_services')
      .update({
        name: name.trim(),
        price_per_kg: parseFloat(price),
        description: description.trim(),
        image_url: imageUrl,
      })
      .eq('id', id)

    if (error) {
      console.error("Update service error:", error)
      return NextResponse.json({ error: "Failed to update service" }, { status: 500 })
    }

    return NextResponse.json({ error: null })

  } catch (error: any) {
    console.error("Services PUT error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// PATCH - Update laundry methods for a specific branch
export async function PATCH(request: Request) {
  try {
    const supabaseAuth = await supabaseServer()
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }

    const { field, value, branchId } = await request.json()

    if (!field || typeof value !== 'boolean' || !branchId) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 })
    }

    // Verify the branch belongs to owner's shop
    const { data: shop } = await supabaseAdmin
      .from('shops')
      .select('id')
      .eq('owner_id', user.id)
      .single()

    if (!shop) {
      return NextResponse.json({ error: "No shop found" }, { status: 404 })
    }

    const { data: branch } = await supabaseAdmin
      .from('shop_branches')
      .select('id')
      .eq('id', branchId)
      .eq('shop_id', shop.id)
      .eq('is_active', true)
      .single()

    if (!branch) {
      return NextResponse.json({ error: "Invalid branch" }, { status: 400 })
    }

    // Map frontend field names to your method codes
    const fieldToMethodCode: Record<string, string> = {
      'dropoff_enabled': 'dropoff',
      'delivery_enabled': 'delivery', 
      'pickup_enabled': 'pickup',
      'self_service_enabled': 'self_service'
    }

    const methodCode = fieldToMethodCode[field]
    if (!methodCode) {
      return NextResponse.json({ error: "Invalid method field" }, { status: 400 })
    }

    // Get method ID
    const { data: method } = await supabaseAdmin
      .from('shop_methods')
      .select('id')
      .eq('code', methodCode)
      .single()

    if (!method) {
      return NextResponse.json({ error: "Method not found" }, { status: 404 })
    }

    // Update branch_methods for the specific branch
    const { data: existing } = await supabaseAdmin
      .from('branch_methods')
      .select('method_id')
      .eq('branch_id', branchId)
      .eq('method_id', method.id)
      .maybeSingle()

    if (existing) {
      // Update existing
      const { error } = await supabaseAdmin
        .from('branch_methods')
        .update({ is_enabled: value })
        .eq('branch_id', branchId)
        .eq('method_id', method.id)

      if (error) {
        console.error("Update method error:", error)
        return NextResponse.json({ error: "Failed to update method" }, { status: 500 })
      }
    } else {
      // Insert new
      const { error } = await supabaseAdmin
        .from('branch_methods')
        .insert([{ 
          branch_id: branchId, 
          method_id: method.id,
          is_enabled: value
        }])

      if (error) {
        console.error("Create method error:", error)
        return NextResponse.json({ error: "Failed to create method" }, { status: 500 })
      }
    }

    return NextResponse.json({ error: null })

  } catch (error: any) {
    console.error("Services PATCH error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// DELETE - Remove service (soft delete)
export async function DELETE(request: Request) {
  try {
    const supabaseAuth = await supabaseServer()
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }

    const { id } = await request.json()

    if (!id) {
      return NextResponse.json({ error: "Service ID is required" }, { status: 400 })
    }

    // Verify the service belongs to owner's shop
    const { data: shop } = await supabaseAdmin
      .from('shops')
      .select('id')
      .eq('owner_id', user.id)
      .single()

    if (!shop) {
      return NextResponse.json({ error: "No shop found" }, { status: 404 })
    }

    // Check service ownership through branch and shop
    const { data: service } = await supabaseAdmin
      .from('shop_services')
      .select('id, branch_id, image_url')
      .eq('id', id)
      .single()

    if (!service) {
      return NextResponse.json({ error: "Service not found" }, { status: 404 })
    }

    // Verify branch belongs to shop
    const { data: branch } = await supabaseAdmin
      .from('shop_branches')
      .select('id')
      .eq('id', service.branch_id)
      .eq('shop_id', shop.id)
      .single()

    if (!branch) {
      return NextResponse.json({ error: "Service access denied" }, { status: 403 })
    }

    // Delete image from storage if exists
    if (service.image_url) {
      const urlParts = service.image_url.split('/')
      const fileName = urlParts[urlParts.length - 1]
      const filePath = `service-icons/${user.id}/${fileName}`

      await supabaseAdmin
        .storage
        .from('services')
        .remove([filePath])
    }

    // Soft delete by setting is_active = false
    const { error } = await supabaseAdmin
      .from('shop_services')
      .update({ is_active: false })
      .eq('id', id)

    if (error) {
      console.error("Delete service error:", error)
      return NextResponse.json({ error: "Failed to delete service" }, { status: 500 })
    }

    return NextResponse.json({ error: null })

  } catch (error: any) {
    console.error("Services DELETE error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}