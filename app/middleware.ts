import { createServerClient } from '@supabase/ssr';
import { type NextRequest, NextResponse } from 'next/server';
import type { Database } from '@/lib/types/supabase';

type Tables = Database['public']['Tables'];

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => 
            response.cookies.set(name, value, options)
          );
        },
        
      },
    }
  );

  // 1️⃣ Get current session
  const { data: { session } } = await supabase.auth.getSession();

  // 2️⃣ Define protected routes and required global roles
  const protectedRoutes = {
    '/admin': 'superadmin',
    '/owner': 'owner',
    '/employee': 'employee',
  };
  
  const pathname = request.nextUrl.pathname;

  // Check if the path is under a protected route
  const matchedRoute = Object.entries(protectedRoutes).find(([route]) =>
    pathname.startsWith(route)
  );

  if (matchedRoute) {
    const [route, requiredRole] = matchedRoute;

    if (!session) {
      return NextResponse.redirect(new URL('/login', request.url));
    }

    // 3️⃣ Fetch user roles using proper typing
    const { data: userRoles, error } = await supabase
      .from('user_roles')
      .select(`
        roles (
          name
        )
      `)
      .eq('user_id', session.user.id);

    if (error) {
      console.error('Error fetching user roles:', error);
      return NextResponse.redirect(new URL('/login', request.url));
    }

    // 4️⃣ Extract role names with proper type handling
    type UserRoleWithRoles = {
      roles: Tables['roles']['Row'][];
    };

    const rolesData = userRoles as UserRoleWithRoles[] | null;
    const roleNames = rolesData?.flatMap(roleData => 
      roleData.roles.map(role => role.name).filter((name): name is string => name !== null)
    ) || [];

    // 5️⃣ Check if user has the required role
    if (!roleNames.includes(requiredRole)) {
      // Redirect to the first valid role dashboard if available, else unauthorized
      const firstValidRole = roleNames.find(roleName => 
        Object.values(protectedRoutes).includes(roleName)
      );
      
      if (firstValidRole) {
        // Find the route for this role
        const roleRoute = Object.entries(protectedRoutes).find(
          ([_, role]) => role === firstValidRole
        )?.[0];
        
        if (roleRoute) {
          return NextResponse.redirect(new URL(roleRoute, request.url));
        }
      }
      
      // No valid role found, redirect to unauthorized
      return NextResponse.redirect(new URL('/unauthorized', request.url));
    }
  }

  return response;
}

export const config = {
  matcher: [
    '/admin/:path*',
    '/owner/:path*',
    '/employee/:path*',
  ],
};