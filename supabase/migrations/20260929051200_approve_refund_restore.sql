create or replace function public.approve_refund_restore(
  p_order_id uuid, p_return_id uuid, p_is_cancellation boolean
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  item record;
begin
  perform 1 from orders where id = p_order_id for update;
  if not found then raise exception 'Order not found'; end if;

  if exists (select 1 from returns
             where id = p_return_id and order_id = p_order_id
               and lower(status) = 'approved') then
    raise exception 'Return already approved';
  end if;

  update orders
     set status = 'payment_refunded',
         order_shipping_status = case when p_is_cancellation
                                      then 'Cancelled' else order_shipping_status end,
         updated_at = now()
   where id = p_order_id;

  update returns set status = 'Approved', updated_at = now()
   where id = p_return_id and order_id = p_order_id;
  if not found then raise exception 'Return not found for this order'; end if;

  for item in
    select product_id, quantity from order_items
     where order_id = p_order_id and product_id is not null
  loop
    update products
       set stock_quantity = stock_quantity + item.quantity, updated_at = now()
     where id = item.product_id;

    insert into inventory_logs (product_id, change_qty, reason, reference_id)
    values (item.product_id, item.quantity, 'Refund Stock Restored', p_return_id);
  end loop;
end;
$$;

revoke all on function public.approve_refund_restore(uuid, uuid, boolean) from public, anon, authenticated;
grant execute on function public.approve_refund_restore(uuid, uuid, boolean) to service_role;