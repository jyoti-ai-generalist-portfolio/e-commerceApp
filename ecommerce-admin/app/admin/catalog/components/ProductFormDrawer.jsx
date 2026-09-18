// app/admin/catalog/components/ProductFormDrawer.jsx
//
// Slide-over drawer for Add/Edit Product, with the three tabs the use case
// specifies: General Info, Inventory & Pricing, Media Upload.

import { useEffect, useState } from "react";
import { validateProductForm } from "../validation";
import ImageUploader from "./ImageUploader";

const TABS = ["General Info", "Inventory & Pricing", "Media Upload"];

const EMPTY_FORM = {
  category_id: "",
  title: "",
  description: "",
  price: "",
  stock_quantity: "",
  low_stock_threshold: "",
  image_urls: [],
};

export default function ProductFormDrawer({
  open,
  product, // null = create, object = edit
  categories,
  onClose,
  onSubmit,
}) {
  const [tab, setTab] = useState(TABS[0]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [apiError, setApiError] = useState(null);

  useEffect(() => {
    if (!open) return;
    setTab(TABS[0]);
    setErrors({});
    setApiError(null);
    setForm(
      product
        ? {
            category_id: product.category_id || "",
            title: product.title || "",
            description: product.description || "",
            price: product.price ?? "",
            stock_quantity: product.stock_quantity ?? "",
            low_stock_threshold: product.low_stock_threshold ?? "",
            image_urls: product.image_urls || [],
          }
        : EMPTY_FORM,
    );
  }, [open, product]);

  function field(name) {
    return {
      value: form[name],
      onChange: (e) => setForm((f) => ({ ...f, [name]: e.target.value })),
    };
  }

  async function handleSubmit() {
    const validationErrors = validateProductForm(form);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      // Jump to whichever tab has the first error
      if (validationErrors.title || validationErrors.description || validationErrors.category_id) {
        setTab(TABS[0]);
      } else if (validationErrors.price || validationErrors.stock_quantity || validationErrors.low_stock_threshold) {
        setTab(TABS[1]);
      }
      return;
    }

    setSubmitting(true);
    setApiError(null);
    try {
      await onSubmit({
        category_id: form.category_id,
        title: form.title.trim(),
        description: form.description.trim() || null,
        price: Number(form.price),
        stock_quantity: Number(form.stock_quantity),
        low_stock_threshold: Number(form.low_stock_threshold),
        image_urls: form.image_urls,
      });
      onClose();
    } catch (err) {
      setApiError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30">
      <div className="flex h-full w-full max-w-md flex-col bg-white shadow-xl">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <h2 className="text-lg font-semibold">
            {product ? "Edit Product" : "Add Product"}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            ×
          </button>
        </div>

        <div className="flex border-b px-5">
          {TABS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${
                tab === t
                  ? "border-indigo-600 text-indigo-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {tab === "General Info" && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Product Title</label>
                <input
                  type="text"
                  {...field("title")}
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
                {errors.title && <p className="mt-1 text-xs text-red-600">{errors.title}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Category</label>
                <select
                  {...field("category_id")}
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                >
                  <option value="">Select a category…</option>
                  {categories
                    .filter((c) => c.is_active)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                </select>
                {errors.category_id && (
                  <p className="mt-1 text-xs text-red-600">{errors.category_id}</p>
                )}
              </div>
              <div>
                  <label className="block text-sm font-medium text-gray-700">Category</label>
                      {categories.filter((c) => c.is_active).length === 0 ? (
                      <div className="mt-1 rounded-md bg-amber-50 border border-amber-200 p-2 text-xs text-amber-700">
                    ⚠️ No active categories found. Please create a category first before adding products.
                      </div>
                    ) : (
                      <select
                        {...field("category_id")}
                        className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                     >
                    <option value="">Select a category…</option>
                    {categories
                      .filter((c) => c.is_active)
                      .map((c) => (
                      <option key={c.id} value={c.id}>
                       {c.name}
                      </option>
                    ))}
                  </select>
                  )}
                  {errors.category_id && (
                    <p className="mt-1 text-xs text-red-600">{errors.category_id}</p>
                   )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Description</label>
                <textarea
                  rows={4}
                  {...field("description")}
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
                {errors.description && (
                  <p className="mt-1 text-xs text-red-600">{errors.description}</p>
                )}
              </div>
            </div>
          )}

          {tab === "Inventory & Pricing" && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Price</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  {...field("price")}
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
                {errors.price && <p className="mt-1 text-xs text-red-600">{errors.price}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Stock Quantity</label>
                <input
                  type="number"
                  step="1"
                  min="0"
                  {...field("stock_quantity")}
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
                {errors.stock_quantity && (
                  <p className="mt-1 text-xs text-red-600">{errors.stock_quantity}</p>
                )}
                {product && (
                  <p className="mt-1 text-xs text-gray-400">
                    Use the quantity stepper in the product table for day-to-day adjustments —
                    this field sets the value directly, e.g. after a stock take.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Low Stock Threshold</label>
                <input
                  type="number"
                  step="1"
                  min="0"
                  {...field("low_stock_threshold")}
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
                {errors.low_stock_threshold && (
                  <p className="mt-1 text-xs text-red-600">{errors.low_stock_threshold}</p>
                )}
              </div>
            </div>
          )}

          {tab === "Media Upload" && (
            <ImageUploader
              imageUrls={form.image_urls}
              onChange={(urls) => setForm((f) => ({ ...f, image_urls: urls }))}
            />
          )}
        </div>

        <div className="border-t px-5 py-4">
          {apiError && <p className="mb-2 text-sm text-red-600">{apiError}</p>}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={handleSubmit}
              className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {submitting ? "Saving…" : "Save Product"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
