/**
 * Storage Layer for AgencyOS
 *
 * This module provides a unified storage interface that supports:
 * 1. Supabase PostgreSQL (production) - when AGENCYOS_DATABASE_URL is set
 * 2. JSON files (development) - fallback when database is unavailable
 *
 * The storage layer automatically switches between backends based on
 * environment configuration, allowing seamless local development and
 * production deployment.
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { isSupabaseEnabled } from "./supabaseStorage";

const DATA_DIR = path.resolve(process.cwd(), "data");

// ============================================
// STORAGE MODE DETECTION
// ============================================

export type StorageMode = "supabase" | "json";

export function getStorageMode(): StorageMode {
  return isSupabaseEnabled() ? "supabase" : "json";
}

export function isUsingSupabase(): boolean {
  return isSupabaseEnabled();
}

// ============================================
// JSON FILE STORAGE (Fallback)
// ============================================

async function ensureDataDir(): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

export async function readJsonFile<T>(filename: string, fallback: T): Promise<T> {
  await ensureDataDir();
  const fullPath = path.join(DATA_DIR, filename);
  try {
    const raw = await fs.readFile(fullPath, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export async function writeJsonFile<T>(filename: string, value: T): Promise<void> {
  await ensureDataDir();
  const fullPath = path.join(DATA_DIR, filename);
  await fs.writeFile(fullPath, JSON.stringify(value, null, 2), "utf8");
}

// ============================================
// STORAGE INFO (for debugging)
// ============================================

export function getStorageInfo(): { mode: StorageMode; dataDir: string; supabaseEnabled: boolean } {
  return {
    mode: getStorageMode(),
    dataDir: DATA_DIR,
    supabaseEnabled: isSupabaseEnabled(),
  };
}

