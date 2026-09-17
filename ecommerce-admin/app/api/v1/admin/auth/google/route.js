import { NextResponse } from "next/server";


//import { verifyGoogleIdToken } from "../../../../lib/googleAuth";
// Relative path fix (4 levels up from app/api/v1/admin/auth/google)

import { verifyGoogleIdToken } from "../../../../../../lib/googleAuth";
//import { verifyGoogleIdToken } from "../../../../../../../lib/googleAuth";
import { supabaseAdmin } from "../../../../../../lib/supabaseClient";
import { signAdminToken } from "../../../../../../lib/jwt";

// Changed above route to go up 7 directories for lib not 6 directories
export async function POST(request) {
  let body;
  try {
    body = await request.json();
    console.log ("body found is ", body);
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON body." },
      { status: 400 }
    );
  }

  const { id_token } = body;

  if (!id_token) {
    return NextResponse.json(
      { success: false, error: "id_token is required." },
      { status: 400 }
    );
  }
  console.log ("Google ID Token found is ",id_token );
  // 1. Verify the Google id_token (signature + audience + expiry).
  let identity;
  try {
    identity = await verifyGoogleIdToken(id_token);
  } catch (err) {
    return NextResponse.json(
      { success: false, error: "Invalid Google authentication token." },
      { status: 401 }
    );
  }
  //console.error("Verification failed for token:", id_token, "Error details:", err);
  // 2. Look up the admins table, case-insensitively.
  const { data: adminRecord, error: dbError } = await supabaseAdmin
    .from("admins")
    .select("id, admin_email, admin_name")
    .ilike("admin_email", identity.email)
    .maybeSingle();

  if (dbError) {
    return NextResponse.json(
      { success: false, error: "Unable to verify administrator status." },
      { status: 500 }
    );
  }

  // 3. Authorization check: reject anyone not present in admins.
  if (!adminRecord) {
    return NextResponse.json(
      {
        success: false,
        error:
          "Access Denied: Your Google account does not have administrator privileges.",
      },
      { status: 403 }
    );
  }
  console.log ("Before signAdminToken ");

  // 4. Issue the admin JWT.
  const token = signAdminToken({
    adminId: adminRecord.id,
    email: adminRecord.admin_email,
    name: adminRecord.admin_name,
  });
  console.log ("After signAdminToken returning token ", token);

  const response = NextResponse.json({
    success: true,
    data: {
      token,
      admin: {
        id: adminRecord.id,
        email: adminRecord.admin_email,
        name: adminRecord.admin_name,
      },
      redirectTo: "/admin/dashboard",
    },
  });

  // 5. Also set an httpOnly cookie so the middleware route guard and
  // browser navigation work without the client managing the token.
  response.cookies.set("admin_token", token, {
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    maxAge: 8 * 60 * 60, // 8 hours, matches JWT expiry
    path: "/",
  });

  return response;
}
