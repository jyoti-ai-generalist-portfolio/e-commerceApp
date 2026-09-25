import { NextResponse } from 'next/server';
import { getBearerToken, getAuthedSupabase, getUserFromToken } from '../../../../lib/supabaseServer';

const DEFAULT_LIMIT = 10;

// GET /api/v1/orders?page=1&limit=10&status=paid
// Lists the current user's own orders, newest first. RLS
// (auth.uid() = customer_id) scopes this to the caller's rows; the
// .eq('customer_id', ...) below is defense in depth.
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
}