import { useState, useEffect } from "react";
import { Package, PackageDetail, showPackage, installPackage, uninstallPackage, upgradePackage, getPackageVersions } from "../api";
import RainbowProgressBar from "./RainbowProgressBar";

import { GlobalState } from "../App";

interface Props {
  pkg: Package;
  onClose: () => void;
  addToast: (msg: string, type: "success" | "error" | "info") => void;
  onOperationComplete?: () => void;
  mode?: "search" | "installed" | "update";
  globalState?: GlobalState;
}

export default function DetailPanel({ pkg, onClose, addToast, onOperationComplete, mode = "installed", globalState }: Props) {
  const [detail, setDetail] = useState<PackageDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [operating, setOperating] = useState(false);
  const [operationStatus, setOperationStatus] = useState<string>("");
  const [operationOutput, setOperationOutput] = useState<string | null>(null);
  const [availableVersions, setAvailableVersions] = useState<string[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<string>("");

  useEffect(() => {
    setLoading(true);
    showPackage(pkg.id)
      .then(setDetail)
      .catch(() => {
        // Fallback: use info we already have
        setDetail({
          name: pkg.name,
          id: pkg.id,
          version: pkg.version,
          publisher: "",
          description: "",
          homepage: "",
          license: "",
        });
      })
      .finally(() => setLoading(false));

    if (mode === "search") {
      getPackageVersions(pkg.id)
        .then(versions => {
          setAvailableVersions(versions);
          if (versions.length > 0) {
            setSelectedVersion(versions[0]);
          }
        })
        .catch(console.error);
    }
  }, [pkg.id, mode]);

  const handleInstall = async () => {
    if (operating) return;
    setOperating(true);
    setOperationStatus("正在安装...");
    globalState?.addOperation(pkg.id);
    try {
      const result = await installPackage(pkg.id, selectedVersion || undefined);
      if (result.success) {
        addToast(`${pkg.name} 安装成功`, "success");
        setOperationStatus("安装成功 ✓");
        setOperationOutput(null);
      } else {
        addToast(`${pkg.name} 安装失败`, "error");
        setOperationStatus("安装失败");
        setOperationOutput(result.output || result.message);
      }
      onOperationComplete?.();
      globalState?.refreshInstalled();
    } catch (err) {
      addToast(`安装出错: ${err}`, "error");
      setOperationStatus("安装出错");
    } finally {
      setOperating(false);
      globalState?.removeOperation(pkg.id);
    }
  };

  const handleUninstall = async () => {
    if (operating) return;
    setOperating(true);
    setOperationStatus("正在卸载...");
    globalState?.addOperation(pkg.id);
    try {
      const result = await uninstallPackage(pkg.id);
      if (result.success) {
        addToast(`${pkg.name} 已卸载`, "success");
        setOperationStatus("已卸载 ✓");
        setOperationOutput(null);
      } else {
        addToast(`${pkg.name} 卸载失败`, "error");
        setOperationStatus("卸载失败");
        setOperationOutput(result.output || result.message);
      }
      onOperationComplete?.();
      globalState?.refreshInstalled();
    } catch (err) {
      addToast(`卸载出错: ${err}`, "error");
      setOperationStatus("卸载出错");
    } finally {
      setOperating(false);
      globalState?.removeOperation(pkg.id);
    }
  };

  const handleUpgrade = async () => {
    if (operating) return;
    setOperating(true);
    setOperationStatus("正在更新...");
    globalState?.addOperation(pkg.id);
    try {
      const result = await upgradePackage(pkg.id);
      if (result.success) {
        addToast(`${pkg.name} 更新成功`, "success");
        setOperationStatus("更新成功 ✓");
        setOperationOutput(null);
      } else {
        addToast(`${pkg.name} 更新失败`, "error");
        setOperationStatus("更新失败");
        setOperationOutput(result.output || result.message);
      }
      onOperationComplete?.();
      globalState?.refreshInstalled();
    } catch (err) {
      addToast(`更新出错: ${err}`, "error");
      setOperationStatus("更新出错");
    } finally {
      setOperating(false);
      globalState?.removeOperation(pkg.id);
    }
  };

  return (
    <div className="detail-overlay" onClick={onClose}>
      <div className="detail-panel" onClick={(e) => e.stopPropagation()}>
        <div className="detail-header">
          <div className="detail-icon">📦</div>
          <div>
            <div className="detail-title">{pkg.name}</div>
            <div className="detail-id">{pkg.id}</div>
          </div>
          <button className="detail-close" onClick={onClose}>✕</button>
        </div>

        {loading ? (
          <div className="loading-container">
            <div className="spinner" />
            <span className="loading-text">加载详情...</span>
          </div>
        ) : detail && (
          <>
            {detail.description && (
              <div className="detail-section">
                <h3>描述</h3>
                <p>{detail.description}</p>
              </div>
            )}

            <div className="detail-section">
              <h3>信息</h3>
              <div className="detail-row">
                <span className="detail-row-label">版本</span>
                <span className="detail-row-value">{detail.version || pkg.version}</span>
              </div>
              {pkg.available && (
                <div className="detail-row">
                  <span className="detail-row-label">可用更新</span>
                  <span className="detail-row-value" style={{ color: "var(--success)" }}>{pkg.available}</span>
                </div>
              )}
              {detail.publisher && (
                <div className="detail-row">
                  <span className="detail-row-label">发布者</span>
                  <span className="detail-row-value">{detail.publisher}</span>
                </div>
              )}
              {detail.license && (
                <div className="detail-row">
                  <span className="detail-row-label">许可证</span>
                  <span className="detail-row-value">{detail.license}</span>
                </div>
              )}
              {detail.homepage && (
                <div className="detail-row">
                  <span className="detail-row-label">主页</span>
                  <span className="detail-row-value" style={{ fontSize: 12 }}>{detail.homepage}</span>
                </div>
              )}
            </div>

            {operationStatus && (
              <div className={`operation-status ${operating ? "running" : operationStatus.includes("✓") ? "success" : "error"}`} style={{ position: "relative", overflow: "hidden" }}>
                <RainbowProgressBar active={operating} progress={globalState?.progresses[pkg.id] || 0} />
                {operating && <div className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />}
                <span>{operationStatus}</span>
              </div>
            )}
            {operationOutput && (
              <div style={{ position: "relative", marginTop: "8px" }}>
                <div style={{ padding: "8px", background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", fontSize: "11px", color: "var(--text-tertiary)", maxHeight: "100px", overflowY: "auto", fontFamily: "monospace", whiteSpace: "pre-wrap", paddingRight: "32px" }}>
                  {operationOutput}
                </div>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(operationOutput);
                    addToast("错误日志已复制到剪贴板", "success");
                  }}
                  title="复制错误日志"
                  style={{
                    position: "absolute",
                    top: "4px",
                    right: "4px",
                    background: "var(--bg-card)",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius-sm)",
                    cursor: "pointer",
                    padding: "4px 6px",
                    fontSize: "12px",
                    color: "var(--text-secondary)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    transition: "all var(--transition-fast)"
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = "var(--bg-card-hover)"}
                  onMouseLeave={(e) => e.currentTarget.style.background = "var(--bg-card)"}
                >
                  📋
                </button>
              </div>
            )}

            <div className="detail-actions">
              {mode === "search" && (
                <>
                  {availableVersions.length > 0 && (
                    <select 
                      className="version-select" 
                      value={selectedVersion} 
                      onChange={e => setSelectedVersion(e.target.value)}
                      disabled={operating}
                    >
                      {availableVersions.map(v => (
                        <option key={v} value={v}>v{v}</option>
                      ))}
                    </select>
                  )}
                  <button 
                    className={`btn ${globalState?.installedPackages.some(p => p.id === pkg.id) ? "btn-secondary" : "btn-primary"}`} 
                    onClick={handleInstall} 
                    disabled={operating || globalState?.installedPackages.some(p => p.id === pkg.id)}
                  >
                    {operating ? "安装中..." : globalState?.installedPackages.some(p => p.id === pkg.id) ? "已安装" : "安装"}
                  </button>
                </>
              )}
              {mode === "installed" && (
                <>
                  {pkg.available && (
                    <button className="btn btn-primary" onClick={handleUpgrade} disabled={operating}>
                      {operating ? "更新中..." : "更新"}
                    </button>
                  )}
                  <button className="btn btn-danger" onClick={handleUninstall} disabled={operating}>
                    {operating ? "卸载中..." : "卸载"}
                  </button>
                </>
              )}
              {mode === "update" && (
                <button className="btn btn-primary" onClick={handleUpgrade} disabled={operating}>
                  {operating ? "更新中..." : `更新到 ${pkg.available}`}
                </button>
              )}
              <button className="btn btn-secondary" onClick={onClose}>关闭</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
