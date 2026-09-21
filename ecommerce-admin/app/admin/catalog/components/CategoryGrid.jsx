// app/admin/catalog/components/CategoryGrid.jsx
import { useState } from "react";
import { validateCategoryForm } from "../validation";

export default function CategoryGrid({
  categories,
  loading,
  onCreate,
  onUpdate,
  onDelete,
}) {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ name: "" });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  function startAdd() {
    setIsAdding(true);
    setEditingId(null);
    setForm({ name: "" });
    setErrors({});
  }

  function startEdit(category) {
    setEditingId(category.id);
    setIsAdding(false);
    setForm({ name: category.name });
    setErrors({});
  }

  function cancel() {
    setIsAdding(false);
    setEditingId(null);
    setErrors({});
  }

  async function submit() {
    const validationErrors = validateCategoryForm(form);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }
    setSubmitting(true);
    try {

      /* Added code for generating user friendly slug */
      const trimmedName = form.name.trim();
    // Generate a URL-friendly slug (e.g., "T-Shirts" becomes "t-shirts")
    const generatedSlug = trimmedName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)+/g, "");

      if (editingId) {
        await onUpdate(editingId, { name: form.name.trim() });
      } else {
        await onCreate({ name: form.name.trim() });
      }
      cancel();
    } catch (err) {
      setErrors({ form: err.message });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="mb-8">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold text-gray-900">Categories</h2>
        {!isAdding && (
          <button
            type="button"
            onClick={startAdd}
            className="inline-flex items-center gap-1 rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
          >
            + Add Category
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        {loading && <p className="text-sm text-gray-500">Loading categories…</p>}

        {!loading &&
          categories.map((category) => (
            <div
              key={category.id}
              className={`flex items-center gap-2 rounded-full border px-4 py-2 text-sm ${
                category.is_active
                  ? "border-gray-200 bg-white"
                  : "border-gray-200 bg-gray-100 text-gray-400 line-through"
              }`}
            >
              <span>{category.name}</span>
              <button
                type="button"
                onClick={() => startEdit(category)}
                className="text-indigo-600 hover:underline"
              >
                Edit
              </button>
              {category.is_active && (
                <button
                  type="button"
                  onClick={() => onDelete(category.id)}
                  className="text-red-600 hover:underline"
                >
                  Delete
                </button>
              )}
            </div>
          ))}

        {(isAdding || editingId) && (
          <div className="flex items-center gap-2 rounded-full border border-indigo-300 bg-indigo-50 px-3 py-1.5">
            <input
              autoFocus
              type="text"
              value={form.name}
              onChange={(e) => setForm({ name: e.target.value })}
              placeholder="Category name"
              className="w-40 rounded border border-gray-300 px-2 py-1 text-sm"
            />
            <button
              type="button"
              disabled={submitting}
              onClick={submit}
              className="text-sm font-medium text-indigo-700 disabled:opacity-50"
            >
              Save
            </button>
            <button type="button" onClick={cancel} className="text-sm text-gray-500">
              Cancel
            </button>
          </div>
        )}
      </div>
      {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name}</p>}
      {errors.form && <p className="mt-1 text-xs text-red-600">{errors.form}</p>}
    </section>
  );
}
