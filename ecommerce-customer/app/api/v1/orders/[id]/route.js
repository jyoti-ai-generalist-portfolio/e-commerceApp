// /app/api/v1/orders/[id]/route.js
import { NextResponse } from 'next/server';
// 1. Corrected relative path levels for imports since we dropped the "/customer" directory
import { getCustomerContext, jsonError, normalizeOrder, ORDER_SELECT, UUID_RE } from '../../../../../lib/customerOrdersServer';

export const dynamic = 'force-dynamic';

// GET /api/v1/orders/:id
export async function GET(request, { params }) {
  // 2. Authenticate using your existing wrapper architecture
  const ctx = await getCustomerContext(request);
  if (!ctx) return jsonError('Please sign in to view your orders.', 401, 'UNAUTHENTICATED');
  
  // 3. Robust UUID verification from your helper configuration
  if (!UUID_RE.test(params.id)) return jsonError('Order not found.', 404, 'NOT_FOUND');

  // 4. Query using your clean RLS active context instance
  const { data, error } = await ctx.supabase
    .from('orders')
    .select(`${ORDER_SELECT}`)
    .eq('id', params.id)
    .eq('customer_id', ctx.user.id)
    .maybeSingle();

  // 5. Contextual API Error management
  if (error) return jsonError('Could not load this order.', 500, 'QUERY_FAILED');
  if (!data) return jsonError('Order not found.', 404, 'NOT_FOUND');

  // 6. Matched payload structure directly to frontend expectations ('data' object)
  return NextResponse.json({ 
    data: normalizeOrder(data) 
  });
}



// GET /api/v1/orders/:id — single order with line items, for the
// confirmation page. RLS (auth.uid() = customer_id) already scopes this
// to the caller's own orders; .eq('customer_id', ...) is defense in depth.
/*export async function GET(request, { params }) {
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
}*/