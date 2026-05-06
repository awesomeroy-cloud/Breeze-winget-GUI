import { useState } from "react";
import { installWingetEnv } from "../api";

export default function InitPage({ onReady }: { onReady: () => void }) {
  const [installing, setInstalling] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    } catch (err: any) {
      setError(err?.toString() || "安装出错");
    } finally {
      setInstalling(false);
    }
  };

  return (
    <div className="init-page" style={{ 
      display: "flex", 
      flexDirection: "column", 
      alignItems: "center", 
      justifyContent: "center", 
      height: "100vh", 
      textAlign: "center",
      padding: "20px"
    }}>
      <div style={{ fontSize: "64px", marginBottom: "16px" }}>🌬️</div>
      <h1 style={{ fontSize: "28px", fontWeight: 700, marginBottom: "12px", background: "linear-gradient(135deg, var(--accent), #a78bfa)", WebkitBackgroundClip: "text", backgroundClip: "text", WebkitTextFillColor: "transparent" }}>
        欢迎使用 Breeze
      </h1>
      <p style={{ color: "var(--text-secondary)", maxWidth: "400px", lineHeight: 1.6, marginBottom: "32px" }}>
        检测到您的系统尚未安装 <strong>Windows 软件包管理器 (winget)</strong>，这是 Breeze 运行所必需的核心组件。
      </p>

      {error && (
        <div style={{ backgroundColor: "var(--danger-subtle)", color: "var(--danger)", padding: "12px 16px", borderRadius: "var(--radius-md)", marginBottom: "24px", maxWidth: "400px", fontSize: "13px" }}>
          {error}
        </div>
      )}

      <button 
        className="btn btn-primary" 
        onClick={handleInstall} 
        disabled={installing}
        style={{ padding: "12px 32px", fontSize: "16px", borderRadius: "100px" }}
      >
        {installing ? (
          <>
            <div className="spinner" style={{ marginRight: "8px" }}></div>
            正在下载并安装...这可能需要几分钟
          </>
        ) : (
          "一键安装并初始化环境"
        )}
      </button>

      {installing && (
        <p style={{ marginTop: "16px", fontSize: "13px", color: "var(--text-tertiary)" }}>
          正在从微软官方下载最新的安装包，请耐心等待...
        </p>
      )}
    </div>
  );
}
