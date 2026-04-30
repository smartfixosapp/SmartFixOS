/**
 * LoadingOptimizer plugin proxy
 *
 * JS-side wrapper around the iOS-native `LoadingOptimizer` plugin.
 * On the web (or any non-iOS platform) it falls back to `web-loading.ts`,
 * which implements no-op behavior so the same import works everywhere.
 *
 * Usage:
 *   import { LoadingOptimizer } from "@/plugins/LoadingOptimizer";
 *   await LoadingOptimizer.reportReady();
 */

import { registerPlugin } from "@capacitor/core";

export interface ReportReadyResult {
  acknowledged: boolean;
  atUptime: number;
}

export interface ExtendSplashOptions {
  /** Milliseconds to keep the splash visible (capped at 4000). */
  ms: number;
}

export interface ExtendSplashResult {
  extendedMs: number;
}

export interface IsSplashVisibleResult {
  visible: boolean;
}

export interface LoadingOptimizerPlugin {
  /** Tell the native side that React has reached first paint. */
  reportReady(): Promise<ReportReadyResult>;
  /** Keep the splash visible a little longer (e.g. while booting auth). */
  extendSplash(options: ExtendSplashOptions): Promise<ExtendSplashResult>;
  /** Query whether the native splash is currently shown. */
  isSplashVisible(): Promise<IsSplashVisibleResult>;
}

export const LoadingOptimizer = registerPlugin<LoadingOptimizerPlugin>(
  "LoadingOptimizer",
  {
    web: () => import("./web-loading").then((m) => new m.LoadingOptimizerWeb()),
  }
);
