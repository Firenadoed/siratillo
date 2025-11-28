import { createServerClient } from '@supabase/ssr';
import { type NextRequest, NextResponse } from 'next/server';
import type { Database } from '@/lib/types/supabase';

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

  // 1️⃣ Get current user (more secure than getSession)
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError) {
    console.error('User auth error:', userError);
    // Continue without user for public routes
  }

  const pathname = request.nextUrl.pathname;

  // 2️⃣ Redirect logged-in users away from login page
 if ((pathname === '/login' || pathname === '/forgot-password') && user) {
  console.log('🔄 User is logged in, redirecting from auth page:', pathname);
    
    // Fetch user roles to determine where to redirect
    const { data: userRoles, error } = await supabase
      .from('user_roles')
      .select(`
        roles (
          name
        )
      `)
      .eq('user_id', user.id);

    if (error) {
      console.error('Error fetching user roles:', error);
      // Default redirect if we can't get roles
      return NextResponse.redirect(new URL('/admin', request.url));
    }

    // Extract role names
    const roleNames = userRoles?.map(userRole => {
      // Type-safe access
      if (userRole.roles && typeof userRole.roles === 'object' && 'name' in userRole.roles) {
        return userRole.roles.name;
      }
      return null;
    }).filter((name): name is string => 
      name !== null && name !== undefined
    ) || [];

    console.log("🎭 User roles for redirect:", roleNames);

    // Determine redirect destination based on roles
    const roleRoutes: { [key: string]: string } = {
      'superadmin': '/admin',
      'owner': '/owner',
      'employee': '/employee',
      'delivery': '/delivery',
      'customer': '/customer'
    };

    // Find the first matching role route
    const firstValidRole = roleNames.find(roleName => 
      Object.keys(roleRoutes).includes(roleName)
    );

    const redirectPath = firstValidRole ? roleRoutes[firstValidRole] : '/';
    console.log(`🔄 Redirecting logged-in user to: ${redirectPath}`);
    
    return NextResponse.redirect(new URL(redirectPath, request.url));
  }

  // 3️⃣ Define protected routes and required global roles
  const protectedRoutes = {
    '/admin': 'superadmin',
    '/owner': 'owner',
    '/employee': 'employee',
  };
  
  // Check if the path is under a protected route
  const matchedRoute = Object.entries(protectedRoutes).find(([route]) =>
    pathname.startsWith(route)
  );

  if (matchedRoute) {
    const [route, requiredRole] = matchedRoute;

    if (!user) {
      console.log('🚫 No user found, redirecting to login');
      return NextResponse.redirect(new URL('/login', request.url));
    }

    // 4️⃣ Fetch user roles with proper typing
    const { data: userRoles, error } = await supabase
      .from('user_roles')
      .select(`
        roles (
          name
        )
      `)
      .eq('user_id', user.id);

    if (error) {
      console.error('Error fetching user roles:', error);
      return NextResponse.redirect(new URL('/login', request.url));
    }

    console.log("🔍 Raw userRoles data:", userRoles);

    // 5️⃣ Extract role names - CORRECT approach for many-to-many relationship
    // The response structure is: [{ roles: { name: string } }]
    const roleNames = userRoles?.map(userRole => {
      // Type-safe access
      if (userRole.roles && typeof userRole.roles === 'object' && 'name' in userRole.roles) {
        return userRole.roles.name;
      }
      return null;
    }).filter((name): name is string => 
      name !== null && name !== undefined
    ) || [];

    console.log("🎭 Extracted role names:", roleNames);

    // 6️⃣ Check if user has the required role
    if (!roleNames.includes(requiredRole)) {
      console.log(`❌ Access denied. User roles: ${roleNames}, Required: ${requiredRole}`);
      
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
          console.log(`🔄 Redirecting to user's role route: ${roleRoute}`);
          return NextResponse.redirect(new URL(roleRoute, request.url));
        }
      }
      
      // No valid role found, redirect to unauthorized
      console.log("🚫 No valid role found, redirecting to unauthorized");
      return NextResponse.redirect(new URL('/unauthorized', request.url));
    }

    console.log("✅ Access granted");
  }

  return response;
}

export const config = {
  matcher: [
    '/login',
    '/forgot-password',
    '/admin/:path*',
    '/owner/:path*',
    '/employee/:path*',
  ],
};