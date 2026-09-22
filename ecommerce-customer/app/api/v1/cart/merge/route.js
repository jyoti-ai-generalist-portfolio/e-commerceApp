import { NextResponse } from 'next/server';
import { getBearerToken, getAuthedSupabase, getUserFromToken } from '../../../../../lib/supabaseServer';

export async function POST(request) {
  try {
    const body = await request.json();
    const guestCart = Array.isArray(body?.guest_cart) ? body.guest_cart : [];

    const token = getBearerToken(request);
    const user = token ? await getUserFromToken(token) : null;
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const supabase = getAuthedSupabase(token);

    let { data: cart, error: cartError } = await supabase
      .from('carts')
      .select('id')
      .eq('profile_id', user.id)
      .maybeSingle();
    if (cartError) throw cartError;

    if (!cart) {
      const { data: newCart, error: createError } = await supabase
        .from('carts')
        .insert({ profile_id: user.id })
        .select('id')
        .single();
      if (createError) throw createError;
      cart = newCart;
    }

    for (const item of guestCart) {
      const productId = item?.product_id;
      const guestQuantity = Number.isFinite(item?.quantity)
        ? item.quantity
        : parseInt(item?.quantity, 10) || 0;
      if (!productId || guestQuantity <= 0) continue;

      const { data: existingItem, error: existingError } = await supabase
        .from('cart_items')
        .select('id, quantity')
        .eq('cart_id', cart.id)
        .eq('product_id', productId)
        .maybeSingle();
      if (existingError) throw existingError;

      if (existingItem) {
        const { error: updateError } = await supabase
          .from('cart_items')
          .update({ quantity: existingItem.quantity + guestQuantity })
          .eq('id', existingItem.id);
        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase
          .from('cart_items')
          .insert({ cart_id: cart.id, product_id: productId, quantity: guestQuantity });
        if (insertError) throw insertError;
      }
    }

    const { data: items, error: itemsError } = await supabase
      .from('cart_items')
      .select('product_id, quantity')
      .eq('cart_id', cart.id);
    if (itemsError) throw itemsError;

    const total_count = (items || []).reduce((s, r) => s + r.quantity, 0);

    return NextResponse.json({
      message: 'Guest cart successfully merged into persistent database layer',
      cart_id: cart.id,
      total_count,
      items: items || [],
    });
  } catch (err) {
    console.error('POST /api/v1/cart/merge failed:', err);
    return NextResponse.json(
      { error: 'Failed to migrate guest cart to persistent storage' },
      { status: 500 }
    );
  }
}
