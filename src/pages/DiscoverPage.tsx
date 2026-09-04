import React, { useState, useCallback } from "react";
import { Package, searchPackages, installPackage } from "../api";
import PackageCard from "../components/PackageCard";
import DetailPanel from "../components/DetailPanel";
import RainbowProgressBar from "../components/RainbowProgressBar";
import { FEATURED_CATEGORIES } from "../constants/categories";
import { useToast, useOperations, usePackages } from "../context";

/**
 * Discover and search page component.
 * @module pages/DiscoverPage
 */

/**
 * Renders the package discovery view, featured category recommendations,
 * and keyword search results without requiring any drilled props.
 */
export default function DiscoverPage() {
  const { addToast } = useToast();
  const { addOperation, removeOperation, isOperating, progresses } = useOperations();
  const { installedPackages, refreshInstalled } = usePackages();

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Package[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [selectedPkg, setSelectedPkg] = useState<Package | null>(null);

  const handleSearch = useCallback(async () => {
    const q = query.trim();
    if (!q) return;
    setLoading(true);
    setSearched(true);
    try {
      const pkgs = await searchPackages(q);
      setResults(pkgs);
    } catch (err) {
      addToast(`搜索失败: ${err}`, "error");
    } finally {
      setLoading(false);
    }
  }, [query, addToast]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") handleSearch();
  };

  const handleQuickInstall = async (pkg: Package) => {
    addOperation(pkg.id);
    try {
      const result = await installPackage(pkg.id);
      if (result.success) {
        addToast(`${pkg.name} 安装成功`, "success");
      } else {
        addToast(`${pkg.name} 安装失败`, "error");
      }
    } catch (err) {
      addToast(`安装出错: ${err}`, "error");
    } finally {
      removeOperation(pkg.id);
      await refreshInstalled();
    }
  };

  return (
    <>
      <div className="header">
        <h2 className="header-title">🔍 发现</h2>
        <div className="search-box">
          <span className="search-icon">⌕</span>
          <input
            type="text"
            placeholder="搜索软件包... (名称、ID 或关键词)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            autoFocus
          />
          <span className="search-shortcut">Enter</span>
        </div>
        <div className="header-actions">
          <button
            className="btn btn-primary btn-sm"
            onClick={handleSearch}
            disabled={loading}
            type="button"
          >
            {loading ? "搜索中..." : "搜索"}
          </button>
        </div>
      </div>

      <div className="content-area">
        {loading ? (
          <div className="loading-container">
            <div className="spinner" />
            <span className="loading-text">正在搜索软件包...</span>
          </div>
        ) : searched && results.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🔍</div>
            <div className="empty-title">未找到匹配的软件包</div>
            <div className="empty-desc">尝试使用不同的关键词搜索，或者检查软件包 ID 是否正确</div>
          </div>
        ) : (
          <>
            {!searched && (
              <div className="featured-section">
                {FEATURED_CATEGORIES.map((cat) => (
                  <div key={cat.title} style={{ marginBottom: 18 }}>
                    <h4
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: "var(--text-tertiary)",
                        marginBottom: 8,
                      }}
                    >
                      {cat.title}
                    </h4>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                      {cat.items.map((item) => {
                        const isInstalled = installedPackages.some((p) => p.id === item.id);
                        return (
                          <button
                            key={item.id}
                            className={`btn ${isInstalled ? "btn-secondary" : "btn-outline"} btn-sm`}
                            disabled={isInstalled || loading}
                            type="button"
                            onClick={() => {
                              setLoading(true);
                              searchPackages(item.id)
                                .then((pkgs) => {
                                  if (pkgs.length > 0) setSelectedPkg(pkgs[0]);
                                  else addToast("未找到该软件包", "info");
                                })
                                .finally(() => setLoading(false));
                            }}
                          >
                            {isInstalled ? `✓ ${item.label}` : item.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="package-grid">
              {results.map((pkg) => {
                const isInstalled = installedPackages.some((p) => p.id === pkg.id);
                const isInstalling = isOperating(pkg.id);
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
                    <RainbowProgressBar active={isInstalling} progress={progress} />
                    <PackageCard
                      pkg={pkg}
                      onClick={setSelectedPkg}
                      actionButton={
                        <button
                          className={`btn ${isInstalled ? "btn-secondary" : "btn-primary"} btn-sm`}
                          disabled={isInstalling || isInstalled}
                          onClick={() => handleQuickInstall(pkg)}
                          type="button"
                        >
                          {isInstalling ? "安装中..." : isInstalled ? "已安装" : "安装"}
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
          mode="search"
        />
      )}
    </>
  );
}
