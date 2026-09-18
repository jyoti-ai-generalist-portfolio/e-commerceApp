"use client";

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
  // 1. ADD AN ACCESS TOKEN STATE
  const [authToken, setAuthToken] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

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
  const [toast, setToast] = useState(null);

  function showToast(type, message) {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3500);
  }

    // FETCH TOKEN EXACTLY ONCE ON INITIAL MOUNT
  useEffect(() => {
    async function initializeAuth() {
      try {
        const res = await fetch("/api/v1/admin/auth/me");
        
        if (!res.ok) {
          // DIAGNOSTIC ALERT: Find out the exact server status (e.g., 401, 404, 500)
          alert(`Auth Endpoint Failed Status: ${res.status}`);
          window.location.href = "/admin/login";
          return;
        }
        
        const body = await res.json();
        if (body.success && body.data?.access_token) {
          console.log("Setting auth token inside page.jsx ", body.data.access_token);
          setAuthToken(body.data.access_token);
        } else {
          // DIAGNOSTIC ALERT: Find out what error string your server returned
          alert(`Auth Failed. Server message: ${body.error || 'No token provided'}`);
          window.location.href = "/admin/login";
        }
      } catch (err) {
        alert(`Auth Network Error: ${err.message}`);
        window.location.href = "/admin/login";
      } finally {
        setAuthLoading(false);
      }
    }
    initializeAuth();
  }, []);


  // 3. REFRACTOR LOADING METHODS TO DEPEND ON AUTH TOKEN STATE
  const loadCategories = useCallback(async () => {
    if (!authToken) return;
    setCategoriesLoading(true);
    try {
      const res = await api.listCategories(authToken);
      setCategories(res.data);
    } catch (err) {
      showToast("error", err.message || "Failed to load categories.");
    } finally {
      setCategoriesLoading(false);
    }
  }, [authToken]);

  const loadProducts = useCallback(async () => {
    if (!authToken) return;
    setProductsLoading(true);
    try {
      const res = await api.listProducts(authToken, {
        page,
        pageSize: PAGE_SIZE,
        categoryId: categoryFilter || undefined,
        search: search || undefined,
      });
      setProducts(res.data);
      setTotal(res.total ?? res.data.length);
    } catch (err) {
      showToast("error", err.message || "Failed to load products.");
    } finally {
      setProductsLoading(false);
    }
  }, [page, categoryFilter, search, authToken]);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  // ---- Category handlers ----

  async function handleCreateCategory(payload) {
    try {
      await api.createCategory(authToken, payload);
      showToast("success", "Category created successfully.");
      loadCategories();
    } catch (err) {
      showToast("error", err.message || "Could not create category.");
    }
  }

  async function handleUpdateCategory(id, updates) {
    try {
      await api.updateCategory(authToken, id, updates);
      showToast("success", "Category updated successfully.");
      loadCategories();
    } catch (err) {
      showToast("error", err.message || "Could not update category.");
    }
  }

  async function handleDeleteCategory(id) {
    try {
      const res = await api.deleteCategory(authToken, id);
      showToast("success", res.warning || "Category removed.");
      loadCategories();
    } catch (err) {
      showToast("error", err.message || "Could not delete category.");
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
    try {
      if (editingProduct) {
        await api.updateProduct(authToken, editingProduct.id, payload);
        showToast("success", "Product updated successfully.");
      } else {
        await api.createProduct(authToken, payload);
        showToast("success", "Product created successfully.");
      }
      setDrawerOpen(false);
      loadProducts();
    } catch (err) {
      showToast("error", err.message || "Could not save product.");
    }
  }

  async function handleDeleteProduct(id) {
    try {
      await api.deleteProduct(authToken, id);
      showToast("success", "Product unpublished.");
      loadProducts();
    } catch (err) {
      showToast("error", err.message || "Could not delete product.");
    }
  }

  async function handleAdjustStock(id, delta) {
    setProducts((prev) =>
      prev.map((p) =>
        p.id === id ? { ...p, stock_quantity: p.stock_quantity + delta } : p
      )
    );
    try {
      const res = await api.adjustStock(authToken, id, delta);
      setProducts((prev) => prev.map((p) => (p.id === id ? res.data : p)));
    } catch (err) {
      showToast("error", err.message || "Could not adjust stock.");
      loadProducts();
    }
  }

  // Show generic full-page loader while resolving authentication state
  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <p className="text-sm font-medium text-gray-500">Verifying session...</p>
      </div>
    );
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
