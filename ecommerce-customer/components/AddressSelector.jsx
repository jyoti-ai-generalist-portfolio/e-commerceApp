'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useApp } from '../lib/store/AppProviders';
import { useToast } from './ToastHost';

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
  if (!/^\d{6}$/.test(form.pincode.trim())) errors.pincode = 'Enter a valid 6-digit pincode';
  if (!/^[6-9]\d{9}$/.test(form.mobilenumber.trim()))
    errors.mobilenumber = 'Enter a valid 10-digit Indian mobile number';
  return errors;
}

// locked: true during the "partial payment in progress" state — address
// selection must stay frozen while a partial payment is outstanding.
export default function AddressSelector({ selectedAddressId, onSelect, locked = false }) {
  const { user, isLoggedIn } = useApp();
  const { showToast } = useToast();
  const [addresses, setAddresses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isLoggedIn) return;
    loadAddresses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedIn]);

  async function loadAddresses() {
    setLoading(true);
    // Filtered explicitly by profile_id — see DEPLOYMENT.md note: this
    // table currently has no RLS policy of its own, so this app-level
    // filter is the only thing standing between users and each other's
    // addresses until the recommended RLS policies are applied.
    const { data, error } = await supabase
      .from('customer_addresses')
      .select('*')
      .eq('profile_id', user.id)
      .order('created_at', { ascending: true });

    if (error) {
      showToast('Could not load your addresses', { type: 'error' });
      setLoading(false);
      return;
    }

    setAddresses(data || []);
    setLoading(false);
    if (!selectedAddressId && data && data.length > 0) {
      onSelect(data[0].id); // default to first/primary address, per spec
    }
  }

  async function handleAddAddress(e) {
    e.preventDefault();
    const validationErrors = validate(form);
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;

    setSaving(true);
    const { data, error } = await supabase
      .from('customer_addresses')
      .insert({ ...form, profile_id: user.id })
      .select()
      .single();
    setSaving(false);

    if (error) {
      showToast('Could not save address', { type: 'error' });
      return;
    }

    setAddresses((prev) => [...prev, data]);
    onSelect(data.id);
    setForm(EMPTY_FORM);
    setShowForm(false);
    showToast('Address saved');
  }

  if (!isLoggedIn) {
    return (
      <p className="rounded-card bg-accent-soft px-4 py-3 text-sm text-ink/70">
        Log in to select or add a shipping address.
      </p>
    );
  }

  if (loading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        {[0, 1].map((i) => (
          <div key={i} className="h-24 animate-pulse rounded-card bg-accent-soft" />
        ))}
      </div>
    );
  }

  return (
    <div className={locked ? 'pointer-events-none opacity-50' : ''}>
      <div className="grid gap-3 sm:grid-cols-2">
        {addresses.map((addr, idx) => {
          const selected = addr.id === selectedAddressId;
          return (
            <label
              key={addr.id}
              className={`flex cursor-pointer flex-col gap-1 rounded-card border px-4 py-3 text-sm transition-colors ${
                selected ? 'border-ink bg-accent-soft' : 'border-line hover:border-accent'
              }`}
            >
              <div className="flex items-center gap-2">
                <input
                  type="radio"
                  name="shipping-address"
                  checked={selected}
                  onChange={() => onSelect(addr.id)}
                  className="h-4 w-4 accent-ink"
                />
                <span className="font-medium text-ink">
                  {idx === 0 ? 'Home (Default)' : addr.address_line2 ? 'Office' : 'Address'}
                </span>
              </div>
              <p className="pl-6 text-ink/70">{addr.mobilenumber}</p>
              <p className="pl-6 text-ink/70">
                {addr.address_line1}
                {addr.address_line2 ? `, ${addr.address_line2}` : ''}
              </p>
              <p className="pl-6 text-ink/70">
                {addr.city} - {addr.pincode}
              </p>
            </label>
          );
        })}
      </div>

      {!showForm ? (
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="mt-3 min-h-[44px] rounded-card border border-line px-4 text-sm font-medium text-ink hover:border-accent"
        >
          + Add New Address
        </button>
      ) : (
        <form onSubmit={handleAddAddress} className="mt-4 flex flex-col gap-3 rounded-card border border-line p-4">
          <div>
            <input
              type="text"
              placeholder="Address line 1"
              value={form.address_line1}
              onChange={(e) => setForm({ ...form, address_line1: e.target.value })}
              className="min-h-[44px] w-full rounded-card border border-line px-3 text-sm"
            />
            {errors.address_line1 && <p className="mt-1 text-xs text-danger">{errors.address_line1}</p>}
          </div>
          <input
            type="text"
            placeholder="Address line 2 (optional)"
            value={form.address_line2}
            onChange={(e) => setForm({ ...form, address_line2: e.target.value })}
            className="min-h-[44px] w-full rounded-card border border-line px-3 text-sm"
          />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <input
                type="text"
                placeholder="City"
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
                className="min-h-[44px] w-full rounded-card border border-line px-3 text-sm"
              />
              {errors.city && <p className="mt-1 text-xs text-danger">{errors.city}</p>}
            </div>
            <div>
              <input
                type="text"
                inputMode="numeric"
                placeholder="Pincode"
                value={form.pincode}
                onChange={(e) => setForm({ ...form, pincode: e.target.value })}
                className="min-h-[44px] w-full rounded-card border border-line px-3 text-sm"
              />
              {errors.pincode && <p className="mt-1 text-xs text-danger">{errors.pincode}</p>}
            </div>
          </div>
          <div>
            <input
              type="tel"
              placeholder="Mobile number"
              value={form.mobilenumber}
              onChange={(e) => setForm({ ...form, mobilenumber: e.target.value })}
              className="min-h-[44px] w-full rounded-card border border-line px-3 text-sm"
            />
            {errors.mobilenumber && <p className="mt-1 text-xs text-danger">{errors.mobilenumber}</p>}
          </div>
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={saving}
              className="min-h-[44px] flex-1 rounded-card bg-ink text-sm font-medium text-paper disabled:opacity-40"
            >
              {saving ? 'Saving…' : 'Save Address'}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setErrors({});
              }}
              className="min-h-[44px] rounded-card border border-line px-4 text-sm text-ink"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
