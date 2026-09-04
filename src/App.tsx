import { useState, useCallback, useEffect } from "react";
import Sidebar from "./components/Sidebar";
import DiscoverPage from "./pages/DiscoverPage";
import InstalledPage from "./pages/InstalledPage";
import UpdatesPage from "./pages/UpdatesPage";
import SettingsPage from "./pages/SettingsPage";
import InitPage from "./pages/InitPage";
import { getWingetVersion } from "./api";
import { Page } from "./types";
import { ToastProvider, PackageProvider, usePackages } from "./context";

/**
 * Root application shell and view router.
 * @module App
 */

// Re-export Page for backward compatibility
export type { Page };

/**
 * Internal application shell rendered inside Toast and Package context providers.
 */
function AppShell() {
  const [currentPage, setCurrentPage] = useState<Page>("discover");
  const [appState, setAppState] = useState<"loading" | "missing-winget" | "ready">("loading");
  const { refreshInstalled } = usePackages();

  const checkWinget = useCallback(async () => {
    try {
      setAppState("loading");
      await getWingetVersion();
      setAppState("ready");
      // Background load installed software as soon as winget environment is verified
      await refreshInstalled();
    } catch (e) {
      console.error("Winget not found on host system:", e);
      setAppState("missing-winget");
    }
  }, [refreshInstalled]);

  useEffect(() => {
    checkWinget();
  }, [checkWinget]);

  const renderPage = () => {
    switch (currentPage) {
      case "discover":
        return <DiscoverPage />;
      case "installed":
        return <InstalledPage />;
      case "updates":
        return <UpdatesPage />;
      case "settings":
        return <SettingsPage />;
    }
  };

  if (appState === "loading") {
    return (
      <div
        style={{
          display: "flex",
          height: "100vh",
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
        }}
      >
        <div
          className="spinner"
          style={{ width: 32, height: 32, borderWidth: 3, marginBottom: 16 }}
        />
        <div style={{ color: "var(--text-secondary)" }}>正在初始化 Breeze...</div>
      </div>
    );
  }

  if (appState === "missing-winget") {
    return <InitPage onReady={checkWinget} />;
  }

  return (
    <div className="app-layout">
      <Sidebar currentPage={currentPage} onNavigate={setCurrentPage} />
      <main className="main-content">
        <div className="page-enter" key={currentPage}>
          {renderPage()}
        </div>
      </main>
    </div>
  );
}

/**
 * Main application entry component providing context providers for notifications
 * and winget package state management.
 */
export default function App() {
  return (
    <ToastProvider>
      <PackageProvider>
        <AppShell />
      </PackageProvider>
    </ToastProvider>
  );
}
