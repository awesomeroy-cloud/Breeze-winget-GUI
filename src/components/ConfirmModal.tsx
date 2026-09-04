import React from "react";

/**
 * Reusable confirmation dialog modal component.
 * @module components/ConfirmModal
 */

/**
 * Properties for the ConfirmModal component.
 */
export interface ConfirmModalProps {
  /** Controls modal visibility */
  isOpen: boolean;
  /** Modal header title text */
  title: string;
  /** Main confirmation message or node */
  message: React.ReactNode;
  /** Text for the confirmation action button (defaults to "确定") */
  confirmText?: string;
  /** Text for the cancellation action button (defaults to "取消") */
  cancelText?: string;
  /** Visual style variant for the confirmation button (defaults to "danger") */
  confirmVariant?: "danger" | "primary";
  /** Whether the confirmation button is disabled (e.g. during an ongoing operation) */
  confirmDisabled?: boolean;
  /** Callback triggered when the user confirms the action */
  onConfirm: () => void;
  /** Callback triggered when the user dismisses or cancels the modal */
  onCancel: () => void;
}

/**
 * Modal dialog for critical or destructive user actions requiring confirmation.
 * Follows Breeze design system conventions with backdrop dismissal.
 */
export default function ConfirmModal({
  isOpen,
  title,
  message,
  confirmText = "确定",
  cancelText = "取消",
  confirmVariant = "danger",
  confirmDisabled = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  if (!isOpen) return null;

  const confirmBtnClass = confirmVariant === "danger" ? "btn btn-danger-solid" : "btn btn-primary";

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="confirm-modal" onClick={(e) => e.stopPropagation()}>
        <h3>{title}</h3>
        <div style={{ color: "var(--text-secondary)", fontSize: "14px", lineHeight: 1.5, margin: "12px 0 20px" }}>
          {message}
        </div>
        <div className="confirm-modal-actions">
          <button className="btn btn-secondary" onClick={onCancel} type="button">
            {cancelText}
          </button>
          <button
            className={confirmBtnClass}
            onClick={onConfirm}
            disabled={confirmDisabled}
            type="button"
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
