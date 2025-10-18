// app/api/auth/logout/route.ts
import { supabaseServer } from '@/lib/supabaseServer'
import { NextResponse } from 'next/server'

export async function POST() {
  try {
    const supabase = await supabaseServer()
    
    const { error } = await supabase.auth.signOut()
    
    if (error) {
      throw error
    }
    
    return NextResponse.json({ 
      success: true,
      message: 'Logged out successfully'
    })
    
  } catch (error: any) {
    console.error('Logout error:', error)
    return NextResponse.json({ 
      error: 'Logout failed' 
    }, { status: 500 })
  }
}