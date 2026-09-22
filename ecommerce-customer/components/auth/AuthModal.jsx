'use client';

import { useState } from 'react';
import { useApp } from '../../lib/store/AppProviders';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^\+?[0-9\s-]{7,15}$/;

const emptyForm = {
  email: '',
  password: '',
  full_name: '',
  mobilenumber: '',
  address_line1: '',
  address_line2: '',
  city: '',
  pincode: '',
};

export default function AuthModal() {
  const { isAuthModalOpen, closeAuthModal, authModalTab, handleAuthSuccess } = useApp();
  const [tab, setTab] = useState(authModalTab || 'login');
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [offerSwitch, setOfferSwitch] = useState(null); // 'login' | 'signup' | null
  const [submitting, setSubmitting] = useState(false);

  if (!isAuthModalOpen) return null;

  const activeTab = tab;

  function switchTab(next) {
    setTab(next);
    setErrors({});
    setFormError(null);
    setOfferSwitch(null);
  }

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function validateLogin() {
    const e = {};
    if (!EMAIL_RE.test(form.email)) e.email = 'Enter a valid email address.';
    if (!form.password) e.password = 'Password is required.';
    return e;
  }

  function validateSignup() {
    const e = {};
    if (!form.full_name.trim()) e.full_name = 'Full name is required.';
    if (!EMAIL_RE.test(form.email)) e.email = 'Enter a valid email address.';
    if (!form.password || form.password.length < 8) e.password = 'At least 8 characters.';
    if (!PHONE_RE.test(form.mobilenumber)) e.mobilenumber = 'Enter a valid phone number.';
    if (!form.address_line1.trim()) e.address_line1 = 'Address is required.';
    if (!form.city.trim()) e.city = 'City is required.';
    if (!form.pincode.trim()) e.pincode = 'Pincode is required.';
    return e;
  }

  async function handleLogin(ev) {
    ev.preventDefault();
    const v = validateLogin();
    setErrors(v);
    setFormError(null);
    setOfferSwitch(null);
    if (Object.keys(v).length) return;

    setSubmitting(true);
    try {
      const res = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: form.email, password: form.password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error || 'Invalid email or password.');
        if (data.user_exists === false) setOfferSwitch('signup');
        return;
      }
      await handleAuthSuccess({ session: data.session }, { welcomeMessage: 'Logged in successfully' });
      setForm(emptyForm);
    } catch (err) {
      console.error(err);
      setFormError('Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSignup(ev) {
    ev.preventDefault();
    const v = validateSignup();
    setErrors(v);
    setFormError(null);
    setOfferSwitch(null);
    if (Object.keys(v).length) return;

    setSubmitting(true);
    try {
      const res = await fetch('/api/v1/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error || 'Registration failed. Please try again.');
        if (/already exist/i.test(data.error || '')) setOfferSwitch('login');
        return;
      }
      await handleAuthSuccess(
        { session: data.session },
        {
          welcomeMessage: data.session
            ? 'Registration successful. Welcome email sent.'
            : 'Account created — check your email to confirm before logging in.',
        }
      );
      setForm(emptyForm);
    } catch (err) {
      console.error(err);
      setFormError('Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button
        type="button"
        aria-label="Close"
        onClick={closeAuthModal}
        className="absolute inset-0 bg-ink/40"
      />
      <div className="relative flex h-full w-full flex-col bg-paper sm:h-auto sm:max-h-[90vh] sm:w-full sm:max-w-md sm:rounded-card sm:border sm:border-line">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <div className="flex gap-4">
            <button
              type="button"
              onClick={() => switchTab('login')}
              className={`font-display text-lg ${activeTab === 'login' ? 'text-ink' : 'text-ink/40'}`}
            >
              Log in
            </button>
            <button
              type="button"
              onClick={() => switchTab('signup')}
              className={`font-display text-lg ${activeTab === 'signup' ? 'text-ink' : 'text-ink/40'}`}
            >
              Sign up
            </button>
          </div>
          <button
            type="button"
            onClick={closeAuthModal}
            aria-label="Close"
            className="flex h-9 w-9 items-center justify-center rounded-full text-ink hover:bg-accent-soft"
          >
            ✕
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-5">
          {formError && (
            <div className="mb-4 rounded-card bg-danger/10 px-3 py-2 text-sm text-danger">
              {formError}
              {offerSwitch && (
                <button
                  type="button"
                  onClick={() => switchTab(offerSwitch)}
                  className="ml-2 font-medium underline"
                >
                  {offerSwitch === 'signup' ? 'Sign up instead' : 'Log in instead'}
                </button>
              )}
            </div>
          )}

          {activeTab === 'login' ? (
            <form onSubmit={handleLogin} className="flex flex-col gap-4" noValidate>
              <Field
                label="Email address"
                type="email"
                value={form.email}
                onChange={(v) => update('email', v)}
                error={errors.email}
                autoComplete="email"
              />
              <Field
                label="Password"
                type="password"
                value={form.password}
                onChange={(v) => update('password', v)}
                error={errors.password}
                autoComplete="current-password"
              />
              <SubmitButton submitting={submitting} label="Log in" />
            </form>
          ) : (
            <form onSubmit={handleSignup} className="flex flex-col gap-4" noValidate>
              <Field
                label="Full name"
                value={form.full_name}
                onChange={(v) => update('full_name', v)}
                error={errors.full_name}
                autoComplete="name"
              />
              <Field
                label="Email address"
                type="email"
                value={form.email}
                onChange={(v) => update('email', v)}
                error={errors.email}
                autoComplete="email"
              />
              <Field
                label="Password"
                type="password"
                value={form.password}
                onChange={(v) => update('password', v)}
                error={errors.password}
                autoComplete="new-password"
              />
              <Field
                label="Mobile number"
                type="tel"
                value={form.mobilenumber}
                onChange={(v) => update('mobilenumber', v)}
                error={errors.mobilenumber}
                autoComplete="tel"
              />
              <Field
                label="Address line 1"
                value={form.address_line1}
                onChange={(v) => update('address_line1', v)}
                error={errors.address_line1}
                autoComplete="address-line1"
              />
              <Field
                label="Address line 2 (optional)"
                value={form.address_line2}
                onChange={(v) => update('address_line2', v)}
                autoComplete="address-line2"
              />
              <div className="grid grid-cols-2 gap-3">
                <Field
                  label="City"
                  value={form.city}
                  onChange={(v) => update('city', v)}
                  error={errors.city}
                  autoComplete="address-level2"
                />
                <Field
                  label="Pincode"
                  value={form.pincode}
                  onChange={(v) => update('pincode', v)}
                  error={errors.pincode}
                  inputMode="numeric"
                  autoComplete="postal-code"
                />
              </div>
              <SubmitButton submitting={submitting} label="Create account" />
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, type = 'text', value, onChange, error, ...rest }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-sm font-medium text-ink">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={!!error}
        className={`min-h-[44px] rounded-card border px-3 text-sm text-ink outline-none focus:border-accent ${
          error ? 'border-danger' : 'border-line'
        }`}
        {...rest}
      />
      {error && <span className="text-xs text-danger">{error}</span>}
    </label>
  );
}

function SubmitButton({ submitting, label }) {
  return (
    <button
      type="submit"
      disabled={submitting}
      className="mt-1 min-h-[44px] rounded-card bg-ink text-sm font-medium text-paper transition-colors hover:bg-accent disabled:opacity-60"
    >
      {submitting ? 'Please wait…' : label}
    </button>
  );
}
