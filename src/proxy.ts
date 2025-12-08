import type { NextRequest } from "next/server";
import { updateSession } from "./lib/core/auth/update-session";


export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * From docs
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, sitemap.xml, robots.txt (metadata files)
     */
    // '/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)',
    "/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|.*\\.png|.*\\.jpg|.*\\.jpeg|.*\\.gif|.*\\.webp|.*\\.avif).*)",
  ],
};
