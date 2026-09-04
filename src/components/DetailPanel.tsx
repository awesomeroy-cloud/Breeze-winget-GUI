import { useState, useEffect } from "react";
import {
  Package,
  PackageDetail,
  showPackage,
  installPackage,
  uninstallPackage,
  upgradePackage,
  getPackageVersions,
} from "../api";
import RainbowProgressBar from "./RainbowProgressBar";
import { getPackageIcon } from "../utils/icon";
import { copyToClipboard } from "../utils/clipboard";
import { useToast, useOperations, usePackages } from "../context";

/**
 * Detailed package inspector and action drawer modal.
 * @module components/DetailPanel
 */

/**
 * Supported display modes for DetailPanel contextual actions.
 */
export type DetailPanelMode = "discover" | "installed" | "updates" | "search" | "update";

/**
 * Properties for DetailPanel.
 */
export interface DetailPanelProps {
  /** The software package currently being inspected */
  pkg: Package;
  /** Callback to close and dismiss the detail panel overlay */
  onClose: () => void;
  /** View context determining available action buttons (defaults to "installed") */
  mode?: DetailPanelMode;
  /** Optional callback invoked after install/uninstall/upgrade completes */
  onOperationComplete?: () => void;
}

/**
 * Slide-over drawer presenting detailed package metadata, historical versions,
 * real-time execution progress, output logs, and management actions.
 */
