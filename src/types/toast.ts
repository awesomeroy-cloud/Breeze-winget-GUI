/**
 * Toast notification data models.
 * @module types/toast
 */

/**
 * Supported notification severity levels.
 */
export type ToastType = "success" | "error" | "info" | "warning";

/**
 * Model representing an active toast notification.
 */
export interface Toast {
  /** Unique timestamp or identifier for the toast */
  id: string;
  /** Text content displayed in the notification */
  message: string;
  /** Severity level determining styling and icon */
  type: ToastType;
}
