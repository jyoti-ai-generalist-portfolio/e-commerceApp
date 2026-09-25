import { NextResponse } from 'next/server';
import { getBearerToken, getAuthedSupabase, getUserFromToken } from '../../../../../lib/supabaseServer';

const MOBILE_RE = /^(?:\+91[- ]?)?[6-9]\d{9}$/;
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

// DELETE /api/v1/addresses/:id
export async function DELETE(request, { params }) {
  try {
    const token = getBearerToken(request);
    const user = token ? await getUserFromToken(token) : null;
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const supabase = getAuthedSupabase(token);
    // RLS (auth.uid() = profile_id) already scopes this to the caller's
    // own rows; the .eq('profile_id', ...) is defense in depth.
    const { error } = await supabase
      .from('customer_addresses')
      .delete()
      .eq('id', params.id)
      .eq('profile_id', user.id);

    if (error) throw error;

    return NextResponse.json({ message: 'Address deleted' });
  } catch (err) {
    console.error('DELETE /api/v1/addresses/[id] failed:', err);
    return NextResponse.json({ error: 'Failed to delete address' }, { status: 500 });
  }
}

// PATCH /api/v1/addresses/:id
export async function PATCH(request, { params }) {
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
      .update(clean)
      .eq('id', params.id)
      .eq('profile_id', user.id)
      .select('id, address_line1, address_line2, city, pincode, mobilenumber, created_at')
      .single();

    if (error) throw error;

    return NextResponse.json({ message: 'Address updated', data });
  } catch (err) {
    console.error('PATCH /api/v1/addresses/[id] failed:', err);
    return NextResponse.json({ error: 'Failed to update address' }, { status: 500 });
  }
}