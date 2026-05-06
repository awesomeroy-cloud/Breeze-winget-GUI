import { useState, useEffect } from "react";
import { Package, checkUpgrades, upgradePackage, upgradeAll } from "../api";
import PackageCard from "../components/PackageCard";
import DetailPanel from "../components/DetailPanel";

import { GlobalState } from "../App";

interface Props {
  addToast: (msg: string, type: "success" | "error" | "info" | "warning") => void;
  onCountChange: (count: number) => void;
  globalState: GlobalState;
}

export default function UpdatesPage({ addToast, onCountChange, globalState }: Props) {
  const [packages, setPackages] = useState<Package[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPkg, setSelectedPkg] = useState<Package | null>(null);
  const { activeOperations, addOperation, removeOperation } = globalState;

  const loadUpgrades = async () => {
    setLoading(true);
    try {
      const pkgs = await checkUpgrades();
      setPackages(pkgs);
      onCountChange(pkgs.length);
    } catch (err) {
      addToast(`检查更新失败: ${err}`, "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUpgrades();
  }, []);

  const handleUpgrade = async (pkg: Package) => {
    addOperation(pkg.id);
    try {
      const result = await upgradePackage(pkg.id);
      if (result.success) {
        addToast(`${pkg.name} 更新成功`, "success");
        setPackages((prev) => prev.filter((p) => p.id !== pkg.id));
        onCountChange(packages.length - 1);
      } else {
        addToast(`${pkg.name} 更新失败`, "error");
      }
    } catch (err) {
      addToast(`更新出错: ${err}`, "error");
    } finally {
      removeOperation(pkg.id);
    }
  };

  const handleUpgradeAll = async () => {
    packages.forEach(pkg => addOperation(pkg.id));
    try {
      const result = await upgradeAll();
      if (result.success) {
        addToast("所有软件已更新", "success");
        setPackages([]);
        onCountChange(0);
      } else {
        addToast("部分软件更新可能失败", "warning");
        await loadUpgrades();
      }
    } catch (err) {
      addToast(`全部更新出错: ${err}`, "error");
    } finally {
      packages.forEach(pkg => removeOperation(pkg.id));
    }
  };

  return (
    <>
      <div className="header">
        <h2 className="header-title">🔄 更新</h2>
        <div className="header-actions">
          <button className="btn btn-primary" onClick={handleUpgradeAll} disabled={activeOperations.size > 0}>
            {activeOperations.size > 0 ? "全部更新中..." : "🚀 全部一键更新"}
          </button>
        </div>
      </div>

      <div className="content-area">
        {loading ? (
          <div className="loading-container">
            <div className="spinner" />
            <span className="loading-text">正在检查可用更新...</span>
          </div>
        ) : packages.length === 0 ? (
          <div className="all-updated">
            <div className="all-updated-icon">🎉</div>
            <h2>所有软件都是最新的！</h2>
            <p>没有发现可用的更新。</p>
            <button className="btn btn-secondary" onClick={loadUpgrades} style={{ marginTop: 12 }}>
              重新检查
            </button>
          </div>
        ) : (
          <>
            <div className="update-banner">
              <span style={{ fontSize: 24 }}>🚀</span>
              <span className="update-banner-text">
                发现 <strong>{packages.length}</strong> 个软件有可用更新
              </span>
            </div>

            <div className="package-grid">
              {packages.map((pkg) => {
                const isUpgrading = activeOperations.has(pkg.id);
                const progress = globalState.progresses[pkg.id] || 0;
                return (
                  <div key={pkg.id} className="package-card-wrapper" style={{ position: "relative", overflow: "hidden", borderRadius: "var(--radius-lg)" }}>
                    {isUpgrading && <div className="rainbow-progress" style={{ width: `${progress}%` }}></div>}
                    <PackageCard
                      pkg={pkg}
                      onClick={() => setSelectedPkg(pkg)}
                      showUpgrade
                      actionButton={
                        <button
                          className="btn btn-primary btn-sm"
                          disabled={isUpgrading || activeOperations.size > 0 && !isUpgrading}
                          onClick={() => handleUpgrade(pkg)}
                        >
                          {isUpgrading ? "更新中..." : `更新到 ${pkg.available}`}
                        </button>
                      }
                    />
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {selectedPkg && (
        <DetailPanel
          pkg={selectedPkg}
          onClose={() => setSelectedPkg(null)}
          addToast={addToast}
          onOperationComplete={loadUpgrades}
          mode="update"
          globalState={globalState}
        />
      )}
    </>
  );
}
