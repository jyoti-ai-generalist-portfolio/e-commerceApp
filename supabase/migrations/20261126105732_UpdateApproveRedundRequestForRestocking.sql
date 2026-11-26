-- ============================================================================
-- 1. Restore atomic stock restocking + inventory logging inside approve_refund_restore
-- ============================================================================
create or replace function public.approve_refund_restore(
  p_order_id uuid, p_return_id uuid, p_is_cancellation boolean
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item record;
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

  -- 4. Advance return status to 'Refunded' okay
  update returns 
     set status = 'Refunded', 
         updated_at = now()
   where id = p_return_id and order_id = p_order_id;
   
  if not found then raise exception 'Return request not found for this order'; end if;

  -- 5. Restore stock & log inventory changes atomically (replacing refund-processed edge function)
  for v_item in
    select product_id, quantity
      from order_items
     where order_id = p_order_id
       and product_id is not null
  loop
    update products
       set stock = stock + v_item.quantity,
           updated_at = now()
     where id = v_item.product_id;

    insert into inventory_logs (product_id, change_amount, reason, order_id)
    values (
      v_item.product_id,
      v_item.quantity,
      case when p_is_cancellation then 'Order Cancelled / Refunded' else 'Return Refunded' end,
      p_order_id
    );
  end loop;
end;
$$;

revoke all on function public.approve_refund_restore(uuid, uuid, boolean) from public, anon, authenticated;
grant execute on function public.approve_refund_restore(uuid, uuid, boolean) to service_role;

