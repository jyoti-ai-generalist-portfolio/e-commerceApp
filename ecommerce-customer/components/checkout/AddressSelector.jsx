'use client';

import { useEffect, useState, useCallback } from 'react';
import { useApp } from '../../lib/store/AppProviders';

const MOBILE_RE = /^(?:\+91[- ]?)?[6-9]\d{9}$/;
const PINCODE_RE = /^\d{6}$/;

const EMPTY_FORM = {
  address_line1: '',
  address_line2: '',
  city: '',
  pincode: '',
  mobilenumber: '',
};

function validate(form) {
  const errors = {};
  if (!form.address_line1.trim()) errors.address_line1 = 'Address line 1 is required';
  if (!form.city.trim()) errors.city = 'City is required';
  if (!form.pincode.trim()) {
    errors.pincode = 'Pincode is required';
  } else if (!PINCODE_RE.test(form.pincode.trim())) {
    errors.pincode = 'Pincode must be exactly 6 digits';
  }
  if (!form.mobilenumber.trim()) {
    errors.mobilenumber = 'Mobile number is required';
  } else if (!MOBILE_RE.test(form.mobilenumber.trim())) {
    errors.mobilenumber = 'Enter a valid 10-digit Indian mobile number';
  }
  return errors;
}

export default function AddressSelector({ onSelect }) {
  const { session, pushToast } = useApp();

  const [addresses, setAddresses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(null);

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const loadAddresses = useCallback(async () => {
    if (!session?.access_token) return;
    setLoading(true);
    try {
      const res = await fetch('/api/v1/addresses', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed to load addresses');
      const items = data.data || [];
      setAddresses(items);

      // Auto-select the default address, or the first one, if nothing
      // is selected yet.
      setSelectedId((prev) => {
        if (prev && items.some((a) => a.id === prev)) return prev;
        const fallback = items.find((a) => a.is_default) || items[0];
        return fallback?.id || null;
      });

      if (items.length === 0) setShowForm(true);
    } catch (err) {
      console.error(err);
      pushToast('Could not load your saved addresses.', 'error');
    } finally {
      setLoading(false);
    }
  }, [session, pushToast]);

  useEffect(() => {
    loadAddresses();
  }, [loadAddresses]);

  useEffect(() => {
    if (!selectedId) return;
    const selected = addresses.find((a) => a.id === selectedId);
    if (selected) onSelect?.(selected);
  }, [selectedId, addresses, onSelect]);

  function updateField(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
    if (fieldErrors[field]) {
      setFieldErrors((e) => ({ ...e, [field]: undefined }));
    }
  }

  async function submitNewAddress(ev) {
    ev.preventDefault();
    const errors = validate(form);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSaving(true);
    try {
      const res = await fetch('/api/v1/addresses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data?.fields) setFieldErrors(data.fields);
        throw new Error(data?.error || 'Failed to save address');
      }

      setForm(EMPTY_FORM);
      setShowForm(false);
      await loadAddresses();
      setSelectedId(data.data.id);
      pushToast('Address saved');
    } catch (err) {
      console.error(err);
      pushToast(err.message || 'Could not save address', 'error');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-ink/60">Loading your addresses…</p>;
  }

  return (
    <div>
      {addresses.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2">
          {addresses.map((addr) => (
            <button
              key={addr.id}
              type="button"
              onClick={() => setSelectedId(addr.id)}
              className={`flex gap-3 rounded-card border p-4 text-left transition-colors ${
                selectedId === addr.id
                  ? 'border-ink shadow-[inset_0_0_0_1px_theme(colors.ink)]'
                  : 'border-line hover:border-accent'
              }`}
            >
              <span
                className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                  selectedId === addr.id ? 'border-ink' : 'border-line'
                }`}
              >
                {selectedId === addr.id && <span className="h-2 w-2 rounded-full bg-ink" />}
              </span>
              <span className="text-sm">
                <span className="mb-0.5 flex items-center gap-1 font-medium text-ink">
                  {addr.label}
                  {addr.is_default && (
                    <span className="rounded-card border border-line px-1.5 py-0.5 text-[10px] font-normal text-ink/60">
                      Default
                    </span>
                  )}
                </span>
                <span className="block text-ink/60">{addr.mobilenumber}</span>
                <span className="block text-ink/60">
                  {addr.address_line1}
                  {addr.address_line2 ? `, ${addr.address_line2}` : ''}
                </span>
                <span className="block text-ink/60">
                  {addr.city} – {addr.pincode}
                </span>
              </span>
            </button>
          ))}
        </div>
      )}

      {!showForm && (
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="mt-3 min-h-[44px] rounded-card border border-dashed border-line px-4 text-sm text-ink hover:border-accent"
        >
          + Add new address
        </button>
      )}

      {showForm && (
        <form onSubmit={submitNewAddress} className="mt-4 flex flex-col gap-3 rounded-card border border-line p-4">
          <Field
            label="Address line 1"
            value={form.address_line1}
            onChange={(v) => updateField('address_line1', v)}
            error={fieldErrors.address_line1}
          />
          <Field
            label="Address line 2 (optional)"
            value={form.address_line2}
            onChange={(v) => updateField('address_line2', v)}
          />
          <div className="grid grid-cols-2 gap-3">
            <Field
              label="City"
              value={form.city}
              onChange={(v) => updateField('city', v)}
              error={fieldErrors.city}
            />
            <Field
              label="Pincode"
              value={form.pincode}
              onChange={(v) => updateField('pincode', v)}
              error={fieldErrors.pincode}
              inputMode="numeric"
              maxLength={6}
            />
          </div>
          <Field
            label="Mobile number"
            value={form.mobilenumber}
            onChange={(v) => updateField('mobilenumber', v)}
            error={fieldErrors.mobilenumber}
            inputMode="tel"
          />

          <div className="mt-1 flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="min-h-[44px] flex-1 rounded-card bg-ink text-sm font-medium text-paper hover:bg-accent disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save address'}
            </button>
            {addresses.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setForm(EMPTY_FORM);
                  setFieldErrors({});
                }}
                className="min-h-[44px] rounded-card border border-line px-4 text-sm text-ink hover:border-accent"
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      )}
    </div>
  );
}

function Field({ label, value, onChange, error, ...inputProps }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-ink/70">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`min-h-[44px] rounded-card border bg-white px-3 text-sm text-ink outline-none focus:border-accent ${
          error ? 'border-danger' : 'border-line'
        }`}
        {...inputProps}
      />
      {error && <span className="text-xs text-danger">{error}</span>}
    </label>
  );
}