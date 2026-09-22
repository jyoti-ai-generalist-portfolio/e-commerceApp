import { NextResponse } from 'next/server';
import { getAnonSupabase } from '../../../../lib/supabaseServer';

const LIMIT = 50;

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);
    const categoryId = searchParams.get('category_id');
    const search = (searchParams.get('search') || '').trim();
    const sort = searchParams.get('sort') || 'newest';
    const offset = (page - 1) * LIMIT;

    const supabase = getAnonSupabase();

    let query = supabase
      .from('products')
      .select('id, title, price, image_urls, category_id', { count: 'exact' })
      .eq('is_published', true);

    if (categoryId && categoryId !== 'all') {
      query = query.eq('category_id', categoryId);
    }
    if (search) {
      query = query.ilike('title', `%${search}%`);
    }

    if (sort === 'price_asc') {
      query = query.order('price', { ascending: true });
    } else if (sort === 'price_desc') {
      query = query.order('price', { ascending: false });
    } else {
      query = query.order('created_at', { ascending: false });
    }

    query = query.range(offset, offset + LIMIT - 1);

    const { data, count, error } = await query;
    if (error) throw error;

    return NextResponse.json({
      page,
      limit: LIMIT,
      total_items: count || 0,
      total_pages: Math.max(1, Math.ceil((count || 0) / LIMIT)),
      data: data || [],
    });
  } catch (err) {
    console.error('GET /api/v1/products failed:', err);
    return NextResponse.json({ error: 'Failed to fetch catalog products' }, { status: 500 });
  }
}
