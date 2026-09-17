import { OAuth2Client } from "google-auth-library";

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
const client = new OAuth2Client(GOOGLE_CLIENT_ID);

/**
 * Verifies a Google id_token against Google's public keys and the app's
 * client ID (audience check), then returns the identity claims we need.
 * Throws if the token is missing, expired, or was issued for a different
 * client.
 */
export async function verifyGoogleIdToken(idToken) {
  if (!idToken) {
    throw new Error("Missing id_token");
  }
  console.log ("Inside function verifyGoogleIdToken");
  console.log ("audience is ", GOOGLE_CLIENT_ID);
  const ticket = await client.verifyIdToken({
    idToken,
    audience: GOOGLE_CLIENT_ID,
  });
  console.log ("got payload ", ticket.getPayload());
  const payload = ticket.getPayload();
  if (!payload || !payload.email) {
    throw new Error("Google token did not include an email claim");
  }

  return {
    email: payload.email,
    name: payload.name || payload.email,
    googleSub: payload.sub,
    emailVerified: payload.email_verified,
  };
}
