"use client";

import { addToCart, EMPTY_CART, setLineQuantity, type Cart, type CartLine } from "@sarhad/core";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "sarhad.cart";

type CartContext = {
  cart: Cart;
  /** False until the saved cart has been read from this browser. */
  ready: boolean;
  add: (branchId: string, line: CartLine) => void;
  setQuantity: (key: string, quantity: number) => void;
  replace: (cart: Cart) => void;
  clear: () => void;
};

const Ctx = createContext<CartContext | null>(null);

function read(): Cart {
  try {
    const v = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null") as Cart | null;
    return v && Array.isArray(v.lines) ? v : EMPTY_CART;
  } catch {
    return EMPTY_CART;
  }
}

function write(cart: Cart) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
  } catch {
    // Storage blocked (private mode): the cart lasts for this page view only.
  }
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = useState<Cart>(EMPTY_CART);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Reading browser storage has to wait until after hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCart(read());
    setReady(true);
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setCart(read());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const update = useCallback((fn: (c: Cart) => Cart) => {
    setCart((c) => {
      const next = fn(c);
      write(next);
      return next;
    });
  }, []);

  const value = useMemo<CartContext>(
    () => ({
      cart,
      ready,
      add: (branchId, line) => update((c) => addToCart(c, branchId, line)),
      setQuantity: (key, q) => update((c) => setLineQuantity(c, key, q)),
      replace: (next) => update(() => next),
      clear: () => update(() => EMPTY_CART),
    }),
    [cart, ready, update],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCart(): CartContext {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useCart must be used inside CartProvider");
  return ctx;
}
