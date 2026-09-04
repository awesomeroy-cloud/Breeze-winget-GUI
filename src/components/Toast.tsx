import { Toast, ToastType } from "../types";
import { TOAST_ICONS } from "../constants/icons";

/**
 * Toast notification container component.
 * @module components/Toast
 */

export type { Toast, ToastType };

/**
 * Properties for ToastContainer.
 */
export interface ToastContainerProps {
  /** Array of currently active toast notifications */
  toasts: Toast[];
  /** Callback to dismiss a toast by its identifier */
  onRemove: (id: string) => void;
}

/**
 * Renders floating toast notifications in the corner of the screen.
 * Supports "success", "error", "info", and "warning" types.
 */
export default function ToastContainer({ toasts, onRemove }: ToastContainerProps) {
  if (!toasts || toasts.length === 0) return null;

  return (
    <div className="toast-container" role="region" aria-label="Notifications">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`toast ${t.type}`}
          onClick={() => onRemove(t.id)}
          role="alert"
        >
          <span className="toast-icon">{TOAST_ICONS[t.type] || "ℹ️"}</span>
          <span>{t.message}</span>
        </div>
      ))}
    </div>
  );
}
