// app/admin/catalog/components/ProductTable.jsx
import StockAdjuster from "./StockAdjuster";

export default function ProductTable({
  products,
  loading,
  page,
  pageSize,
  total,
  categories,
  searchTerm,
  onSearchChange,
  categoryFilter,
  onCategoryFilterChange,
  onPageChange,
  onEdit,
  onDelete,
  onAdjustStock,
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <section>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <input
          type="search"
          placeholder="Search products…"
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-56 rounded-md border border-gray-300 px-3 py-1.5 text-sm"
        />
        <select
          value={categoryFilter}
          onChange={(e) => onCategoryFilterChange(e.target.value)}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm"
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-x-auto rounded-md border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left font-medium text-gray-500">Product</th>
              <th className="px-4 py-2 text-left font-medium text-gray-500">Category</th>
              <th className="px-4 py-2 text-left font-medium text-gray-500">Price</th>
              <th className="px-4 py-2 text-left font-medium text-gray-500">Stock</th>
              <th className="px-4 py-2 text-left font-medium text-gray-500">Status</th>
              <th className="px-4 py-2 text-right font-medium text-gray-500">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {loading &&
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  <td colSpan={6} className="px-4 py-3">
                    <div className="h-4 w-full animate-pulse rounded bg-gray-100" />
                  </td>
                </tr>
              ))}

            {!loading && products.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-gray-400">
                  No products found.
                </td>
              </tr>
            )}

            {!loading &&
              products.map((product) => (
                <tr key={product.id}>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2">
                      {product.image_urls?.[0] && (
                        <img
                          src={product.image_urls[0]}
                          alt=""
                          className="h-8 w-8 rounded object-cover"
                        />
                      )}
                      <span className="font-medium text-gray-900">{product.title}</span>
                    </div>
                  </td>
                  <td className="px-4 py-2 text-gray-600">
                    {product.categories?.name || "—"}
                  </td>
                  <td className="px-4 py-2 text-gray-900">
                    ₹{Number(product.price).toFixed(2)}
                  </td>
                  <td className="px-4 py-2">
                    <StockAdjuster product={product} onAdjust={onAdjustStock} />
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        product.is_published
                          ? "bg-green-100 text-green-700"
                          : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {product.is_published ? "Published" : "Unpublished"}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => onEdit(product)}
                      className="text-indigo-600 hover:underline"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(product.id)}
                      className="ml-3 text-red-600 hover:underline"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex items-center justify-between text-sm text-gray-500">
        <span>
          Page {page} of {totalPages} ({total} products)
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
            className="rounded border border-gray-300 px-2 py-1 disabled:opacity-40"
          >
            Previous
          </button>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
            className="rounded border border-gray-300 px-2 py-1 disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>
    </section>
  );
}
