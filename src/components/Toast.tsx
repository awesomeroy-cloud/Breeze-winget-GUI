export interface Toast {
  id: string;
  message: string;
  type: "success" | "error" | "info" | "warning";
}

interface Props {
  toasts: Toast[];
  onRemove: (id: string) => void;
}

const icons: Record<string, string> = {
  success: "✅",
  error: "❌",
  info: "ℹ️",
};

export default function ToastContainer({ toasts, onRemove }: Props) {
  if (toasts.length === 0) return null;

  return (
    <div className="toast-container">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`toast ${t.type}`}
          onClick={() => onRemove(t.id)}
        >
          <span className="toast-icon">{icons[t.type]}</span>
          <span>{t.message}</span>
        </div>
      ))}
    </div>
  );
}
