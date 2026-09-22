import { NextResponse } from 'next/server';
import { getBearerToken, getAuthedSupabase, getUserFromToken } from '../../../../lib/supabaseServer';

export async function GET(request) {
  try {
    const token = getBearerToken(request);
    if (!token) {
      // Guest / unauthenticated — empty cart, not an error.
      return NextResponse.json({ cart_id: null, total_count: 0, items: [] });
    }

    const user = await getUserFromToken(token);
    if (!user) {
      return NextResponse.json({ cart_id: null, total_count: 0, items: [] });
    }

    const supabase = getAuthedSupabase(token);

    const { data: cart, error: cartError } = await supabase
      .from('carts')
      .select('id')
      .eq('profile_id', user.id)
      .maybeSingle();
    if (cartError) throw cartError;

    if (!cart) {
      return NextResponse.json({ cart_id: null, total_count: 0, items: [] });
    }

    const { data: items, error: itemsError } = await supabase
      .from('cart_items')
      .select('id, product_id, quantity, products(title, price, image_urls)')
      .eq('cart_id', cart.id);
    if (itemsError) throw itemsError;

    const formatted = (items || []).map((row) => ({
      cart_item_id: row.id,
      product_id: row.product_id,
      title: row.products?.title ?? null,
      price: row.products?.price ?? null,
      quantity: row.quantity,
      image_url: row.products?.image_urls?.[0] ?? null,
    }));

    const total_count = formatted.reduce((sum, i) => sum + i.quantity, 0);

    return NextResponse.json({ cart_id: cart.id, total_count, items: formatted });
  } catch (err) {
    console.error('GET /api/v1/cart failed:', err);
    return NextResponse.json({ error: 'Failed to hydrate cart session' }, { status: 500 });
  }
}
