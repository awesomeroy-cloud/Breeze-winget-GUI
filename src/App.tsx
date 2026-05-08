import { useState, useCallback, useEffect } from "react";
import Sidebar from "./components/Sidebar";
import DiscoverPage from "./pages/DiscoverPage";
import InstalledPage from "./pages/InstalledPage";
import UpdatesPage from "./pages/UpdatesPage";
import SettingsPage from "./pages/SettingsPage";
import InitPage from "./pages/InitPage";
import ToastContainer, { Toast } from "./components/Toast";
import { Package, listInstalled, getWingetVersion } from "./api";

export type Page = "discover" | "installed" | "updates" | "settings";

export interface GlobalState {
  activeOperations: Set<string>;
  addOperation: (id: string) => void;
  removeOperation: (id: string) => void;
  progresses: Record<string, number>;
  installedPackages: Package[];
  refreshInstalled: () => Promise<void>;
}

function App() {
  const [currentPage, setCurrentPage] = useState<Page>("discover");
  const [upgradeCount, setUpgradeCount] = useState(0);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [activeOperations, setActiveOperations] = useState<Set<string>>(new Set());
  const [progresses, setProgresses] = useState<Record<string, number>>({});
  const [installedPackages, setInstalledPackages] = useState<Package[]>([]);
  
  const [appState, setAppState] = useState<"loading" | "missing-winget" | "ready">("loading");

  useEffect(() => {
    checkWinget();
  }, []);

  const checkWinget = async () => {
    try {
      setAppState("loading");
      await getWingetVersion();
      setAppState("ready");
      // Background load installed packages as soon as winget is ready
      refreshInstalled();
    } catch (e) {
      console.error("Winget not found:", e);
      setAppState("missing-winget");
    }
  };



  const addOperation = useCallback((id: string) => {
    setActiveOperations(prev => new Set(prev).add(id));
  }, []);

  const removeOperation = useCallback((id: string) => {
    setActiveOperations(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);
  const refreshInstalled = useCallback(async () => {
    try {
      const pkgs = await listInstalled();
      setInstalledPackages(pkgs);
    } catch (e) {
      console.error("Failed to load installed packages:", e);
    }
  }, []);
  useEffect(() => {
    if (!(window as any).__TAURI_INTERNALS__) return;
    
    let unlisten: (() => void) | undefined;
    async function setupProgressListener() {
      const { listen } = await import('@tauri-apps/api/event');
      unlisten = await listen<{ id: string; progress: number }>('download-progress', (event) => {
        setProgresses(prev => ({
          ...prev,
          [event.payload.id]: event.payload.progress
        }));
      });
    }
    setupProgressListener();
    return () => {
      if (unlisten) unlisten();
    };
  }, []);

  const globalState: GlobalState = { 
    activeOperations, 
    addOperation, 
    removeOperation, 
    progresses, 
    installedPackages, 
    refreshInstalled 
  };

  const addToast = useCallback((message: string, type: "success" | "error" | "info" | "warning" = "info") => {
    const id = Date.now().toString();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const renderPage = () => {
    switch (currentPage) {
      case "discover":
        return <DiscoverPage addToast={addToast} globalState={globalState} />;
      case "installed":
        return <InstalledPage addToast={addToast} globalState={globalState} />;
      case "updates":
        return <UpdatesPage addToast={addToast} onCountChange={setUpgradeCount} globalState={globalState} />;
      case "settings":
        return <SettingsPage />;
    }
  };

  if (appState === "loading") {
    return (
      <div style={{ display: "flex", height: "100vh", alignItems: "center", justifyContent: "center", flexDirection: "column" }}>
        <div className="spinner" style={{ width: 32, height: 32, borderWidth: 3, marginBottom: 16 }}></div>
        <div style={{ color: "var(--text-secondary)" }}>正在初始化 Breeze...</div>
      </div>
    );
  }

  if (appState === "missing-winget") {
    return <InitPage onReady={checkWinget} />;
  }

  return (
    <div className="app-layout">
      <Sidebar
        currentPage={currentPage}
        onNavigate={setCurrentPage}
        upgradeCount={upgradeCount}
      />
      <main className="main-content">
        <div className="page-enter" key={currentPage}>
          {renderPage()}
        </div>
      </main>
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}

export default App;
