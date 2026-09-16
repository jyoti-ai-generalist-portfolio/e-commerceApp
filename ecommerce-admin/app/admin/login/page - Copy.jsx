"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

// UC-01: Store Admin - Authentication & Login
// Renders a Google Sign-In button (Google Identity Services script) inside
// a branded card, exchanges the returned id_token with the backend, and
// redirects to /admin/dashboard on success.
export default function AdminLoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const buttonRef = useRef(null);
  const [status, setStatus] = useState("idle"); // idle | loading | success | error
  const [errorMessage, setErrorMessage] = useState("");

  console.log ("Google client id is ",process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID);
  useEffect(() =>  useEffect(() => {
    // 1. Look for an existing script tag to prevent duplicates during Fast Refresh
    let script = document.getElementById("google-gsi-script");
    
    if (!script) {
      script = document.createElement("script");
      script.id = "google-gsi-script";
      // FIX: Changed back to the official Google Identity Services library URL
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      document.body.appendChild(script);
    }

    // 2. Safely bundle the logic inside a named function
    const initializeGoogle = () => {
      // Safety checks: ensure google script loaded, button ref exists, and Client ID is populated
      if (!window || !window.google || !window.google.accounts || !buttonRef.current) return;
      
      const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
      console.log("Client id found is :", clientId);
      if (!clientId) {
        console.error("CRITICAL: NEXT_PUBLIC_GOOGLE_CLIENT_ID is not loaded. Check your .env.local file and restart your terminal server.");
        return;
      }

      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: handleGoogleCredential,
      });

      window.google.accounts.id.renderButton(buttonRef.current, {
        theme: "outline",
        size: "large",
        text: "signin_with",
        shape: "pill",
        width: 280,
      });
    };

    // 3. Trigger initialization based on script load state
    if (window.google && window.google.accounts) {
      initializeGoogle();
    } else {
      script.onload = initializeGoogle;
    }
    
    // Note: We intentionally avoid removing the script on unmount so it stays active in the document global cache
  }, []);

  async function handleGoogleCredential(googleResponse) {
    setStatus("loading");
    setErrorMessage("");
    try {
      const res = await fetch("/api/v1/admin/auth/google", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id_token: googleResponse.credential }),
      });
      const body = await res.json();

      if (!res.ok || !body.success) {
        setStatus("error");
        setErrorMessage(body.error || "Authentication failed. Please try again.");
        return;
      }

      setStatus("success");
      const redirectTo = searchParams.get("redirectTo") || body.data.redirectTo || "/admin/dashboard";
      setTimeout(() => router.push(redirectTo), 900);
    } catch (err) {
      setStatus("error");
      setErrorMessage("Authentication failed. Please try again.");
    }
  }

  return (
    <div className="flex min-h-screen">
      {/* Left brand panel */}
      <div className="relative hidden w-1/2 flex-col justify-between bg-ink p-12 text-white lg:flex">
        <span className="font-display text-2xl">Store Admin</span>
        <div>
          <p className="font-display text-3xl leading-snug">
            Everything your storefront needs,
            <br /> in one operations desk.
          </p>
          <p className="mt-4 max-w-sm text-[14px] text-white/60">
            Catalog, orders, customers, and revenue — reviewed and managed from a
            single, secured admin portal.
          </p>
        </div>
        <p className="text-[12px] text-white/40">© {new Date().getFullYear()} Store Admin</p>
      </div>

      {/* Right auth card */}
      <div className="flex w-full flex-col items-center justify-center bg-canvas px-6 lg:w-1/2">
        <div className="w-full max-w-sm rounded-sm border border-hairline bg-surface p-8">
          <h1 className="font-display text-2xl text-ink2">Admin Portal Login</h1>
          <p className="mt-1 text-[13px] text-muted">
            Sign in with the Google account registered to your store.
          </p>

          <div className="mt-6 flex justify-center">
            {status === "loading" ? (
              <div className="flex h-10 w-[280px] items-center justify-center rounded-full border border-hairline text-[14px] text-muted">
                <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-ink border-t-transparent" />
                Verifying with Google…
              </div>
            ) : (
              <div ref={buttonRef} />
            )}
          </div>

          {status === "success" && (
            <div className="mt-4 rounded-sm border border-accent/30 bg-accent/10 px-4 py-3 text-[13px] text-accent-dark">
              ✓ Authentication successful. Redirecting…
            </div>
          )}

          {status === "error" && (
            <div className="mt-4 rounded-sm border border-alert/30 bg-alert/10 px-4 py-3 text-[13px] text-alert">
              {errorMessage}
            </div>
          )}

          <p className="mt-8 border-t border-hairline pt-4 text-center text-[12px] text-muted">
            This portal is restricted to authorized store personnel only.
          </p>
        </div>
      </div>
    </div>
  );
}
