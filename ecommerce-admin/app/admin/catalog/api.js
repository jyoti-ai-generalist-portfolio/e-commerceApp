// app/admin/catalog/api.js
//
// Thin fetch wrappers around the admin-* Supabase Edge Functions.
// Assumes a shared Supabase client is already set up in your project at
// lib/supabaseClient.js (used elsewhere in this app) — adjust the import
// path below if yours lives somewhere else.

import { supabase } from "../../../lib/supabaseClient";

const FUNCTIONS_BASE = `${process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.REACT_APP_SUPABASE_URL}/functions/v1`;

async function authHeader() {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  if (!token) throw new Error("Not authenticated.");
  return { Authorization: `Bearer ${token}` };
}

async function handleResponse(res) {
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.success === false) {
    const err = new Error(body.error || `Request failed (${res.status}).`);
    err.fields = body.fields;
    err.status = res.status;
    throw err;
  }
  return body;
}

// ---- Categories ----

export async function listCategories() {
  const headers = await authHeader();
  const res = await fetch(`${FUNCTIONS_BASE}/admin-categories`, { headers });
  return handleResponse(res);
}

export async function createCategory({ name, slug }) {
  const headers = await authHeader();
  const res = await fetch(`${FUNCTIONS_BASE}/admin-categories`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ name, slug }),
  });
  return handleResponse(res);
}

export async function updateCategory(id, updates) {
  const headers = await authHeader();
  const res = await fetch(`${FUNCTIONS_BASE}/admin-categories/${id}`, {
    method: "PUT",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  });
  return handleResponse(res);
}

export async function deleteCategory(id) {
  const headers = await authHeader();
  const res = await fetch(`${FUNCTIONS_BASE}/admin-categories/${id}`, {
    method: "DELETE",
    headers,
  });
  return handleResponse(res);
}

// ---- Products ----

export async function listProducts({ page = 1, pageSize = 20, categoryId, search } = {}) {
  const headers = await authHeader();
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  if (categoryId) params.set("category_id", categoryId);
  if (search) params.set("search", search);
  const res = await fetch(`${FUNCTIONS_BASE}/admin-catalog-products?${params}`, { headers });
  return handleResponse(res);
}

export async function createProduct(payload) {
  const headers = await authHeader();
  const res = await fetch(`${FUNCTIONS_BASE}/admin-catalog-products`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return handleResponse(res);
}

export async function updateProduct(id, payload) {
  const headers = await authHeader();
  const res = await fetch(`${FUNCTIONS_BASE}/admin-catalog-products/${id}`, {
    method: "PUT",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return handleResponse(res);
}

export async function deleteProduct(id) {
  const headers = await authHeader();
  const res = await fetch(`${FUNCTIONS_BASE}/admin-catalog-products/${id}`, {
    method: "DELETE",
    headers,
  });
  return handleResponse(res);
}

export async function adjustStock(id, delta, reason) {
  const headers = await authHeader();
  const res = await fetch(`${FUNCTIONS_BASE}/admin-catalog-stock/${id}`, {
    method: "PATCH",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ delta, reason }),
  });
  return handleResponse(res);
}

export async function uploadProductImage(file) {
  const headers = await authHeader();
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch(`${FUNCTIONS_BASE}/admin-media-upload`, {
    method: "POST",
    headers, // do NOT set Content-Type — the browser sets the multipart boundary
    body: formData,
  });
  return handleResponse(res);
}