export default function DetailPanel({
  pkg,
  onClose,
  mode = "installed",
  onOperationComplete,
}: DetailPanelProps) {
  const { addToast } = useToast();
  const { addOperation, removeOperation, progresses } = useOperations();
  const { installedPackages, refreshInstalled } = usePackages();

  const [detail, setDetail] = useState<PackageDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [operating, setOperating] = useState(false);
  const [operationStatus, setOperationStatus] = useState<string>("");
  const [operationOutput, setOperationOutput] = useState<string | null>(null);
  const [availableVersions, setAvailableVersions] = useState<string[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<string>("");

  const isSearchMode = mode === "search" || mode === "discover";
  const isInstalledMode = mode === "installed";
  const isUpdateMode = mode === "update" || mode === "updates";

  const isInstalled = installedPackages.some((p) => p.id === pkg.id);
  const currentProgress = progresses[pkg.id] || 0;

  useEffect(() => {
    setLoading(true);
    showPackage(pkg.id)
      .then(setDetail)
      .catch(() => {
        // Fallback: use basic package info already available
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

    if (isSearchMode) {
      getPackageVersions(pkg.id)
        .then((versions) => {
          setAvailableVersions(versions);
          if (versions.length > 0) {
            setSelectedVersion(versions[0]);
          }
        })
        .catch(console.error);
    }
  }, [pkg.id, isSearchMode]);

  const handleInstall = async () => {
    if (operating) return;
    setOperating(true);
    setOperationStatus("正在安装...");
    addOperation(pkg.id);

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
      await refreshInstalled();
    } catch (err) {
      addToast(`安装出错: ${err}`, "error");
      setOperationStatus("安装出错");
    } finally {
      setOperating(false);
      removeOperation(pkg.id);
    }
  };

  const handleUninstall = async () => {
    if (operating) return;
    setOperating(true);
    setOperationStatus("正在卸载...");
    addOperation(pkg.id);

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
      await refreshInstalled();
    } catch (err) {
      addToast(`卸载出错: ${err}`, "error");
      setOperationStatus("卸载出错");
    } finally {
      setOperating(false);
      removeOperation(pkg.id);
    }
  };

  const handleUpgrade = async () => {
    if (operating) return;
    setOperating(true);
    setOperationStatus("正在更新...");
    addOperation(pkg.id);

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
      await refreshInstalled();
    } catch (err) {
      addToast(`更新出错: ${err}`, "error");
      setOperationStatus("更新出错");
    } finally {
      setOperating(false);
      removeOperation(pkg.id);
    }
  };

  const handleCopyLog = async () => {
    if (!operationOutput) return;
    const ok = await copyToClipboard(operationOutput);
    if (ok) {
      addToast("错误日志已复制到剪贴板", "success");
    } else {
      addToast("复制日志失败", "error");
    }
  };

  return (
    <div className="detail-overlay" onClick={onClose}>
      <div className="detail-panel" onClick={(e) => e.stopPropagation()}>
        <div className="detail-header">
          <div className="detail-icon">{getPackageIcon(pkg.name, pkg.id)}</div>
          <div>
            <div className="detail-title">{pkg.name}</div>
            <div className="detail-id">{pkg.id}</div>
          </div>
          <button className="detail-close" onClick={onClose} type="button">
            ✕
          </button>
        </div>

        {loading ? (
          <div className="loading-container">
            <div className="spinner" />
            <span className="loading-text">加载详情...</span>
          </div>
        ) : (
          detail && (
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
                    <span className="detail-row-value" style={{ color: "var(--success)" }}>
                      {pkg.available}
                    </span>
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
                    <span className="detail-row-value" style={{ fontSize: 12 }}>
                      {detail.homepage}
                    </span>
                  </div>
                )}
              </div>

              {operationStatus && (
                <div
                  className={`operation-status ${
                    operating ? "running" : operationStatus.includes("✓") ? "success" : "error"
                  }`}
                  style={{ position: "relative", overflow: "hidden" }}
                >
                  <RainbowProgressBar active={operating} progress={currentProgress} />
                  {operating && (
                    <div className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />
                  )}
                  <span>{operationStatus}</span>
                </div>
              )}

              {operationOutput && (
                <div style={{ position: "relative", marginTop: "8px" }}>
                  <div
                    style={{
                      padding: "8px",
                      background: "var(--bg-elevated)",
                      border: "1px solid var(--border)",
                      borderRadius: "var(--radius-md)",
                      fontSize: "11px",
                      color: "var(--text-tertiary)",
                      maxHeight: "100px",
                      overflowY: "auto",
                      fontFamily: "monospace",
                      whiteSpace: "pre-wrap",
                      paddingRight: "32px",
                    }}
                  >
                    {operationOutput}
                  </div>
                  <button
                    onClick={handleCopyLog}
                    title="复制错误日志"
                    type="button"
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
                      transition: "all var(--transition-fast)",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-card-hover)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "var(--bg-card)")}
                  >
                    📋
                  </button>
                </div>
              )}

              <div className="detail-actions">
                {isSearchMode && (
                  <>
                    {availableVersions.length > 0 && (
                      <select
                        className="version-select"
                        value={selectedVersion}
                        onChange={(e) => setSelectedVersion(e.target.value)}
                        disabled={operating}
                      >
                        {availableVersions.map((v) => (
                          <option key={v} value={v}>
                            v{v}
                          </option>
                        ))}
                      </select>
                    )}
                    <button
                      className={`btn ${isInstalled ? "btn-secondary" : "btn-primary"}`}
                      onClick={handleInstall}
                      disabled={operating || isInstalled}
                      type="button"
                    >
                      {operating ? "安装中..." : isInstalled ? "已安装" : "安装"}
                    </button>
                  </>
                )}

                {isInstalledMode && (
                  <>
                    {pkg.available && (
                      <button
                        className="btn btn-primary"
                        onClick={handleUpgrade}
                        disabled={operating}
                        type="button"
                      >
                        {operating ? "更新中..." : "更新"}
                      </button>
                    )}
                    <button
                      className="btn btn-danger"
                      onClick={handleUninstall}
                      disabled={operating}
                      type="button"
                    >
                      {operating ? "卸载中..." : "卸载"}
                    </button>
                  </>
                )}

                {isUpdateMode && (
                  <button
                    className="btn btn-primary"
                    onClick={handleUpgrade}
                    disabled={operating}
                    type="button"
                  >
                    {operating ? "更新中..." : `更新到 ${pkg.available}`}
                  </button>
                )}

                <button className="btn btn-secondary" onClick={onClose} type="button">
                  关闭
                </button>
              </div>
            </>
          )
        )}
      </div>
    </div>
  );
}
