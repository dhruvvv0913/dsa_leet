"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { isDemo } from "../site";
import type { DataClient } from "./client";
import { DemoDataClient } from "./demo-client";
import { SupabaseDataClient } from "./supabase-client";

const DataContext = createContext<DataClient | null>(null);

export function DataProvider({ children }: { children: ReactNode }) {
  const [client] = useState<DataClient>(() => (isDemo ? new DemoDataClient() : new SupabaseDataClient()));
  return <DataContext.Provider value={client}>{children}</DataContext.Provider>;
}

export function useData() {
  const client = useContext(DataContext);
  if (!client) throw new Error("useData must be used inside <DataProvider>");
  return client;
}
