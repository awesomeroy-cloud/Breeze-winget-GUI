import { useState, useMemo } from "react";
import { Package, uninstallPackage } from "../api";
import DetailPanel from "../components/DetailPanel";
import { GlobalState } from "../App";

interface Props {
  addToast: (msg: string, type: "success" | "error" | "info") => void;
  globalState?: GlobalState;
}

export default function InstalledPage({ addToast, globalState }: Props) {
  const [filter, setFilter] = useState("");
  const packages = globalState?.installedPackages || [];
  const loading = packages.length === 0 && !filter;
  const [selectedPkg, setSelectedPkg] = useState<Package | null>(null);
  const [confirmPkg, setConfirmPkg] = useState<Package | null>(null);

  const loadPackages = async () => {
    if (globalState?.refreshInstalled) {
      await globalState.refreshInstalled();
    }
  };

  const handleUninstall = async (pkg: Package) => {
    setConfirmPkg(null);
    globalState?.addOperation(pkg.id);
    
    try {
      const res = await uninstallPackage(pkg.id);
      if (res.success) {
        addToast(`${pkg.name} 已成功卸载`, "success");
        await loadPackages();
      } else {
        addToast(`卸载失败: ${res.message}`, "error");
      }
    } catch (err) {
      addToast(`发生错误: ${err}`, "error");
    } finally {
      globalState?.removeOperation(pkg.id);
    }
  };

  const filtered = useMemo(() => {
    if (!filter) return packages;
    const q = filter.toLowerCase();
    return packages.filter(
      (p) => p.name.toLowerCase().includes(q) || p.id.toLowerCase().includes(q)
    );
  }, [packages, filter]);

  const wingetCount = packages.filter((p) => p.source === "winget").length;
  const storeCount = packages.filter((p) => p.source === "msstore").length;
  const otherCount = packages.length - wingetCount - storeCount;

  return (
    <>
      <div className="header">
        <h2 className="header-title">📦 已安装</h2>
        <div className="search-box">
          <span className="search-icon">⌕</span>
          <input
            type="text"
            placeholder="筛选已安装的软件..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        </div>
        <div className="header-actions">
          <button className="btn btn-secondary btn-sm" onClick={loadPackages} disabled={loading}>
            {loading ? "刷新中..." : "🔃 刷新"}
          </button>
        </div>
      </div>

      <div className="content-area">
        {loading ? (
          <div className="loading-container">
            <div className="spinner" />
            <span className="loading-text">正在加载已安装软件列表...</span>
          </div>
        ) : (
          <>
            <div className="stats-bar">
              <div className="stat-chip">
                <span className="stat-number accent">{packages.length}</span>
                <span>总计</span>
              </div>
              <div className="stat-chip">
                <span className="stat-number" style={{ color: "var(--info)" }}>{wingetCount}</span>
                <span>winget</span>
              </div>
              <div className="stat-chip">
                <span className="stat-number" style={{ color: "var(--warning)" }}>{storeCount}</span>
                <span>商店</span>
              </div>
              <div className="stat-chip">
                <span className="stat-number">{otherCount}</span>
                <span>其他</span>
              </div>
            </div>

            {filtered.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">📦</div>
                <div className="empty-title">没有找到匹配的软件</div>
                <div className="empty-desc">尝试不同的筛选条件</div>
              </div>
            ) : (
              <div className="package-list">
                <div className="package-list-header">
                  <span>名称</span>
                  <span>ID</span>
                  <span>版本</span>
                  <span>来源</span>
                  <span>操作</span>
                </div>
                {filtered.map((pkg, i) => {
                  const operating = globalState?.activeOperations.has(pkg.id);
                  return (
                    <div
                      key={`${pkg.id}-${i}`}
                      className="package-list-row"
                      onClick={() => setSelectedPkg(pkg)}
                    >
                      <span className="cell-name" title={pkg.name}>{pkg.name}</span>
                      <span className="cell-id" title={pkg.id}>{pkg.id}</span>
                      <span className="cell-version">{pkg.version}</span>
                      <span className="cell-source">{pkg.source || "—"}</span>
                      <span onClick={(e) => e.stopPropagation()} style={{ display: "flex", gap: 8 }}>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => setSelectedPkg(pkg)}
                        >
                          详情
                        </button>
                        <button
                          className="btn btn-outline btn-sm"
                          style={{ color: "var(--danger)", borderColor: "rgba(248, 113, 113, 0.3)" }}
                          disabled={operating}
                          onClick={() => setConfirmPkg(pkg)}
                        >
                          {operating ? "操作中..." : "卸载"}
                        </button>
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      {confirmPkg && (
        <div className="modal-overlay" onClick={() => setConfirmPkg(null)}>
          <div className="confirm-modal" onClick={e => e.stopPropagation()}>
            <h3>确认卸载？</h3>
            <p>你确定要卸载 <strong>{confirmPkg.name}</strong> 吗？此操作将尝试静默清理所有关联文件。</p>
            <div className="confirm-modal-actions">
              <button className="btn btn-secondary" onClick={() => setConfirmPkg(null)}>
                取消
              </button>
              <button 
                className="btn btn-danger-solid" 
                onClick={() => handleUninstall(confirmPkg)}
              >
                确定卸载
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedPkg && (
        <DetailPanel
          pkg={selectedPkg}
          onClose={() => setSelectedPkg(null)}
          addToast={addToast}
          onOperationComplete={loadPackages}
          mode="installed"
          globalState={globalState}
        />
      )}
    </>
  );
}
