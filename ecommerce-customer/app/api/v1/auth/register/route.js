import { NextResponse } from 'next/server';
import { getAnonSupabase, getServiceSupabase } from '../../../../../lib/supabaseServer';
import { sendWelcomeEmail } from '../../../../../lib/mailer';

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value || '');
}

export async function POST(request) {
  try {
    const body = (await request.json()) || {};
    const {
      email,
      password,
      full_name,
      mobilenumber,
      address_line1,
      address_line2,
      city,
      pincode,
    } = body;

    if (!isValidEmail(email)) {
      return NextResponse.json({ error: 'A valid email address is required.' }, { status: 400 });
    }
    if (!password || password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters.' },
        { status: 400 }
      );
    }
    if (!full_name || !mobilenumber || !address_line1 || !city || !pincode) {
      return NextResponse.json(
        { error: 'Full name, mobile number, address line 1, city and pincode are required.' },
        { status: 400 }
      );
    }

    const anonSupabase = getAnonSupabase();
    const { data: signUpData, error: signUpError } = await anonSupabase.auth.signUp({
      email,
      password,
    });

    if (signUpError) {
      const alreadyExists = /already registered|already exists|already been registered/i.test(
        signUpError.message || ''
      );
      return NextResponse.json(
        {
          error: alreadyExists
            ? 'Registration failed. Email may already exist. Click here to Login with your credentials'
            : 'Registration failed. Please try again.',
        },
        { status: alreadyExists ? 400 : 500 }
      );
    }

    const newUser = signUpData.user;
    if (!newUser) {
      return NextResponse.json(
        { error: 'Registration failed. Please try again.' },
        { status: 500 }
      );
    }

    const serviceSupabase = getServiceSupabase();

    const { error: profileError } = await serviceSupabase
      .from('profiles')
      .insert({ id: newUser.id, email, full_name });
    if (profileError) {
      console.error('Profile insert failed:', profileError);
      return NextResponse.json(
        { error: 'Registration failed. Please try again.' },
        { status: 500 }
      );
    }

    const { error: addressError } = await serviceSupabase.from('customer_addresses').insert({
      profile_id: newUser.id,
      address_line1,
      address_line2: address_line2 || null,
      city,
      pincode,
      mobilenumber,
    });
    if (addressError) {
      console.error('Address insert failed:', addressError);
    }

    try {
      console.log('In register function - before sending welcome email');
      await sendWelcomeEmail({ to: email, name: full_name });
    } catch (emailError) {
      // Per spec: email delivery failure must not block registration.
      console.error('Welcome email failed to send:', emailError);
    }
    console.log('In register function - after sending welcome email');

    return NextResponse.json(
      {
        message: 'Registration successful. Welcome email sent.',
        profile_id: newUser.id,
        session: signUpData.session,
      },
      { status: 201 }
    );
  } catch (err) {
    console.error('POST /api/v1/auth/register failed:', err);
    return NextResponse.json(
      { error: 'Registration failed. Please try again.' },
      { status: 500 }
    );
  }
}
