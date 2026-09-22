import { NextResponse } from 'next/server';
import { getBearerToken, getAuthedSupabase, getUserFromToken } from '../../../../../lib/supabaseServer';

// Note: cart_items has no unique constraint on (cart_id, product_id) in
// the schema provided, so this uses a select-then-update-or-insert flow
// instead of a DB-level upsert. Adding that constraint later would let
// this collapse to a single upsert call and harden it against races
// between two rapid requests for the same product.
export async function POST(request) {
  try {
    const body = await request.json();
    const { product_id, quantity, action } = body || {};

    if (!product_id) {
      return NextResponse.json({ error: 'product_id is required' }, { status: 400 });
    }

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

    const numericQuantity = Number.isFinite(quantity) ? quantity : parseInt(quantity, 10) || 0;

    if (action === 'delete' || numericQuantity <= 0) {
      const { error: deleteError } = await supabase
        .from('cart_items')
        .delete()
        .eq('cart_id', cart.id)
        .eq('product_id', product_id);
      if (deleteError) throw deleteError;

      const { data: remaining, error: remError } = await supabase
        .from('cart_items')
        .select('quantity')
        .eq('cart_id', cart.id);
      if (remError) throw remError;

      const total_count = (remaining || []).reduce((s, r) => s + r.quantity, 0);

      return NextResponse.json({
        message: 'Item removed from cart',
        cart_id: cart.id,
        product_id,
        new_quantity: 0,
        total_count,
      });
    }

    const { data: existingItem, error: existingError } = await supabase
      .from('cart_items')
      .select('id, quantity')
      .eq('cart_id', cart.id)
      .eq('product_id', product_id)
      .maybeSingle();
    if (existingError) throw existingError;

    const finalQuantity =
      action === 'add' ? (existingItem?.quantity || 0) + numericQuantity : numericQuantity;

    if (existingItem) {
      const { error: updateError } = await supabase
        .from('cart_items')
        .update({ quantity: finalQuantity })
        .eq('id', existingItem.id);
      if (updateError) throw updateError;
    } else {
      const { error: insertError } = await supabase
        .from('cart_items')
        .insert({ cart_id: cart.id, product_id, quantity: finalQuantity });
      if (insertError) throw insertError;
    }

    const { data: allItems, error: allError } = await supabase
      .from('cart_items')
      .select('quantity')
      .eq('cart_id', cart.id);
    if (allError) throw allError;

    const total_count = (allItems || []).reduce((s, r) => s + r.quantity, 0);

    return NextResponse.json({
      message: 'Cart item updated successfully',
      cart_id: cart.id,
      product_id,
      new_quantity: finalQuantity,
      total_count,
    });
  } catch (err) {
    console.error('POST /api/v1/cart/items failed:', err);
    return NextResponse.json({ error: 'Failed to update cart item quantity' }, { status: 500 });
  }
}
