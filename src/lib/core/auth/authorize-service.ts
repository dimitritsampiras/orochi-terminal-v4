import { headers } from "next/headers";

/**
 * Validates service-to-service requests using OROCHI_SECRET Bearer token.
 * Used for CS bot and other internal services to access API endpoints.
 *
 * @example
 * const isAuthorized = await authorizeServiceRequest();
 * if (!isAuthorized) {
 *   return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
 * }
 */
export async function authorizeServiceRequest(): Promise<boolean> {
    const headersList = await headers();
    const authorization = headersList.get("authorization");

    if (!authorization) {
        return false;
    }

    const [scheme, token] = authorization.split(" ");

    if (scheme !== "Bearer" || !token) {
        return false;
    }

    const orochiSecret = process.env.OROCHI_SECRET;

    if (!orochiSecret) {
        console.error("OROCHI_SECRET is not configured in environment variables");
        return false;
    }

    return token === orochiSecret;
}
