'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../supabaseClient';
import { readGuestCart, writeGuestCart, clearGuestCart, guestCartTotalCount } from '../guestCart';

const AppContext = createContext(null);

let toastId = 0;

function mapAuthedRow(row) {
  const product = row.product || {};
  return {
    cart_item_id: row.id,
    product_id: product.id,
    title: product.title,
    price: Number(product.price || 0),
    quantity: row.quantity,
    image_url: Array.isArray(product.image_urls) ? product.image_urls[0] : null,
    stock_quantity: product.stock_quantity,
  };
}

function mapGuestMap(guestMap) {
  return Object.entries(guestMap || {}).map(([productId, item]) => ({
    cart_item_id: productId,
    product_id: productId,
    title: item.title,
    price: Number(item.price || 0),
    quantity: item.quantity,
    image_url: item.image_url || null,
    stock_quantity: item.stock_quantity,
  }));
}

export function AppProviders({ children }) {
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [sessionLoaded, setSessionLoaded] = useState(false);
  
  const [cartItems, setCartItems] = useState([]);
  const [cartLoading, setCartLoading] = useState(true);
  const [isCartOpen, setIsCartOpen] = useState(false);

  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalTab, setAuthModalTab] = useState('login');
  const [toasts, setToasts] = useState([]);
  
  const guestCartRef = useRef({});
  const isLoggedIn = !!session?.user && !!session?.access_token;

  // --- Toast System ---
  const pushToast = useCallback((message, type = 'success') => {
    const id = ++toastId;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3200);
  }, []);

  // --- Cart Sync Mechanics ---
  const refreshCart = useCallback(async () => {
    setCartLoading(true);
    try {
      if (isLoggedIn) {
        const { data, error } = await supabase
          .from('cart_items')
          .select('id, quantity, product:products(id, title, price, image_urls, stock_quantity)')
          .order('created_at', { ascending: true });
        if (error) throw error;
        setCartItems((data || []).map(mapAuthedRow));
      } else {
        const guestMap = readGuestCart();
        guestCartRef.current = guestMap;
        setCartItems(mapGuestMap(guestMap));
      }
    } catch (err) {
      console.error('Failed to load cart', err);
      pushToast('Could not load your cart right now.', 'error');
    } finally {
      setCartLoading(false);
    }
  }, [isLoggedIn, pushToast]);

  const mergeGuestCartIfAny = useCallback(async (accessToken) => {
    const guestMap = readGuestCart();
    const entries = Object.entries(guestMap);
    if (entries.length === 0) return;

    try {
      const res = await fetch('/api/v1/cart/merge', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          guest_cart: entries.map(([product_id, item]) => ({
            product_id,
            quantity: item.quantity,
          })),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed to merge cart');
      
      clearGuestCart();
      guestCartRef.current = {};
    } catch (err) {
      console.error(err);
      pushToast('Could not merge guest items, but they are safely kept.', 'warning');
    }
  }, [pushToast]);

  // --- Lifecycle Bootstrapping ---
  useEffect(() => {
    let isMounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!isMounted) return;
      const currentSession = data?.session || null;
      setSession(currentSession);
      setUser(currentSession?.user || null);
      setSessionLoaded(true);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (!isMounted) return;
      setSession(newSession);
      setUser(newSession?.user || null);
    });

    return () => {
      isMounted = false;
      if (sub?.subscription) sub.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!sessionLoaded) return;
    refreshCart();
  }, [sessionLoaded, isLoggedIn, refreshCart]);

  const getAccessToken = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token || null;
  }, []);

  // --- Cart Management Mutators ---
  const addToCart = useCallback(async (product, quantity = 1) => {
    const productId = product.id || product.product_id;
    
    if (session?.access_token) {
      try {
        const res = await fetch('/api/v1/cart/items', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ product_id: productId, quantity }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error || 'Could not add item');

        await refreshCart();
        setIsCartOpen(true);
        pushToast('Item added to cart!');
        return { ok: true };
      } catch (err) {
        console.error(err);
        pushToast(err.message, 'error');
        return { ok: false, error: err.message };
      }
    }

    const guestMap = readGuestCart();
    const existingItem = guestMap[productId];

    guestMap[productId] = {
      title: product.title,
      price: product.price,
      quantity: existingItem ? existingItem.quantity + quantity : quantity,
      image_url: Array.isArray(product.image_urls) ? product.image_urls[0] : (product.image_url || null),
      stock_quantity: product.stock_quantity,
    };

    writeGuestCart(guestMap);
    guestCartRef.current = guestMap;
    setCartItems(mapGuestMap(guestMap));
    setIsCartOpen(true);
    pushToast('Item added to guest cart!');
    return { ok: true };
  }, [session, refreshCart, pushToast]);

  const setItemQuantity = useCallback(async (item, quantity) => {
    if (quantity < 1) return { ok: false };

    if (!isLoggedIn) {
      const guestMap = readGuestCart();
      if (guestMap[item.product_id]) {
        guestMap[item.product_id] = { ...guestMap[item.product_id], quantity };
        writeGuestCart(guestMap);
        guestCartRef.current = guestMap;
        setCartItems(mapGuestMap(guestMap));
        pushToast('Quantity updated');
      }
      return { ok: true };
    }

    setCartItems((prev) =>
      prev.map((i) => (i.cart_item_id === item.cart_item_id ? { ...i, quantity } : i))
    );

    try {
      const token = await getAccessToken();
      const res = await fetch('/api/v1/cart/items', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ cart_item_id: item.cart_item_id, quantity }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error || 'Could not update quantity');
      
      pushToast('Quantity updated');
      return { ok: true, totals: body };
    } catch (err) {
      await refreshCart();
      pushToast(err.message, 'error');
      return { ok: false, error: err.message };
    }
  }, [isLoggedIn, getAccessToken, refreshCart, pushToast]);

  const removeItem = useCallback(async (item) => {
    if (!isLoggedIn) {
      const guestMap = readGuestCart();
      delete guestMap[item.product_id];
      writeGuestCart(guestMap);
      guestCartRef.current = guestMap;
      setCartItems(mapGuestMap(guestMap));
      pushToast('Item removed from cart');
      return { ok: true };
    }

    setCartItems((prev) => prev.filter((i) => i.cart_item_id !== item.cart_item_id));

    try {
      const token = await getAccessToken();
      const res = await fetch('/api/v1/cart/items', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ cart_item_id: item.cart_item_id }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error || 'Could not remove item');
      
      pushToast('Item removed from cart');
      return { ok: true, totals: body };
    } catch (err) {
      await refreshCart();
      pushToast(err.message, 'error');
      return { ok: false, error: err.message };
    }
  }, [isLoggedIn, getAccessToken, refreshCart, pushToast]);

  // --- Auth Handlers ---
  const openAuthModal = useCallback((initialTab = 'login') => {
    setAuthModalTab(initialTab);
    setIsAuthModalOpen(true);
  }, []);

  const closeAuthModal = useCallback(() => {
    setIsAuthModalOpen(false);
  }, []);

  const handleAuthSuccess = useCallback(async ({ session: newSession }, { welcomeMessage } = {}) => {
    if (!newSession) {
      pushToast(welcomeMessage || 'Check your email to confirm your account.', 'success');
      setIsAuthModalOpen(false);
      return;
    }
    
    await supabase.auth.setSession({
      access_token: newSession.access_token,
      refresh_token: newSession.refresh_token,
    });
    
    setSession(newSession);
    setUser(newSession.user);
    
    await mergeGuestCartIfAny(newSession.access_token);
    await refreshCart();
    
    setIsAuthModalOpen(false);
    pushToast(welcomeMessage || 'Logged in successfully!');
  }, [mergeGuestCartIfAny, refreshCart, pushToast]);

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    clearGuestCart();
    guestCartRef.current = {};
    setCartItems([]);
    setUser(null);
    setSession(null);
    pushToast('Logged out successfully.');
  }, [pushToast]);

  const cartCount = useMemo(
  () => cartItems.reduce((sum, i) => sum + i.quantity, 0),
  [cartItems]
  );

  const value = useMemo(
    () => ({
          session,
          user,
          isLoggedIn,
          sessionLoaded,
          cartItems,
          cartLoading,
          cartCount,
          totalCount: cartCount,
          isCartOpen,
          openCart: () => setIsCartOpen(true),
          closeCart: () => setIsCartOpen(false),
          isAuthModalOpen,
          authModalTab,
          openAuthModal,
          closeAuthModal,
          logout,
          handleAuthSuccess,
          addToCart,
          setItemQuantity,
          removeItem,
          refreshCart,
          getAccessToken,
          toasts,
          pushToast,
        }),
        [
        session,
        user,
        isLoggedIn,
        sessionLoaded,
        cartItems,
        cartLoading,
        cartCount,
        isCartOpen,
        isAuthModalOpen,
        authModalTab,
        openAuthModal,
        closeAuthModal,
        logout,
        handleAuthSuccess,
        addToCart,
        setItemQuantity,
        removeItem,
        refreshCart,
        getAccessToken,
        toasts,
        pushToast,
      ]
  );
return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
export function useApp() {
const ctx = useContext(AppContext);
if (!ctx) throw new Error('useApp must be used within AppProviders');
return ctx;
}