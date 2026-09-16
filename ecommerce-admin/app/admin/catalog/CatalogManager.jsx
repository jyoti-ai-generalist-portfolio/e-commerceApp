// app/admin/catalog/CatalogManager.jsx
//
// Target route: /admin/dashboard/catalog
// Wires together CategoryGrid, ProductTable, and ProductFormDrawer, and
// owns all the data fetching/mutation calls in api.js.

import { useEffect, useState, useCallback } from "react";
import CategoryGrid from "./components/CategoryGrid";
import ProductTable from "./components/ProductTable";
import ProductFormDrawer from "./components/ProductFormDrawer";
import * as api from "./api";

const PAGE_SIZE = 20;

export default function CatalogManager() {
  const [categories, setCategories] = useState([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);

  const [products, setProducts] = useState([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);

  const [toast, setToast] = useState(null); // { type: 'success' | 'error', message }

  function showToast(type, message) {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3500);
  }

  const loadCategories = useCallback(async () => {
    setCategoriesLoading(true);
    try {
      const res = await api.listCategories();
      setCategories(res.data);
    } catch (err) {
      showToast("error", err.message);
    } finally {
      setCategoriesLoading(false);
    }
  }, []);

  const loadProducts = useCallback(async () => {
    setProductsLoading(true);
    try {
      const res = await api.listProducts({
        page,
        pageSize: PAGE_SIZE,
        categoryId: categoryFilter || undefined,
        search: search || undefined,
      });
      setProducts(res.data);
      setTotal(res.total ?? res.data.length);
    } catch (err) {
      showToast("error", err.message);
    } finally {
      setProductsLoading(false);
    }
  }, [page, categoryFilter, search]);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  // ---- Category handlers ----

  async function handleCreateCategory(payload) {
    await api.createCategory(payload);
    showToast("success", "Category created successfully.");
    loadCategories();
  }

  async function handleUpdateCategory(id, updates) {
    await api.updateCategory(id, updates);
    showToast("success", "Category updated successfully.");
    loadCategories();
  }

  async function handleDeleteCategory(id) {
    try {
      const res = await api.deleteCategory(id);
      showToast("success", res.warning || "Category removed.");
      loadCategories();
    } catch (err) {
      showToast("error", err.message);
    }
  }

  // ---- Product handlers ----

  function openAddProduct() {
    setEditingProduct(null);
    setDrawerOpen(true);
  }

  function openEditProduct(product) {
    setEditingProduct(product);
    setDrawerOpen(true);
  }

  async function handleSubmitProduct(payload) {
    if (editingProduct) {
      await api.updateProduct(editingProduct.id, payload);
      showToast("success", "Product updated successfully.");
    } else {
      await api.createProduct(payload);
      showToast("success", "Product created successfully.");
    }
    loadProducts();
  }

  async function handleDeleteProduct(id) {
    try {
      await api.deleteProduct(id);
      showToast("success", "Product unpublished.");
      loadProducts();
    } catch (err) {
      showToast("error", err.message);
    }
  }

  async function handleAdjustStock(id, delta) {
    // Optimistic UI update, corrected by the server response.
    setProducts((prev) =>
      prev.map((p) =>
        p.id === id ? { ...p, stock_quantity: p.stock_quantity + delta } : p,
      ),
    );
    try {
      const res = await api.adjustStock(id, delta);
      setProducts((prev) => prev.map((p) => (p.id === id ? res.data : p)));
    } catch (err) {
      loadProducts(); // revert optimistic update on failure
      throw err;
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Catalog Management</h1>
        <button
          type="button"
          onClick={openAddProduct}
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          + Add Product
        </button>
      </div>

      {toast && (
        <div
          className={`mb-4 rounded-md px-4 py-2 text-sm ${
            toast.type === "success"
              ? "bg-green-50 text-green-700 border border-green-200"
              : "bg-red-50 text-red-700 border border-red-200"
          }`}
        >
          {toast.message}
        </div>
      )}

      <CategoryGrid
        categories={categories}
        loading={categoriesLoading}
        onCreate={handleCreateCategory}
        onUpdate={handleUpdateCategory}
        onDelete={handleDeleteCategory}
      />

      <ProductTable
        products={products}
        loading={productsLoading}
        page={page}
        pageSize={PAGE_SIZE}
        total={total}
        categories={categories}
        searchTerm={search}
        onSearchChange={(v) => {
          setPage(1);
          setSearch(v);
        }}
        categoryFilter={categoryFilter}
        onCategoryFilterChange={(v) => {
          setPage(1);
          setCategoryFilter(v);
        }}
        onPageChange={setPage}
        onEdit={openEditProduct}
        onDelete={handleDeleteProduct}
        onAdjustStock={handleAdjustStock}
      />

      <ProductFormDrawer
        open={drawerOpen}
        product={editingProduct}
        categories={categories}
        onClose={() => setDrawerOpen(false)}
        onSubmit={handleSubmitProduct}
      />
    </div>
  );
}
