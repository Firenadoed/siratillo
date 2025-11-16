// lib/owner-auth.ts
import { supabaseServer } from './supabaseServer'
import { supabaseAdmin } from './supabaseAdmin'

export type AuthResult = {
  authorized: boolean;
  error?: string;
  status?: number;
  userId?: string;
  shopId?: string;
  branchId?: string;
}

export async function verifyOwnerAccess(): Promise<AuthResult> {
  try {
    const supabase = await supabaseServer()
    
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError || !user) {
      return { authorized: false, error: "Not authenticated", status: 401 }
    }

    // Check if user has owner role in any shop
    const { data: shopAssignment, error: shopError } = await supabaseAdmin
      .from("shop_user_assignments")
      .select(`
        shop_id,
        branch_id,
        role_in_shop
      `)
      .eq("user_id", user.id)
      .eq("role_in_shop", "owner")
      .eq("is_active", true)

    if (shopError) {
      console.error("Owner auth - Shop assignment check error:", shopError)
      return { authorized: false, error: "Failed to check shop permissions", status: 500 }
    }

    if (!shopAssignment || shopAssignment.length === 0) {
      return { authorized: false, error: "Owner access required - no shop assigned", status: 403 }
    }

    // Get the first shop assignment (owners typically have one shop)
    const assignment = shopAssignment[0]

    return { 
      authorized: true, 
      userId: user.id,
      shopId: assignment.shop_id,
      branchId: assignment.branch_id || undefined
    }

  } catch (error: any) {
    console.error("Owner auth - Unexpected error:", error)
    return { authorized: false, error: "Authentication failed", status: 500 }
  }
}

// Convenience function that throws error for use in endpoints
export async function requireOwner(): Promise<{ userId: string; shopId: string; branchId?: string }> {
  const result = await verifyOwnerAccess()
  if (!result.authorized) {
    throw new Error(result.error || "Owner access required")
  }
  return { 
    userId: result.userId!, 
    shopId: result.shopId!,
    branchId: result.branchId
  }
}

// Check if user is owner of specific shop
export async function isOwnerOfShop(userId: string, shopId: string): Promise<boolean> {
  try {
    const { data } = await supabaseAdmin
      .from("shop_user_assignments")
      .select("id")
      .eq("user_id", userId)
      .eq("shop_id", shopId)
      .eq("role_in_shop", "owner")
      .eq("is_active", true)
      .single()

    return !!data

  } catch (error) {
    console.error("isOwnerOfShop error:", error)
    return false
  }
}

// Check if user is owner of specific branch
export async function isOwnerOfBranch(userId: string, branchId: string): Promise<boolean> {
  try {
    const { data } = await supabaseAdmin
      .from("shop_user_assignments")
      .select("id")
      .eq("user_id", userId)
      .eq("branch_id", branchId)
      .eq("role_in_shop", "owner")
      .eq("is_active", true)
      .single()

    return !!data

  } catch (error) {
    console.error("isOwnerOfBranch error:", error)
    return false
  }
}

// Get all shops where user is owner
export async function getOwnedShops(userId: string): Promise<Array<{shop_id: string, branch_id?: string}>> {
  try {
    const { data } = await supabaseAdmin
      .from("shop_user_assignments")
      .select("shop_id, branch_id")
      .eq("user_id", userId)
      .eq("role_in_shop", "owner")
      .eq("is_active", true)

    return data || []

  } catch (error) {
    console.error("getOwnedShops error:", error)
    return []
  }
}

// Get owner's primary shop info
export async function getOwnerShopInfo(userId: string): Promise<{shopId: string, branchId?: string} | null> {
  try {
    const { data } = await supabaseAdmin
      .from("shop_user_assignments")
      .select("shop_id, branch_id")
      .eq("user_id", userId)
      .eq("role_in_shop", "owner")
      .eq("is_active", true)
      .order("created_at", { ascending: true })
      .limit(1)
      .single()

    if (!data) return null

    return {
      shopId: data.shop_id,
      branchId: data.branch_id || undefined
    }

  } catch (error) {
    console.error("getOwnerShopInfo error:", error)
    return null
  }
}