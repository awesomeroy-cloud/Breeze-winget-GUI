import { useState, useCallback } from "react";
import { Package, searchPackages, installPackage } from "../api";
import PackageCard from "../components/PackageCard";
import DetailPanel from "../components/DetailPanel";

import { GlobalState } from "../App";

interface Props {
  addToast: (msg: string, type: "success" | "error" | "info") => void;
  globalState?: GlobalState;
}

const FEATURED_CATEGORIES = [
  {
    title: "🛠️ 开发工具",
    items: [
      { label: "VS Code", id: "Microsoft.VisualStudioCode" },
      { label: "Git", id: "Git.Git" },
      { label: "Node.js", id: "OpenJS.NodeJS" },
      { label: "Python", id: "Python.Python.3" },
      { label: "Docker", id: "Docker.DockerDesktop" },
      { label: "Notepad++", id: "Notepad++.Notepad++" },
    ],
  },
  {
    title: "🌐 浏览器 & 通讯",
    items: [
      { label: "Chrome", id: "Google.Chrome" },
      { label: "Firefox", id: "Mozilla.Firefox" },
      { label: "Discord", id: "Discord.Discord" },
      { label: "Telegram", id: "Telegram.TelegramDesktop" },
    ],
  },
  {
    title: "🎬 媒体 & 工具",
    items: [
      { label: "VLC", id: "VideoLAN.VLC" },
      { label: "7-Zip", id: "7zip.7zip" },
      { label: "Steam", id: "Valve.Steam" },
      { label: "PowerToys", id: "Microsoft.PowerToys" },
    ],
  },
];

export default function DiscoverPage({ addToast, globalState }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Package[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [selectedPkg, setSelectedPkg] = useState<Package | null>(null);
  const [installingIds, setInstallingIds] = useState<Set<string>>(new Set());

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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSearch();
  };

  const handleQuickInstall = async (pkg: Package) => {
    setInstallingIds((prev) => new Set(prev).add(pkg.id));
    globalState?.addOperation(pkg.id);
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
      setInstallingIds((prev) => {
        const next = new Set(prev);
        next.delete(pkg.id);
        return next;
      });
      globalState?.removeOperation(pkg.id);
      globalState?.refreshInstalled();
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
          <button className="btn btn-primary btn-sm" onClick={handleSearch} disabled={loading}>
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
                    <h4 style={{ fontSize: 13, fontWeight: 600, color: "var(--text-tertiary)", marginBottom: 8 }}>
                      {cat.title}
                    </h4>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                      {cat.items.map((item) => (
                        <button
                          key={item.id}
                          className={`btn ${globalState?.installedPackages.some(p => p.id === item.id) ? "btn-secondary" : "btn-outline"} btn-sm`}
                          disabled={globalState?.installedPackages.some(p => p.id === item.id) || loading}
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
                          {globalState?.installedPackages.some(p => p.id === item.id) ? `✓ ${item.label}` : item.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="package-grid">
              {results.map((pkg) => {
                const isInstalled = globalState?.installedPackages.some(p => p.id === pkg.id);
                const isInstalling = installingIds.has(pkg.id);
                const progress = globalState?.progresses[pkg.id] || 0;
                return (
                  <div key={pkg.id} className="package-card-wrapper" style={{ position: "relative", overflow: "hidden", borderRadius: "var(--radius-lg)" }}>
                    {isInstalling && <div className="rainbow-progress" style={{ width: `${progress}%` }}></div>}
                    <PackageCard
                      pkg={pkg}
                      onClick={setSelectedPkg}
                      actionButton={
                        <button
                          className={`btn ${isInstalled ? "btn-secondary" : "btn-primary"} btn-sm`}
                          disabled={isInstalling || isInstalled}
                          onClick={() => handleQuickInstall(pkg)}
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
          addToast={addToast}
          mode="search"
          globalState={globalState}
        />
      )}
    </>
  );
}
