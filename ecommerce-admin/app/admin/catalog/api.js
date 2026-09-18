"use server"; // Enforces that all functions in this file run ONLY on the server

import { supabaseAdmin } from "../../../lib/supabaseClient";

const FUNCTIONS_BASE = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1`;

/*async function authHeader(token) {
  if (!token) throw new Error("Not authenticated.");
  
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) throw new Error("Server configuration error: Service key missing.");
  
  return { 
    "Authorization": `Bearer ${serviceKey}`,
    "apikey": serviceKey
  };
}*/
async function authHeader(token) {
  if (!token) throw new Error("Not authenticated.");
  
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) throw new Error("Server configuration error: Service key missing.");
  
  return { 
    "Authorization": `Bearer ${serviceKey}`, // Keeps supabase proxy auth happy
    "apikey": serviceKey,
    "X-Admin-Token": token // ← Access token forwarded explicitly to Edge Functions
  };
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

// ... Keep your standard listCategories, listProducts, etc. exactly as they were using this authHeader pattern ...

// ---- Categories ----

export async function listCategories(token) {
  const headers = await authHeader(token);
  const res = await fetch(`${FUNCTIONS_BASE}/admin-categories`, { 
    method: "GET",
    headers 
  });
  return handleResponse(res);
}

export async function createCategory(token, { name, slug }) {
  const headers = await authHeader(token);
  const res = await fetch(`${FUNCTIONS_BASE}/admin-categories`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ name, slug }),
  });
  return handleResponse(res);
}

export async function updateCategory(token, id, updates) {
  const headers = await authHeader(token);
  const res = await fetch(`${FUNCTIONS_BASE}/admin-categories/${id}`, {
    method: "PUT",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  });
  return handleResponse(res);
}

export async function deleteCategory(token, id) {
  const headers = await authHeader(token);
  const res = await fetch(`${FUNCTIONS_BASE}/admin-categories/${id}`, {
    method: "DELETE",
    headers,
  });
  return handleResponse(res);
}

// ---- Products ----

export async function listProducts(token, { page = 1, pageSize = 20, categoryId, search } = {}) {
  const headers = await authHeader(token);
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  if (categoryId) params.set("category_id", categoryId);
  if (search) params.set("search", search);
  
  const res = await fetch(`${FUNCTIONS_BASE}/admin-catalog-products?${params.toString()}`, { 
    method: "GET",
    headers 
  });
  return handleResponse(res);
}

export async function createProduct(token, payload) {
  const headers = await authHeader(token);
  const res = await fetch(`${FUNCTIONS_BASE}/admin-catalog-products`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return handleResponse(res);
}

export async function updateProduct(token, id, payload) {
  const headers = await authHeader(token);
  const res = await fetch(`${FUNCTIONS_BASE}/admin-catalog-products/${id}`, {
    method: "PUT",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return handleResponse(res);
}

export async function deleteProduct(token, id) {
  const headers = await authHeader(token);
  const res = await fetch(`${FUNCTIONS_BASE}/admin-catalog-products/${id}`, {
    method: "DELETE",
    headers,
  });
  return handleResponse(res);
}

export async function adjustStock(token, id, delta, reason) {
  const headers = await authHeader(token);
  const res = await fetch(`${FUNCTIONS_BASE}/admin-catalog-stock/${id}`, {
    method: "PATCH",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ delta, reason }),
  });
  return handleResponse(res);
}

export async function uploadProductImage(token, formData) {
  const headers = await authHeader(token);
  const res = await fetch(`${FUNCTIONS_BASE}/admin-media-upload`, {
    method: "POST",
    headers, // Fetch handles multi-part boundary additions automatically when given FormData
    body: formData,
  });
  return handleResponse(res);
}
