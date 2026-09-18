import { NextResponse } from "next/server";
import { cookies } from "next/headers"; // 1. Import Next.js cookies utility
import { verifyAdminToken, getTokenFromRequest } from "../../../../../../lib/jwt";
import { supabaseAdmin } from "../../../../../../lib/supabaseClient";

export async function GET(request) {
  // Try retrieving token from headers first
  let token = getTokenFromRequest(request);
  
  // 2. FALLBACK: If header is empty, read it straight out of your HTTP cookies
  if (!token) {
    const cookieStore = await cookies();
    // Replace 'admin_token' with your exact session cookie name if it differs!
    token = cookieStore.get("admin_token")?.value || cookieStore.get("token")?.value;
  }

  if (!token) {
    return NextResponse.json(
      { success: false, error: "No session token provided." },
      { status: 401 }
    );
  }
  
  console.log("In Me - before verifyAdminToken");
  const payload = verifyAdminToken(token);
  if (!payload) {
    return NextResponse.json(
      { success: false, error: "Session expired or invalid. Please sign in again." },
      { status: 401 }
    );
  }
  
  console.log("In Me - after verifying token checking in the table ");
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
      access_token: token,
    },
  });
}
