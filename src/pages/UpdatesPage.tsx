import { useState, useEffect } from "react";
import { Package, checkUpgrades, upgradePackage, upgradeAll } from "../api";
import PackageCard from "../components/PackageCard";
import DetailPanel from "../components/DetailPanel";
import RainbowProgressBar from "../components/RainbowProgressBar";
import { useToast, usePackages, useOperations } from "../context";

/**
 * Available package updates page component.
 * @module pages/UpdatesPage
 */

/**
 * Renders available software upgrades, progress bars for active updates,
 * batch upgrade operations, and synchronizes badge counts directly into PackageContext.
 */
export default function UpdatesPage() {
  const { addToast } = useToast();
  const { setUpgradeCount, refreshInstalled } = usePackages();
  const { activeOperations, addOperation, removeOperation, isOperating, progresses } = useOperations();

  const [packages, setPackages] = useState<Package[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPkg, setSelectedPkg] = useState<Package | null>(null);

  const loadUpgrades = async () => {
    setLoading(true);
    try {
      const pkgs = await checkUpgrades();
      setPackages(pkgs);
      setUpgradeCount(pkgs.length);
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
        setPackages((prev) => {
          const next = prev.filter((p) => p.id !== pkg.id);
          setUpgradeCount(next.length);
          return next;
        });
        await refreshInstalled();
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
    packages.forEach((pkg) => addOperation(pkg.id));
    try {
      const result = await upgradeAll();
      if (result.success) {
        addToast("所有软件已更新", "success");
        setPackages([]);
        setUpgradeCount(0);
        await refreshInstalled();
      } else {
        addToast("部分软件更新可能失败", "warning");
        await loadUpgrades();
      }
    } catch (err) {
      addToast(`全部更新出错: ${err}`, "error");
    } finally {
      packages.forEach((pkg) => removeOperation(pkg.id));
    }
  };

  return (
    <>
      <div className="header">
        <h2 className="header-title">🔄 更新</h2>
        <div className="header-actions">
          <button
            className="btn btn-primary"
            onClick={handleUpgradeAll}
            disabled={activeOperations.size > 0 || packages.length === 0}
            type="button"
          >
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
            <button
              className="btn btn-secondary"
              onClick={loadUpgrades}
              style={{ marginTop: 12 }}
              type="button"
            >
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
                const isUpgrading = isOperating(pkg.id);
                const progress = progresses[pkg.id] || 0;
                return (
                  <div
                    key={pkg.id}
                    className="package-card-wrapper"
                    style={{
                      position: "relative",
                      overflow: "hidden",
                      borderRadius: "var(--radius-lg)",
                    }}
                  >
                    <RainbowProgressBar active={isUpgrading} progress={progress} />
                    <PackageCard
                      pkg={pkg}
                      onClick={() => setSelectedPkg(pkg)}
                      showUpgrade
                      actionButton={
                        <button
                          className="btn btn-primary btn-sm"
                          disabled={isUpgrading || (activeOperations.size > 0 && !isUpgrading)}
                          onClick={() => handleUpgrade(pkg)}
                          type="button"
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
          onOperationComplete={loadUpgrades}
          mode="update"
        />
      )}
    </>
  );
}
