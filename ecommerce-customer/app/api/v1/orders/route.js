// /app/api/v1/orders/route.js
import { NextResponse } from 'next/server';
// Updated relative import path to match the new folder depth
import { getCustomerContext, jsonError, normalizeOrder, ORDER_SELECT } from '../../../../lib/customerOrdersServer';

export const dynamic = 'force-dynamic';

// GET /api/v1/orders?page=1&limit=10&status=paid
export async function GET(request) {
  // 1. Authenticate using your existing wrapper architecture
  const ctx = await getCustomerContext(request);
  if (!ctx) return jsonError('Please sign in to view your orders.', 401, 'UNAUTHENTICATED');

  // 2. Parse request query parameters
  const sp = new URL(request.url).searchParams;
  const page = Math.max(1, parseInt(sp.get('page'), 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(sp.get('limit'), 10) || 10));
  const statusFilter = sp.get('status'); // Tracks UI filter clicks
  
  const from = (page - 1) * limit;

  // 3. Construct the query utilizing your existing database wrappers
  let query = ctx.supabase
    .from('orders')
    .select(ORDER_SELECT, { count: 'exact' })
    .eq('customer_id', ctx.user.id)
    .order('created_at', { ascending: false });

  // 4. Dynamically apply status filters sent by the frontend component
  if (statusFilter && statusFilter != 'null' && statusFilter.trim() != '') {
    query = query.eq('status', statusFilter);
  }

  // 5. Execute paginated database range call
  const { data, error, count } = await query.range(from, from + limit - 1);

  if (error) {
    console.error('customer orders list failed:', error.message);
    return jsonError('Could not load your orders.', 500, 'QUERY_FAILED');
  }

  const total_items = count || 0;
  const total_pages = Math.max(1, Math.ceil(total_items / limit));

  // 6. Return response formatting mapped exactly to your frontend page's state keys
  return NextResponse.json({
    data: (data || []).map(normalizeOrder), // Maps to data.data on client [3]
    page,
    total_pages,                             // Maps to data.total_pages on client [3]
    total_items,                             // Maps to data.total_items on client [3]
  });
}

/* older function replaced 
export async function GET(request) {
  try {
    const token = getBearerToken(request);
    const user = token ? await getUserFromToken(token) : null;
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page'), 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit'), 10) || DEFAULT_LIMIT));
    const statusFilter = searchParams.get('status');

    const supabase = getAuthedSupabase(token);

    let query = supabase
      .from('orders')
      .select(
        `id, total_amount, status, created_at, tracking_number,
         order_items ( id, quantity, price_at_purchase, products ( title, image_urls ) )`,
        { count: 'exact' }
      )
      .eq('customer_id', user.id)
      .order('created_at', { ascending: false });

    if (statusFilter) {
      query = query.eq('status', statusFilter);
    }

    const from = (page - 1) * limit;
    const to = from + limit - 1;
    query = query.range(from, to);

    const { data, error, count } = await query;
    if (error) throw error;

    const total_items = count || 0;
    const total_pages = Math.max(1, Math.ceil(total_items / limit));

    return NextResponse.json({
      data: data || [],
      page,
      total_pages,
      total_items,
    });
  } catch (err) {
    console.error('GET /api/v1/orders failed:', err);
    return NextResponse.json({ error: 'Failed to load orders' }, { status: 500 });
  }
} */