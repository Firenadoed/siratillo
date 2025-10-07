import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Redirect root path to /login
  if (pathname === "/") {
    return NextResponse.redirect(new URL("/login", req.url))
  }

  // You can add auth logic here later if needed
  return NextResponse.next()
}

export const config = {
  // Only match actual pages, not static assets
  matcher: ["/((?!_next|api|icons|manifest\\.json|favicon\\.ico|login|register|.*\\..*).*)"],
}
