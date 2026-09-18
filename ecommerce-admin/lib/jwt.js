import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET;
const ADMIN_TOKEN_TTL = "8h"; // matches UC-01 "sensible expiration times (e.g., 8 hours)"

if (!JWT_SECRET) {
  console.warn("JWT_SECRET is not set. Admin tokens cannot be signed or verified.");
}


export function signAdminToken({ adminId, email, name }) {
  console.log("Got JWT secret here inside signAdminToken function ", JWT_SECRET);
  return jwt.sign(
    { admin_id: adminId, email, name, role: "admin" },
    JWT_SECRET,
    { expiresIn: ADMIN_TOKEN_TTL }
  );
}

export function verifyAdminToken(token) {
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (payload.role !== "admin") return null;
    return payload;
  } catch (err) {
    return null;
  }
}

export function getTokenFromRequest(request) {
  // Prefer the httpOnly cookie; fall back to Authorization header for
  // clients that store the token locally instead.
  const cookieToken = request.cookies.get("admin_token")?.value;
  if (cookieToken) return cookieToken;

  const authHeader = request.headers.get("authorization") || "";
  const [scheme, headerToken] = authHeader.split(" ");
  if (scheme === "Bearer" && headerToken) return headerToken;

  return null;
}
