// GET /api/v1/admin/orders?page=1  -> active orders (paid, not Delivered), 10/page, newest first
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { requireAdmin } from '@/lib/requireAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const PAGE_SIZE = 10;

export async function GET(request) {
  const { error: authError } = await requireAdmin(request);
  if (authError) return authError;

  const page = Math.max(1, parseInt(new URL(request.url).searchParams.get('page') || '1', 10) || 1);
  const from = (page - 1) * PAGE_SIZE;

  const { data: orders, count, error } = await supabaseAdmin
    .from('orders')
    .select('id, customer_id, total_amount, status, order_shipping_status, tracking_number, delivery_date, created_at', { count: 'exact' })
    .eq('status', 'paid')
    .neq('order_shipping_status', 'Delivered')
    .order('created_at', { ascending: false })
    .range(from, from + PAGE_SIZE - 1);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const ids = [...new Set(orders.map((o) => o.customer_id))];
  const { data: profiles } = ids.length
    ? await supabaseAdmin.from('profiles').select('id, full_name, email').in('id', ids)
    : { data: [] };
  const byId = Object.fromEntries((profiles || []).map((p) => [p.id, p]));

  return NextResponse.json({
    orders: orders.map((o) => ({ ...o, customer: byId[o.customer_id] || null })),
    page,
    pageSize: PAGE_SIZE,
    total: count ?? 0,
  });
}
