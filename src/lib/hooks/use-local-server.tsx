"use client";

import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { createLocalClient } from "../clients/local-server";
import { LocalConfig } from "../types/misc";

const STORAGE_KEY = "orochi-local-config";

const DEFAULT_CONFIG: LocalConfig = {
  serverUrl: "http://127.0.0.1:3001",
  arxpFolderPath: "/Users/dimitritsampiras/Documents/Orochi/ARXP",
};

// --- Context Type ---
interface LocalServerContextType {
  // Config State
  config: LocalConfig;
  updateConfig: (newConfig: Partial<LocalConfig>) => void;
  isConfigLoaded: boolean;

  // Connection State
  isConnected: boolean;
  isChecking: boolean;
  lastChecked: Date | null;
  checkConnection: () => Promise<void>;
  openFile(path: string): Promise<"success" | "error">;
  checkFileExists: (path: string) => Promise<boolean>; // Add this
}

const LocalServerContext = createContext<LocalServerContextType | undefined>(undefined);

export function LocalServerProvider({ children }: { children: ReactNode }) {
  // --- Config Logic ---
  const [config, setConfig] = useState<LocalConfig>(DEFAULT_CONFIG);
  const [isConfigLoaded, setIsConfigLoaded] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        setConfig({ ...DEFAULT_CONFIG, ...JSON.parse(stored) });
      } catch (e) {
        console.error("Failed to parse local config", e);
      }
    }
    setIsConfigLoaded(true);
  }, []);

  const updateConfig = (newConfig: Partial<LocalConfig>) => {
    const updated = { ...config, ...newConfig };
    setConfig(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  };

  // --- Connection Logic ---
  const [isConnected, setIsConnected] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  const checkConnection = useCallback(async () => {
    if (!isConfigLoaded || !config.serverUrl) return;

    setIsChecking(true);
    try {
      const client = createLocalClient(config);
      const res = await client.ping();
      setIsConnected(res.status === "active");
    } catch (err) {
      setIsConnected(false);
    } finally {
      setIsChecking(false);
      setLastChecked(new Date());
    }
  }, [config, isConfigLoaded]);

  const checkFileExists = useCallback(
    async (path: string) => {
      if (!isConfigLoaded || !config.serverUrl) return false;
      const client = createLocalClient(config);
      const res = await client.fileExists(path);
      return res.exists;
    },
    [config, isConfigLoaded]
  );

  const openFile = useCallback(
    async (path: string) => {
      if (!isConfigLoaded || !config.serverUrl) return "error";
      const client = createLocalClient(config);
      const res = await client.open(path);
      return res.status;
    },
    [config, isConfigLoaded]
  );

  // Initial check when config loads or changes
  useEffect(() => {
    checkConnection();
  }, [checkConnection]);

  // Periodic polling
  useEffect(() => {
    if (!isConfigLoaded) return;
    const interval = setInterval(() => checkConnection(), 30000);
    return () => clearInterval(interval);
  }, [isConfigLoaded, checkConnection]);

  return (
    <LocalServerContext.Provider
      value={{
        config,
        updateConfig,
        isConfigLoaded,
        isConnected,
        isChecking,
        lastChecked,
        checkConnection,
        openFile,
        checkFileExists, // Add this
      }}
    >
      {children}
    </LocalServerContext.Provider>
  );
}

export function useLocalServer() {
  const context = useContext(LocalServerContext);
  if (context === undefined) {
    throw new Error("useLocalServer must be used within a LocalServerProvider");
  }
  return context;
}
