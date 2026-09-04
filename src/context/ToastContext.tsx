import React, { createContext, useContext, useState, useCallback, useMemo } from "react";
import { Toast, ToastType } from "../types";
import ToastContainer from "../components/Toast";

/**
 * Toast notification context and provider.
 * @module context/ToastContext
 */

/**
 * Interface representing the values and actions provided by ToastContext.
 */
export interface ToastContextValue {
  /** Current list of active toast notifications */
  toasts: Toast[];
  /** Dispatches a new notification with automatic 4-second timeout dismissal */
  addToast: (message: string, type?: ToastType) => void;
  /** Manually dismisses an active notification by identifier */
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

/**
 * Props for ToastProvider.
 */
export interface ToastProviderProps {
  /** React child tree */
  children: React.ReactNode;
}

/**
 * Provides global toast notification management and renders the toast container.
 */
export function ToastProvider({ children }: ToastProviderProps) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback((message: string, type: ToastType = "info") => {
    const id = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    setToasts((prev) => [...prev, { id, message, type }]);

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const value = useMemo<ToastContextValue>(
    () => ({
      toasts,
      addToast,
      removeToast,
    }),
    [toasts, addToast, removeToast]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  );
}

/**
 * Custom hook to consume the global Toast notification context.
 *
 * @throws {Error} If called outside of a `<ToastProvider>` tree.
 * @returns {ToastContextValue} Active toasts and `addToast` / `removeToast` functions.
 *
 * @example
 * ```tsx
 * const { addToast } = useToast();
 * addToast("Operation completed successfully", "success");
 * ```
 */
export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}
