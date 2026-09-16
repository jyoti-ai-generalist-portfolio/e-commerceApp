import { NextResponse } from "next/server";

// Route guard: any /admin/* page other than the login page itself requires
// an admin_token cookie. Full JWT signature verification happens again on
// every API call (jsonwebtoken isn't Edge-runtime safe here, so this layer
// only checks presence -- it's a UX redirect, not the security boundary).
export function middleware(request) {
  const { pathname } = request.nextUrl;

  if (pathname === "/admin/login") {
    return NextResponse.next();
  }

  if (pathname.startsWith("/admin")) {
    const token = request.cookies.get("admin_token")?.value;
    if (!token) {
      const loginUrl = new URL("/admin/login", request.url);
      loginUrl.searchParams.set("redirectTo", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
