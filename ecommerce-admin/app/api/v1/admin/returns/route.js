// GET /api/v1/admin/returns?page=1&status=Requested  -> return/cancellation requests, 10/page
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { requireAdmin } from '@/lib/requireAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const PAGE_SIZE = 10;
const STATUSES = ['Requested', 'Approved', 'Rejected', 'Refunded'];

export async function GET(request) {
  const { error: authError } = await requireAdmin(request);
  if (authError) return authError;

  const sp = new URL(request.url).searchParams;
  const page = Math.max(1, parseInt(sp.get('page') || '1', 10) || 1);
  const status = sp.get('status');
  const from = (page - 1) * PAGE_SIZE;

  let q = supabaseAdmin
    .from('returns')
    .select('id, order_id, reason, status, created_at, orders(total_amount, status, order_shipping_status, customer_id)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, from + PAGE_SIZE - 1);
  if (STATUSES.includes(status)) q = q.eq('status', status);

  const { data: rows, count, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const ids = [...new Set(rows.map((r) => r.orders?.customer_id).filter(Boolean))];
  const { data: profiles } = ids.length
    ? await supabaseAdmin.from('profiles').select('id, full_name, email').in('id', ids)
    : { data: [] };
  const byId = Object.fromEntries((profiles || []).map((p) => [p.id, p]));

  return NextResponse.json({
    returns: rows.map((r) => ({
      ...r,
      kind: r.orders?.order_shipping_status === 'Delivered' ? 'Return' : 'Cancellation',
      customer: byId[r.orders?.customer_id] || null,
    })),
    page,
    pageSize: PAGE_SIZE,
    total: count ?? 0,
  });
}
