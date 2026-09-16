// app/admin/catalog/validation.js
//
// Client-side validation mirroring the rules in Use Case 19's Input
// Fields & Validation table. The edge functions re-validate everything
// server-side too — this is purely for fast, friendly inline feedback.

export function validateCategoryForm({ name }) {
  const errors = {};
  const trimmed = (name || "").trim();
  if (!trimmed) {
    errors.name = "Category name is required.";
  } else if (trimmed.length < 2 || trimmed.length > 50) {
    errors.name = "Category name must be 2-50 characters.";
  }
  return errors;
}

export function validateProductForm(form) {
  const errors = {};

  const title = (form.title || "").trim();
  if (!title) {
    errors.title = "Product title is required.";
  } else if (title.length < 3 || title.length > 150) {
    errors.title = "Product title must be 3-150 characters.";
  }

  if (form.description && !/^[a-zA-Z0-9\s.,!?'"()-]*$/.test(form.description)) {
    errors.description = "Description can only contain letters, numbers, and basic punctuation.";
  }

  const price = Number(form.price);
  if (form.price === "" || form.price === null || form.price === undefined) {
    errors.price = "Price is required.";
  } else if (!Number.isFinite(price) || price <= 0) {
    errors.price = "Price must be a decimal greater than 0.00.";
  }

  const stock = Number(form.stock_quantity);
  if (form.stock_quantity === "" || form.stock_quantity === null || form.stock_quantity === undefined) {
    errors.stock_quantity = "Stock quantity is required.";
  } else if (!Number.isInteger(stock) || stock < 0) {
    errors.stock_quantity = "Stock quantity must be a whole number >= 0.";
  }

  const threshold = Number(form.low_stock_threshold);
  if (form.low_stock_threshold === "" || form.low_stock_threshold === null || form.low_stock_threshold === undefined) {
    errors.low_stock_threshold = "Low stock threshold is required.";
  } else if (!Number.isInteger(threshold) || threshold < 0) {
    errors.low_stock_threshold = "Low stock threshold must be a whole number >= 0.";
  }

  if (!form.category_id) {
    errors.category_id = "Please select a category.";
  }

  return errors;
}

export function validateImageFile(file) {
  const allowed = ["image/jpeg", "image/png", "image/webp"];
  if (!allowed.includes(file.type)) {
    return "Only JPEG, PNG, or WebP images are allowed.";
  }
  if (file.size > 5 * 1024 * 1024) {
    return "Image must be 5MB or smaller.";
  }
  return null;
}
