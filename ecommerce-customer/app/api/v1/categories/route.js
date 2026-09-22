// Not one of the spec's named endpoints, but the catalog UI needs a list
// of active categories to populate the filter pills, so this exposes the
// same public-read policy the storefront already relies on
// (categories.is_active = true).
import { NextResponse } from 'next/server';
import { getAnonSupabase } from '../../../../lib/supabaseServer';

export async function GET() {
  try {
    const supabase = getAnonSupabase();
    const { data, error } = await supabase
      .from('categories')
      .select('id, name, slug')
      .eq('is_active', true)
      .order('name', { ascending: true });

    if (error) throw error;

    return NextResponse.json({ data: data || [] });
  } catch (err) {
    console.error('GET /api/v1/categories failed:', err);
    return NextResponse.json({ error: 'Failed to fetch categories' }, { status: 500 });
  }
}
