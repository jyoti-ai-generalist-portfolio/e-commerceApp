create or replace function public.approve_refund_restore(
  p_order_id uuid, p_return_id uuid, p_is_cancellation boolean
) returns void
language plpgsql
security definer
set search_path = public
as \$\$
begin
  -- 1. Row locking for transaction safety
  perform 1 from orders where id = p_order_id for update;
  if not found then raise exception 'Order not found'; end if;

  -- 2. Idempotency Check
  if exists (select 1 from returns
             where id = p_return_id and order_id = p_order_id
               and status in ('Approved', 'Refunded')) then
    raise exception 'Return request is already processed or approved';
  end if;

  -- 3. Update parent order attributes symmetrically
  update orders
     set status = 'refunded',
         order_shipping_status = case when p_is_cancellation then 'Cancelled' else 'Returned' end,
         updated_at = now()
   where id = p_order_id;

  -- 4. Advance status to 'Refunded' to trip the `trg_refund_processed` edge function
  update returns 
     set status = 'Refunded', 
         updated_at = now()
   where id = p_return_id and order_id = p_order_id;
   
  if not found then raise exception 'Return request not found for this order'; end if;

  -- NOTE: Restocking loops are removed here because they are handled asynchronously 
  -- by the `refund-processed` Supabase edge function via the database trigger.
end;
\$\$;

revoke all on function public.approve_refund_restore(uuid, uuid, boolean) from public, anon, authenticated;
grant execute on function public.approve_refund_restore(uuid, uuid, boolean) to service_role;
