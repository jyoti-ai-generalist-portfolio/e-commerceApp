// app/admin/catalog/components/ImageUploader.jsx
//
// Drag & drop / click-to-select image uploader. Uploads immediately on
// selection and appends the returned public URL to `imageUrls`. Real
// schema supports multiple images (image_urls[]); capped at 5 here to
// match the edge function's validation.

import { useRef, useState } from "react";
import { validateImageFile } from "../validation";
import { uploadProductImage } from "../api";

export default function ImageUploader({ imageUrls, onChange }) {
  const inputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);

  async function handleFiles(fileList) {
    setError(null);
    const files = Array.from(fileList);
    if (imageUrls.length + files.length > 5) {
      setError("Maximum 5 images per product.");
      return;
    }

    for (const file of files) {
      const validationError = validateImageFile(file);
      if (validationError) {
        setError(validationError);
        return;
      }
    }

    setUploading(true);
    try {
      const uploaded = [];
      for (const file of files) {
        const res = await uploadProductImage(file);
        uploaded.push(res.data.url);
      }
      onChange([...imageUrls, ...uploaded]);
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  }

  function removeImage(url) {
    onChange(imageUrls.filter((u) => u !== url));
  }

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          handleFiles(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-md border-2 border-dashed p-6 text-sm text-gray-500 ${
          dragOver ? "border-indigo-400 bg-indigo-50" : "border-gray-300"
        }`}
      >
        <p>{uploading ? "Uploading…" : "Drag & drop images, or click to select"}</p>
        <p className="mt-1 text-xs text-gray-400">JPEG, PNG, or WebP — up to 5MB, up to 5 images</p>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          hidden
          onChange={(e) => e.target.files && handleFiles(e.target.files)}
        />
      </div>

      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}

      {imageUrls.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {imageUrls.map((url) => (
            <div key={url} className="relative">
              <img src={url} alt="" className="h-16 w-16 rounded object-cover" />
              <button
                type="button"
                onClick={() => removeImage(url)}
                className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-gray-900 text-xs text-white"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
