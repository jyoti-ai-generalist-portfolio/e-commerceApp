import { NextResponse } from 'next/server';
import { getBearerToken, getAuthedSupabase, getUserFromToken } from '../../../../../lib/supabaseServer';

// GET /api/v1/orders/:id — single order with line items, for the
// confirmation page. RLS (auth.uid() = customer_id) already scopes this
// to the caller's own orders; .eq('customer_id', ...) is defense in depth.
export async function GET(request, { params }) {
  try {
    const token = getBearerToken(request);
    const user = token ? await getUserFromToken(token) : null;
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const supabase = getAuthedSupabase(token);
    const { data, error } = await supabase
      .from('orders')
      .select(
        `id, total_amount, status, shipping_address, tracking_number, created_at,
         order_items ( id, quantity, price_at_purchase, products ( title ) )`
      )
      .eq('id', params.id)
      .eq('customer_id', user.id)
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    return NextResponse.json({ data });
  } catch (err) {
    console.error('GET /api/v1/orders/[id] failed:', err);
    return NextResponse.json({ error: 'Failed to load order' }, { status: 500 });
  }
}