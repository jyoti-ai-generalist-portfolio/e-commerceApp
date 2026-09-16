"use client";

const STATUS_STYLES = {
  pending: "bg-[#F4E9DA] text-[#8A5A1E]",
  shipped: "bg-[#DCE6F2] text-[#2A4E7C]",
  delivered: "bg-[#DFEDE4] text-[#23533B]",
  cancelled: "bg-[#F2DEDA] text-[#B3432B]",
};

export default function RecentOrdersTable({ orders, isLoading }) {
  return (
    <div className="rounded-sm border border-hairline bg-surface p-5">
      <h2 className="font-display text-lg text-ink2">Recent orders</h2>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-left text-[13px]">
          <thead>
            <tr className="border-b border-hairline text-muted">
              <th className="pb-2 font-medium">Order ID</th>
              <th className="pb-2 font-medium">Customer</th>
              <th className="pb-2 font-medium">Placed</th>
              <th className="pb-2 font-medium">Total</th>
              <th className="pb-2 font-medium">Status</th>
              <th className="pb-2 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {isLoading &&
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b border-hairline last:border-0">
                  <td colSpan={6} className="py-3">
                    <div className="h-4 w-full animate-pulse rounded bg-canvas" />
                  </td>
                </tr>
              ))}

            {!isLoading && orders.length === 0 && (
              <tr>
                <td colSpan={6} className="py-6 text-center text-muted">
                  No orders yet in this period.
                </td>
              </tr>
            )}

            {!isLoading &&
              orders.map((order) => (
                <tr key={order.order_id} className="border-b border-hairline text-ink2 last:border-0">
                  <td className="py-3 font-medium">{order.order_id}</td>
                  <td className="py-3">{order.customer_name}</td>
                  <td className="py-3 text-muted">
                    {new Date(order.created_at).toLocaleString()}
                  </td>
                  <td className="py-3">${order.total.toFixed(2)}</td>
                  <td className="py-3">
                    <span
                      className={`rounded-sm px-2 py-1 text-[12px] capitalize ${
                        STATUS_STYLES[order.status] || "bg-canvas text-muted"
                      }`}
                    >
                      {order.status}
                    </span>
                  </td>
                  <td className="py-3 text-right">
                    <a href={`/admin/orders/${order.order_id}`} className="text-accent hover:underline">
                      View
                    </a>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
