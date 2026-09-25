'use client';

//import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../supabaseClient';
//import { readGuestCart, writeGuestCart, clearGuestCart, guestCartTotalCount } from '../guestCart';
import { readGuestCart, writeGuestCart, clearGuestCart} from '../guestCart';


const AppContext = createContext(null);

let toastId = 0;

// Added new function as is
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
// Added new function as is
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
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  
  //added new line to track if the session has been loaded
  const [sessionLoaded, setSessionLoaded] = useState(false);
  

  const [cartItems, setCartItems] = useState([]); // [{product_id, title, price, image_url, quantity}]
 
/* Conflict here choose one */
  const [cartLoading, setCartLoading] = useState(false);  // original
  //const [cartLoading, setCartLoading] = useState(true);  // new
// end of conflict code

  const [isCartOpen, setIsCartOpen] = useState(false);


  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalTab, setAuthModalTab] = useState('login');

  const [toasts, setToasts] = useState([]);
  const guestCartRef = useRef({});

// New line added to determine if the user is logged in based on the session and access token
  const isLoggedIn = !!session?.user && !!session?.access_token;


  const pushToast = useCallback((message, type = 'success') => {
    const id = ++toastId;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3200);
  }, []);

  // Original Code not removed, but added new code to fetch the cart from the server if the user is logged in
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
  // end of fetchServerCart function not removed from original code


// Original Code not removed, 
// but added new code to load the guest cart into state if the user is not logged in
//merged the login into refreshCart function below. So loadGuestCartIntoState is not needed. 
// Uncomment if needed
 /* const loadGuestCartIntoState = useCallback(() => {
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
  // end of loadGuestCartIntoState function not removed from original code
*/

  /* New code added not in original - looks like never used so kept commented out */
 // --- Cart Sync Mechanics ---
 
  const refreshCart = useCallback(async () => {
    if (!authReady) return;
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
        //const guestMap = readGuestCart();
        //guestCartRef.current = guestMap;
        //setCartItems(mapGuestMap(guestMap));
        
        const map = readGuestCart();
        guestCartRef.current = map;
        setCartItems(
          Object.entries(map).map(([product_id, item]) => ({
          product_id,
          title: item.title,
          price: item.price,
          image_url: item.image_url,
          quantity: item.quantity,
        })))
      }
    } catch (err) {
      console.error('Failed to load cart', err);
      pushToast('Could not load your cart right now.', 'error');
    } finally {
      setCartLoading(false);
    }
  }, [isLoggedIn, session, authReady, pushToast ]); // added dependency of session here
  //[isLoggedIn,session?.access_token, pushToast ]
  // end of commented out refreshCart function not removed from original code
  /* end of new code added for refreshCart function */

  /* Original same as new - no change in the function mergeGuestCartIfAny */
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
// end of mergeGuestCartIfAny function not removed from original code

  // Bootstrap: check for an existing Supabase session, else fall back to
  // the guest (sessionStorage) cart.
  useEffect(() => {
    let isMounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!isMounted) return;
      const currentSession = data?.session || null;
      setSession(currentSession);
      setUser(currentSession?.user || null);
      
      // original line
      setAuthReady(true);
      // new line added to indicate that the session has been loaded
      setSessionLoaded(true);

      // Original code not in the new version - 
      // condition is being checked inside refreshCart function now. So commented out below
      /*
      if (currentSession) {
        fetchServerCart(currentSession.access_token);
      } else {
          //loadGuestCartIntoState();
      }*/
     refreshCart(); // new line added to load the cart items based on the session state
    });

   

    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      // new line in code left commented - uncomment if needed. As per earlier code return happens above
      // if (!isMounted) return;

      setSession(newSession);
      setUser(newSession?.user || null);
      // added refreshcart to load the cart items based on the session state
      refreshCart();

    });
    
    return () => {
      isMounted = false;
      sub?.subscription?.unsubscribe();
    };
   
  }, []);

  /* new code below - left commented out. 
  mutateCart function is already defined below. which handles both addToCart and setItemQuantity. 
  So this function is not needed. Uncomment if needed*/
  /* -- start of addToCart
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
  -- end of addToCart Function*/

/* setItemQuantity function is done by mutateCart function below. So this function is not needed.
 Uncomment if needed*/
 /* 
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

  -- End of setItemQuantity Function*/

/* removeItem function is done by mutateCart function below. So this function is not needed.
Uncomment if needed*/
/* -- Start of removeItem Function
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
  -- end of removeItem Function*/

  /* New functions from code not in original - added */
  const openAuthModal = useCallback((initialTab = 'login') => {
    setAuthModalTab(initialTab);
    setIsAuthModalOpen(true);
  }, []);

  const closeAuthModal = useCallback(() => {
    setIsAuthModalOpen(false);
  }, []);
/* end of new functions added */


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
      // original code fetches cart from server after login, 
      // but we can also use refreshCart to get the latest cart state - 
      // - staying with original code of fetchServerCart for now
      await fetchServerCart(newSession.access_token);
      //await refreshCart();

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
    // new line added below for toast message on logout
    pushToast('Logged out successfully.');
  }, []);

  // action: 'add' | 'update' | 'delete'
  
  // action: 'add' | 'update' | 'delete'
  // MutuateCart function handles both addToCart and setItemQuantity and removeItem
  // addToCart - called from ProductCard - whenever a new product is added to the cart.
  // setItemQuantity - called from CartDrawer.jsx and GuestCart.js - whenever + or - buttons are clicked to change the quantity of an item in the cart.
  // if - button makes it less than 0 then removeItem is called from CartDrawer.jsx and GuestCart.js
  // removeItem - called from CartDrawer.jsx and GuestCart.js
  // either the customer clicks on Remove to remove product from the cart or
  // original qty was 1 and the customer clicks on - button to reduce the quantity to 0, then removeItem is called.

  const mutateCart = useCallback(
    async (product, { quantity, action }) => {
      // 1. AUTHENTICATED USER PATH (Database Call)
      const targetProductId = product.id || product.product_id;
      //if (session?.access_token) { // - original code commented 
      if (isLoggedIn) {
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
    [session,isLoggedIn, pushToast] // added isLoggedIn to the dependency array to ensure that the function updates when the login state changes
    
  );
// end of mutateCart function

// Calculate total count of items in the cart
  const totalCount = cartItems.reduce((sum, i) => sum + i.quantity, 0);

  // Retaining original code below 
  // added usage of useMemo to optimize the value object so that it only changes when its dependencies change

  const value = useMemo(
  () => ({
    session,
    user,
    isLoggedIn,
    sessionLoaded,
    authReady,
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
    refreshCart,
  }),
  [
    session,
    user,
    isLoggedIn,
    sessionLoaded,
    authReady,
    cartItems,
    cartLoading,
    totalCount,
    isCartOpen,
    isAuthModalOpen,
    authModalTab,
    mutateCart,
    handleAuthSuccess,
    logout,
    pushToast,
    toasts,
    refreshCart,
  ]
);


  /* new code below is kept commented out as it is being done by original code */
  /*
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
  ); */
  /* end of new code commented out */

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
/* end of function AppProviders */
export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProviders');
  return ctx;
}
