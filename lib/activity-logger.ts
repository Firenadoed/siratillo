import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

/**
 * Log an activity (MAIN FUNCTION)
 * Store everything as text - no foreign keys!
 */
export async function logActivity(params: {
  actorName: string
  actorType?: 'customer' | 'employee' | 'driver' | 'system' | 'owner'
  action: string
  entityType: string
  entityId?: string
  entityName?: string
  description: string
  severity?: 'info' | 'warning' | 'error' | 'critical'
  branchId?: string
  shopId: string  // REQUIRED - links to shop
}) {
  try {
    console.log('📝 Logging activity:', params.action, params.description)
    
    const { data, error } = await supabase
      .from('activity_logs')
      .insert({
        actor_name: params.actorName,
        actor_type: params.actorType || 'customer',
        action: params.action,
        entity_type: params.entityType,
        entity_id: params.entityId,
        entity_name: params.entityName,
        description: params.description,
        severity: params.severity || 'info',
        branch_id: params.branchId,
        shop_id: params.shopId  // This is the KEY field
      })
      .select()
      .single()
    
    if (error) {
      console.error('❌ Failed to log activity:', error.message)
      return null
    }
    
    console.log('✅ Activity logged:', data.id)
    return data
  } catch (error) {
    console.error('🔥 Activity logging error:', error)
    return null
  }
}

/**
 * Get shop ID from branch ID
 */
export async function getShopIdFromBranch(branchId: string): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('shop_branches')
      .select('shop_id')
      .eq('id', branchId)
      .single()
    
    if (error) throw error
    return data?.shop_id || null
  } catch (error) {
    console.error('Error getting shop from branch:', error)
    return null
  }
}

/**
 * Common activity types for easy use
 */
export const ActivityTypes = {
  // Order activities
  orderCreated: (order: any, branchId: string, shopId: string) => ({
    actorName: order.customer_name || 'Customer',
    actorType: 'customer' as const,
    action: 'order_created',
    entityType: 'order',
    entityId: order.id,
    entityName: `Order #${order.id.substring(0, 8).toUpperCase()}`,
    description: `New ${order.service_type || 'laundry'} order for ₱${order.amount || 0}`,
    branchId,
    shopId
  }),
  
  // Payment activities
  paymentReceived: (payment: any, order: any, shopId: string) => ({
    actorName: 'System',
    actorType: 'system' as const,
    action: 'payment_received',
    entityType: 'payment',
    entityId: payment.id,
    entityName: `Payment #${payment.id.substring(0, 8).toUpperCase()}`,
    description: `Payment of ₱${payment.amount} received for order`,
    shopId
  }),
  
  // Employee actions
  employeeAction: (employeeName: string, action: string, details: string, branchId: string, shopId: string) => ({
    actorName: employeeName,
    actorType: 'employee' as const,
    action: `employee_${action}`,
    entityType: 'general',
    entityName: 'Employee Action',
    description: `${employeeName} ${details}`,
    branchId,
    shopId
  }),
  
  // Delivery actions
  deliveryAssigned: (driverName: string, orderId: string, branchId: string, shopId: string) => ({
    actorName: driverName,
    actorType: 'driver' as const,
    action: 'delivery_assigned',
    entityType: 'delivery',
    entityId: orderId,
    entityName: `Delivery for Order #${orderId.substring(0, 8).toUpperCase()}`,
    description: `Delivery assigned to ${driverName}`,
    branchId,
    shopId
  })
}