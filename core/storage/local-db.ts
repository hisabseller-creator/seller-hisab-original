import Dexie, { type EntityTable } from "dexie";
import type { AnalysisResult, CostRecord } from "../types";

export type SavedCost = CostRecord & { updatedAt: string };
export type SavedAnalysis = {
  id: string;
  createdAt: string;
  result: AnalysisResult;
  label: string;
};
export type SavedProductMapping = {
  id: string;
  name: string;
  aliasKeys: string[];
  approvedAt: string;
  updatedAt: string;
};

class MarginGuardDb extends Dexie {
  costs!: EntityTable<SavedCost, "sku">;
  analyses!: EntityTable<SavedAnalysis, "id">;
  productMappings!: EntityTable<SavedProductMapping, "id">;

  constructor() {
    super("seller-margin-guard");
    this.version(1).stores({
      costs: "&sku,updatedAt",
      analyses: "&id,createdAt",
    });
    this.version(2).stores({
      costs: "&sku,updatedAt",
      analyses: "&id,createdAt",
      productMappings: "&id,updatedAt",
    });
  }
}

let database: MarginGuardDb | undefined;

export function localDb(): MarginGuardDb {
  if (typeof window === "undefined") throw new Error("Local data is available only in the browser.");
  database ??= new MarginGuardDb();
  return database;
}

export async function clearLocalData(): Promise<void> {
  await localDb().delete();
  database = undefined;
  const keys = Array.from({ length: localStorage.length }, (_, index) => localStorage.key(index)).filter((key): key is string => Boolean(key));
  for (const key of keys) {
    if (key === "smg-current-analysis" || key.startsWith("smg-entitlement:")) localStorage.removeItem(key);
  }
}
