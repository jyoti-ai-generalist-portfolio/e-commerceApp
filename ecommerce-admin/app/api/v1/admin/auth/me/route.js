import { NextResponse } from "next/server";
import { verifyAdminToken, getTokenFromRequest } from "../../../../../../lib/jwt";
import { supabaseAdmin } from "../../../../../../lib/supabaseClient";

export async function GET(request) {
  const token = getTokenFromRequest(request);
  if (!token) {
    return NextResponse.json(
      { success: false, error: "No session token provided." },
      { status: 401 }
    );
  }

  const payload = verifyAdminToken(token);
  if (!payload) {
    return NextResponse.json(
      { success: false, error: "Session expired or invalid. Please sign in again." },
      { status: 401 }
    );
  }

  // Re-check the admins table so revoked admins lose access even with a
  // still-valid token (per UC-01 "Revoked Admin Rights" edge case).
  const { data: adminRecord, error } = await supabaseAdmin
    .from("admins")
    .select("id, admin_email, admin_name")
    .eq("id", payload.admin_id)
    .maybeSingle();

  if (error || !adminRecord) {
    return NextResponse.json(
      { success: false, error: "Administrator access has been revoked." },
      { status: 403 }
    );
  }

  return NextResponse.json({
    success: true,
    data: {
      admin: {
        id: adminRecord.id,
        email: adminRecord.admin_email,
        name: adminRecord.admin_name,
      },
    },
  });
}
