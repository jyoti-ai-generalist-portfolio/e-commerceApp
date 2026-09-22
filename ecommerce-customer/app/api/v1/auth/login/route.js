import { NextResponse } from 'next/server';
import { getAnonSupabase, getServiceSupabase } from '../../../../../lib/supabaseServer';

export async function POST(request) {
  try {
    const { email, password } = (await request.json()) || {};

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required.' }, { status: 400 });
    }

    const supabase = getAnonSupabase();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      // Supabase returns a generic "invalid credentials" error for both a
      // wrong password and a non-existent user (by design, to avoid
      // leaking which emails are registered). To offer the spec's
      // "auto-switch to Sign Up" UX, we do a best-effort existence check
      // against `profiles` (populated at registration) using the service
      // role. This does re-introduce a small amount of email enumeration
      // surface — acceptable here since it only gates a UI hint, not
      // access to any data, but worth flagging as a product decision.
      let userExists = true;
      try {
        const serviceSupabase = getServiceSupabase();
        const { data: profile } = await serviceSupabase
          .from('profiles')
          .select('id')
          .eq('email', email)
          .maybeSingle();
        userExists = !!profile;
      } catch (lookupErr) {
        console.error('Login existence check failed:', lookupErr);
      }

      return NextResponse.json(
        {
          error: userExists
            ? 'Invalid email or password.'
            : 'User does not exist. Please sign up.',
          user_exists: userExists,
        },
        { status: userExists ? 401 : 404 }
      );
    }

    return NextResponse.json({
      user: { id: data.user.id, email: data.user.email },
      session: data.session,
    });
  } catch (err) {
    console.error('POST /api/v1/auth/login failed:', err);
    return NextResponse.json({ error: 'Login failed. Please try again.' }, { status: 500 });
  }
}
