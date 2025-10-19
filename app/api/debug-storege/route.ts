// app/api/debug-storage/route.ts
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { NextResponse } from 'next/server'

export async function GET() {
  const { data: buckets, error } = await supabaseAdmin.storage.listBuckets()
  return NextResponse.json({ buckets, error })
}