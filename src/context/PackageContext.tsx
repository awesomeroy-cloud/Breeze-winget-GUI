import React, { createContext, useContext, useState, useCallback, useEffect, useMemo } from "react";
import { Package } from "../types";
import { listInstalled } from "../api";

/**
 * Package inventory, upgrades, and active operation tracking contexts.
 * @module context/PackageContext
 */

/**
 * Values and actions provided by the Packages context.
 */
export interface PackagesContextValue {
  /** Array of currently installed software packages on the local machine */
  installedPackages: Package[];
  /** Asynchronously refreshes the installed software package list from winget */
  refreshInstalled: () => Promise<void>;
  /** Number of software packages with available upgrades */
  upgradeCount: number;
  /** Direct setter to update the pending upgrade badge count */
  setUpgradeCount: React.Dispatch<React.SetStateAction<number>> | ((count: number) => void);
}

/**
 * Values and actions provided by the Operations context.
 */
export interface OperationsContextValue {
  /** Set of package IDs currently undergoing an active operation (install/uninstall/upgrade) */
  activeOperations: Set<string>;
  /** Real-time progress percentages mapped by package ID (0.0 - 100.0) */
  progresses: Record<string, number>;
  /** Marks a package as actively executing an operation */
  addOperation: (id: string) => void;
  /** Clears active operation and progress state for a package */
  removeOperation: (id: string) => void;
  /** Checks whether an operation is currently active for the given package ID */
  isOperating: (id: string) => boolean;
}

const PackagesContext = createContext<PackagesContextValue | undefined>(undefined);
const OperationsContext = createContext<OperationsContextValue | undefined>(undefined);

/**
 * Props for PackageProvider.
 */
export interface PackageProviderProps {
  /** Child component tree */
  children: React.ReactNode;
}

/**
 * Central state provider managing installed packages, upgrade counts, active operations,
 * and streaming download/install progress events from Tauri IPC.
 */
export function PackageProvider({ children }: PackageProviderProps) {
  const [installedPackages, setInstalledPackages] = useState<Package[]>([]);
  const [upgradeCount, setUpgradeCount] = useState<number>(0);
  const [activeOperations, setActiveOperations] = useState<Set<string>>(new Set());
  const [progresses, setProgresses] = useState<Record<string, number>>({});

  // Asynchronously load installed packages
  const refreshInstalled = useCallback(async () => {
    try {
      const pkgs = await listInstalled();
      setInstalledPackages(pkgs);
    } catch (err) {
      console.error("Failed to load installed packages:", err);
    }
  }, []);

  // Listen to Tauri download-progress events
  useEffect(() => {
    if (typeof window === "undefined" || !(window as any).__TAURI_INTERNALS__) return;

    let unlisten: (() => void) | undefined;
    async function setupListener() {
      try {
        const { listen } = await import("@tauri-apps/api/event");
        unlisten = await listen<{ id: string; progress: number }>("download-progress", (event) => {
          setProgresses((prev) => ({
            ...prev,
            [event.payload.id]: event.payload.progress,
          }));
        });
      } catch (err) {
        console.error("Failed to mount download-progress event listener:", err);
      }
    }

    setupListener();

    return () => {
      if (unlisten) unlisten();
    };
  }, []);

  // Operation tracking helpers
  const addOperation = useCallback((id: string) => {
    setActiveOperations((prev) => new Set(prev).add(id));
  }, []);

  const removeOperation = useCallback((id: string) => {
    setActiveOperations((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    setProgresses((prev) => {
      if (!(id in prev)) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

  const isOperating = useCallback(
    (id: string) => activeOperations.has(id),
    [activeOperations]
  );

  const packagesValue = useMemo<PackagesContextValue>(
    () => ({
      installedPackages,
      refreshInstalled,
      upgradeCount,
      setUpgradeCount,
    }),
    [installedPackages, refreshInstalled, upgradeCount]
  );

  const operationsValue = useMemo<OperationsContextValue>(
    () => ({
      activeOperations,
      progresses,
      addOperation,
      removeOperation,
      isOperating,
    }),
    [activeOperations, progresses, addOperation, removeOperation, isOperating]
  );

  return (
    <PackagesContext.Provider value={packagesValue}>
      <OperationsContext.Provider value={operationsValue}>
        {children}
      </OperationsContext.Provider>
    </PackagesContext.Provider>
  );
}

/**
 * Custom hook to access installed software packages and upgrade counts.
 *
 * @throws {Error} If called outside of a `<PackageProvider>` tree.
 * @returns {PackagesContextValue} Installed packages, upgrade count, and refresher functions.
 */
export function usePackages(): PackagesContextValue {
  const context = useContext(PackagesContext);
  if (!context) {
    throw new Error("usePackages must be used within a PackageProvider");
  }
  return context;
}

/**
 * Custom hook to access active operations and download progress state.
 *
 * @throws {Error} If called outside of a `<PackageProvider>` tree.
 * @returns {OperationsContextValue} Active operation IDs, progress map, and operation mutators.
 */
export function useOperations(): OperationsContextValue {
  const context = useContext(OperationsContext);
  if (!context) {
    throw new Error("useOperations must be used within a PackageProvider");
  }
  return context;
}
