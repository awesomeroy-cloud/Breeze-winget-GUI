import { useEffect, useState } from "react";
import { installWingetEnv } from "../api";

/**
 * Winget environment initialization and onboarding screen.
 * @module pages/InitPage
 */

/**
 * Properties for the InitPage component.
 */
export interface InitPageProps {
  /** Callback triggered when the winget environment has been successfully installed and verified */
  onReady: () => void;
}

/**
 * Onboarding screen shown when winget CLI is not detected on the Windows host.
 * Provides a one-click automated download and installation flow via PowerShell.
 */
export default function InitPage({ onReady }: InitPageProps) {
  const [installing, setInstalling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState("");

  useEffect(() => {
    if (typeof window === "undefined" || !(window as any).__TAURI_INTERNALS__) return;

    let unlisten: (() => void) | undefined;
    async function setupListener() {
      try {
        const { listen } = await import("@tauri-apps/api/event");
        unlisten = await listen<{ phase: string; progress: number; message: string }>(
          "env-install-progress",
          (event) => {
            setProgress(event.payload.progress);
            setStage(event.payload.message);
          }
        );
      } catch (err) {
        console.error("Failed to mount env-install-progress listener:", err);
      }
    }
    setupListener();
    return () => {
      if (unlisten) unlisten();
    };
  }, []);

  const handleInstall = async () => {
    setInstalling(true);
    setError(null);
    try {
      const result = await installWingetEnv();
      if (result.success) {
        onReady();
      } else {
        setError(result.message || "安装失败，请检查网络连接");
      }
    } catch (err: unknown) {
      setError(String(err) || "安装出错");
    } finally {
      setInstalling(false);
    }
  };

  return (
    <div
      className="init-page"
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100vh",
        textAlign: "center",
        padding: "20px",
      }}
    >
      <div style={{ fontSize: "64px", marginBottom: "16px" }}>🌬️</div>
      <h1
        style={{
          fontSize: "28px",
          fontWeight: 700,
          marginBottom: "12px",
          background: "linear-gradient(135deg, var(--accent), #a78bfa)",
          WebkitBackgroundClip: "text",
          backgroundClip: "text",
          WebkitTextFillColor: "transparent",
        }}
      >
        欢迎使用 Breeze
      </h1>
      <p
        style={{
          color: "var(--text-secondary)",
          maxWidth: "400px",
          lineHeight: 1.6,
          marginBottom: "32px",
        }}
      >
        检测到您的系统尚未安装 <strong>Windows 软件包管理器 (winget)</strong>，这是 Breeze 运行所必需的核心组件。
      </p>

      {error && (
        <div
          style={{
            backgroundColor: "var(--danger-subtle)",
            color: "var(--danger)",
            padding: "12px 16px",
            borderRadius: "var(--radius-md)",
            marginBottom: "24px",
            maxWidth: "400px",
            fontSize: "13px",
          }}
        >
          {error}
        </div>
      )}

      <button
        className="btn btn-primary"
        onClick={handleInstall}
        disabled={installing}
        style={{ padding: "12px 32px", fontSize: "16px", borderRadius: "100px" }}
        type="button"
      >
        {installing ? (
          <>
            <div className="spinner" style={{ marginRight: "8px" }} />
            正在下载并安装...这可能需要几分钟
          </>
        ) : (
          "一键安装并初始化环境"
        )}
      </button>

      {installing && (
        <div style={{ marginTop: 24, width: "min(400px, 90vw)" }}>
          <div
            style={{
              height: 8,
              borderRadius: 999,
              background: "var(--bg-muted, rgba(255,255,255,0.08))",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${Math.max(4, Math.min(100, progress))}%`,
                borderRadius: 999,
                background: "linear-gradient(90deg, var(--accent), #a78bfa, #22d3ee)",
                transition: "width 0.3s ease",
              }}
            />
          </div>
          <p style={{ marginTop: "12px", fontSize: "13px", color: "var(--text-tertiary)" }}>
            {stage || "正在从微软官方下载最新的安装包，请耐心等待..."}
            {progress > 0 ? ` (${Math.round(progress)}%)` : ""}
          </p>
        </div>
      )}
    </div>
  );
}
