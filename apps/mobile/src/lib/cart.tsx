import AsyncStorage from "@react-native-async-storage/async-storage";
import { addToCart, EMPTY_CART, setLineQuantity, type Cart, type CartLine } from "@sarhad/core";
import {
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

const STORAGE_KEY = "sarhad.cart";

type CartState = {
  cart: Cart;
  ready: boolean;
  add: (branchId: string, line: CartLine) => void;
  setQuantity: (key: string, quantity: number) => void;
  replace: (cart: Cart) => void;
  clear: () => void;
};

const CartContext = createContext<CartState | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<Cart>(EMPTY_CART);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        const saved = raw ? (JSON.parse(raw) as Cart) : null;
        if (saved && Array.isArray(saved.lines)) setCart(saved);
      })
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);

  const update = useCallback((fn: (c: Cart) => Cart) => {
    setCart((c) => {
      const next = fn(c);
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const value = useMemo<CartState>(
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

  return <CartContext value={value}>{children}</CartContext>;
}

export function useCart(): CartState {
  const ctx = use(CartContext);
  if (!ctx) throw new Error("useCart must be used inside <CartProvider>");
  return ctx;
}
