
-- ============================================================================
-- 2. Drop all Resend email triggers & pg_net trigger functions
-- ============================================================================
-- Triggers on orders
drop trigger if exists trg_order_confirmation on public.orders;
drop trigger if exists trg_shipment_dispatched on public.orders;
drop trigger if exists trg_out_for_delivery on public.orders;
drop trigger if exists on_order_created on public.orders;
drop trigger if exists on_order_shipping_status_changed on public.orders;


drop trigger if exists trg_order_placed on public.orders;
drop trigger if exists trg_order_shipped on public.orders;
drop trigger if exists trg_return_requested on public.returns;

-- Optional: inspect and drop any leftover trigger functions bound to them
drop function if exists public.handle_order_placed() cascade;
drop function if exists public.handle_order_shipped() cascade;
drop function if exists public.handle_return_requested() cascade;


-- Triggers on returns also
drop trigger if exists trg_return_request_notify on public.returns;
drop trigger if exists trg_refund_processed on public.returns;
drop trigger if exists on_return_created on public.returns;
drop trigger if exists on_return_refunded on public.returns;


-- Drop any leftover trigger functions that called pg_net / edge functions (CASCADE removes bound triggers automatically)
drop function if exists public.notify_order_confirmation() cascade;
drop function if exists public.notify_shipment_dispatched() cascade;
drop function if exists public.notify_out_for_delivery() cascade;
drop function if exists public.notify_return_request() cascade;
drop function if exists public.notify_refund_processed() cascade;
