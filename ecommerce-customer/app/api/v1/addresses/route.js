import { NextResponse } from 'next/server';
import { getBearerToken, getAuthedSupabase, getUserFromToken } from '../../../../lib/supabaseServer';

// Basic Indian mobile number check: optional +91, then 10 digits starting 6-9.
const MOBILE_RE = /^(?:\+91[- ]?)?[6-9]\d{9}$/;
// Indian PIN code: exactly 6 digits.
const PINCODE_RE = /^\d{6}$/;

function validateAddressPayload(body) {
  const errors = {};
  const address_line1 = (body?.address_line1 || '').trim();
  const address_line2 = (body?.address_line2 || '').trim();
  const city = (body?.city || '').trim();
  const pincode = (body?.pincode || '').trim();
  const mobilenumber = (body?.mobilenumber || '').trim();

  if (!address_line1) errors.address_line1 = 'Address line 1 is required';
  if (!city) errors.city = 'City is required';
  if (!pincode) {
    errors.pincode = 'Pincode is required';
  } else if (!PINCODE_RE.test(pincode)) {
    errors.pincode = 'Pincode must be exactly 6 digits';
  }
  if (!mobilenumber) {
    errors.mobilenumber = 'Mobile number is required';
  } else if (!MOBILE_RE.test(mobilenumber)) {
    errors.mobilenumber = 'Enter a valid 10-digit Indian mobile number';
  }

  return {
    errors,
    isValid: Object.keys(errors).length === 0,
    clean: { address_line1, address_line2, city, pincode, mobilenumber },
  };
}

// GET /api/v1/addresses — list the current user's saved addresses
export async function GET(request) {
  try {
    const token = getBearerToken(request);
    const user = token ? await getUserFromToken(token) : null;
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const supabase = getAuthedSupabase(token);
    const { data, error } = await supabase
      .from('customer_addresses')
      .select('id, address_line1, address_line2, city, pincode, mobilenumber, created_at')
      .eq('profile_id', user.id)
      .order('created_at', { ascending: true });

    if (error) throw error;

    // Synthetic labels — schema has no label column, so we derive one
    // ("Address 1", "Address 2", ...) by creation order. The first
    // address is also treated as the default in the UI.
    const items = (data || []).map((addr, idx) => ({
      ...addr,
      label: `Address ${idx + 1}`,
      is_default: idx === 0,
    }));

    return NextResponse.json({ data: items });
  } catch (err) {
    console.error('GET /api/v1/addresses failed:', err);
    return NextResponse.json({ error: 'Failed to load addresses' }, { status: 500 });
  }
}

// POST /api/v1/addresses — create a new address for the current user
export async function POST(request) {
  try {
    const token = getBearerToken(request);
    const user = token ? await getUserFromToken(token) : null;
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await request.json();
    const { errors, isValid, clean } = validateAddressPayload(body);
    if (!isValid) {
      return NextResponse.json({ error: 'Validation failed', fields: errors }, { status: 400 });
    }

    const supabase = getAuthedSupabase(token);
    const { data, error } = await supabase
      .from('customer_addresses')
      .insert({ profile_id: user.id, ...clean })
      .select('id, address_line1, address_line2, city, pincode, mobilenumber, created_at')
      .single();

    if (error) throw error;

    return NextResponse.json({ message: 'Address saved', data }, { status: 201 });
  } catch (err) {
    console.error('POST /api/v1/addresses failed:', err);
    return NextResponse.json({ error: 'Failed to save address' }, { status: 500 });
  }
}