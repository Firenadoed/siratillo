import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function GET(request: Request) {
  // ✅ Define this outside try so it's always in scope
  const requestUrl = new URL(request.url)

  try {
    const code = requestUrl.searchParams.get('code')

    if (code) {
      const { createServerClient } = await import('@supabase/ssr')
      const cookieStore = await cookies() // ✅ no need for 'await'

      const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          cookies: {
            getAll() {
              return cookieStore.getAll()
            },
            setAll(cookiesToSet) {
              try {
                cookiesToSet.forEach(({ name, value, options }) => {
                  cookieStore.set(name, value, options)
                })
              } catch {
                // The `setAll` method was called from a Server Component
              }
            },
          },
        }
      )

      console.log('🔐 Exchanging code for session...')
      const { error } = await supabase.auth.exchangeCodeForSession(code)

      if (error) {
        console.error('❌ Session exchange error:', error)
        return NextResponse.redirect(`${requestUrl.origin}/forgot-password?error=invalid_link`)
      }

      console.log('✅ Session created, redirecting to reset password')
      return NextResponse.redirect(`${requestUrl.origin}/reset-password`)
    }

    return NextResponse.redirect(`${requestUrl.origin}/login`)
  } catch (error) {
    console.error('💥 Callback error:', error)
    // ✅ Safe fallback if something goes wrong
    return NextResponse.redirect(`${requestUrl.origin}/forgot-password?error=server_error`)
  }
}
