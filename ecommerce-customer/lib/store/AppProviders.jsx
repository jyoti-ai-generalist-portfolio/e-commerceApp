'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { supabase } from '../supabaseClient';
import { readGuestCart, writeGuestCart, clearGuestCart, guestCartTotalCount } from '../guestCart';

const AppContext = createContext(null);

let toastId = 0;

export function AppProviders({ children }) {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [authReady, setAuthReady] = useState(false);

  const [cartItems, setCartItems] = useState([]); // [{product_id, title, price, image_url, quantity}]
  const [cartLoading, setCartLoading] = useState(false);

  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalTab, setAuthModalTab] = useState('login');

  const [toasts, setToasts] = useState([]);
  const guestCartRef = useRef({});

  const pushToast = useCallback((message, type = 'success') => {
    const id = ++toastId;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3200);
  }, []);

  const fetchServerCart = useCallback(async (accessToken) => {
    setCartLoading(true);
    try {
      const res = await fetch('/api/v1/cart', {
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed to load cart');
      setCartItems(
        (data.items || []).map((i) => ({
          product_id: i.product_id,
          title: i.title,
          price: i.price,
          image_url: i.image_url,
          quantity: i.quantity,
        }))
      );
    } catch (err) {
      console.error(err);
      pushToast('Could not load your cart right now.', 'error');
    } finally {
      setCartLoading(false);
    }
  }, [pushToast]);

  const loadGuestCartIntoState = useCallback(() => {
    const map = readGuestCart();
    guestCartRef.current = map;
    setCartItems(
      Object.entries(map).map(([product_id, item]) => ({
        product_id,
        title: item.title,
        price: item.price,
        image_url: item.image_url,
        quantity: item.quantity,
      }))
    );
  }, []);

  // Bootstrap: check for an existing Supabase session, else fall back to
  // the guest (sessionStorage) cart.
  useEffect(() => {
    let isMounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!isMounted) return;
      const currentSession = data?.session || null;
      setSession(currentSession);
      setUser(currentSession?.user || null);
      setAuthReady(true);
      if (currentSession) {
        fetchServerCart(currentSession.access_token);
      } else {
        loadGuestCartIntoState();
      }
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user || null);
    });

    return () => {
      isMounted = false;
      sub?.subscription?.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const mergeGuestCartIfAny = useCallback(
    async (accessToken) => {
      const guestMap = readGuestCart();
      const entries = Object.entries(guestMap);
      if (entries.length === 0) return;

      try {
        const res = await fetch('/api/v1/cart/merge', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            guest_cart: entries.map(([product_id, item]) => ({
              product_id,
              quantity: item.quantity,
            })),
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || 'Failed to merge cart');
        clearGuestCart();
        guestCartRef.current = {};
      } catch (err) {
        console.error(err);
        pushToast('Could not merge your guest cart. It has been kept for next time.', 'error');
      }
    },
    [pushToast]
  );

  const handleAuthSuccess = useCallback(
    async ({ session: newSession }, { welcomeMessage } = {}) => {
      if (!newSession) {
        pushToast(
          welcomeMessage || 'Check your email to confirm your account before logging in.',
          'success'
        );
        setIsAuthModalOpen(false);
        return;
      }
      await supabase.auth.setSession({
        access_token: newSession.access_token,
        refresh_token: newSession.refresh_token,
      });
      await mergeGuestCartIfAny(newSession.access_token);
      await fetchServerCart(newSession.access_token);
      setIsAuthModalOpen(false);
      pushToast(welcomeMessage || 'Logged in successfully', 'success');
    },
    [mergeGuestCartIfAny, fetchServerCart, pushToast]
  );

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    clearGuestCart();
    guestCartRef.current = {};
    setCartItems([]);
    setUser(null);
    setSession(null);
  }, []);

  // action: 'add' | 'update' | 'delete'
  
  // action: 'add' | 'update' | 'delete'
  const mutateCart = useCallback(
    async (product, { quantity, action }) => {
      // 1. AUTHENTICATED USER PATH (Database Call)
      const targetProductId = product.id || product.product_id;
      if (session?.access_token) {
        try {
          const res = await fetch('/api/v1/cart/items', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({ product_id: targetProductId, quantity, action }), //targetProductId
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data?.error || 'Cart update failed');

          setCartItems((prev) => {
            const existingIndex = prev.findIndex((i) => i.product_id === targetProductId);
            if (data.new_quantity <= 0) {
              return prev.filter((i) => i.product_id !== targetProductId); // Changed targetProductId
            }
            if (existingIndex >= 0) {
              const next = [...prev];
              next[existingIndex] = { ...next[existingIndex], quantity: data.new_quantity };
              return next;
            }
            return [
              ...prev,
              {
                product_id: targetProductId, // Changed targetProductId
                title: product.title,
                price: product.price,
                image_url: product.image_urls?.[0] || null,
                quantity: data.new_quantity,
              },
            ];
          });
          pushToast(data.new_quantity <= 0 ? 'Item removed from cart' : 'Cart updated');
        } catch (err) {
          console.error(err);
          pushToast('Failed to update cart item quantity', 'error');
        }
        return;
      }

      // 2. GUEST USER PATH (sessionStorage only, no network call)
      // Normalize identifier since catalog uses product.id and cart arrays use product.product_id
      //const targetProductId = product.product_id || product.id;
      
      const map = { ...guestCartRef.current };
      const current = map[targetProductId]?.quantity || 0;
      const nextQuantity =
        action === 'add' ? current + (quantity ?? 1) : action === 'delete' ? 0 : quantity ?? 0;

      if (nextQuantity <= 0) {
        delete map[targetProductId];
        pushToast('Item removed from cart');
      } else {
        map[targetProductId] = {
          quantity: nextQuantity,
          title: product.title,
          price: product.price,
          image_url: product.image_urls?.[0] || product.image_url || null,
        };
        pushToast('Cart updated');
      }
      
      guestCartRef.current = map;
      writeGuestCart(map);
      
      setCartItems(
        Object.entries(map).map(([p_id, item]) => ({
          product_id: p_id,
          title: item.title,
          price: item.price,
          image_url: item.image_url,
          quantity: item.quantity,
        }))
      );
    },
    [session, pushToast]
  );


  const totalCount = cartItems.reduce((sum, i) => sum + i.quantity, 0);

  const value = {
    user,
    session,
    authReady,
    isLoggedIn: !!user,
    cartItems,
    cartLoading,
    totalCount,
    isCartOpen,
    openCart: () => setIsCartOpen(true),
    closeCart: () => setIsCartOpen(false),
    isAuthModalOpen,
    authModalTab,
    openAuthModal: (tab = 'login') => {
      setAuthModalTab(tab);
      setIsAuthModalOpen(true);
    },
    closeAuthModal: () => setIsAuthModalOpen(false),
    addToCart: (product, quantity = 1) => mutateCart(product, { quantity, action: 'add' }),
    setItemQuantity: (product, quantity) => mutateCart(product, { quantity, action: 'update' }),
    removeItem: (product) => mutateCart(product, { action: 'delete' }),
    handleAuthSuccess,
    logout,
    pushToast,
    toasts,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProviders');
  return ctx;
}
