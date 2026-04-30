/**
 * Web fallback for the LoadingOptimizer plugin.
 *
 * On the web there is no native splash to control, so most methods
 * resolve immediately. We still emit a `sfx:web-ready` window event
 * so any web-only loaders can listen for the same signal that the
 * native bridge would deliver.
 */

import { WebPlugin } from "@capacitor/core";
import type {
  LoadingOptimizerPlugin,
  ReportReadyResult,
  ExtendSplashOptions,
  ExtendSplashResult,
  IsSplashVisibleResult,
} from "./LoadingOptimizer";

export class LoadingOptimizerWeb extends WebPlugin implements LoadingOptimizerPlugin {
  async reportReady(): Promise<ReportReadyResult> {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("sfx:web-ready"));
    }
    return {
      acknowledged: true,
      atUptime: typeof performance !== "undefined" ? performance.now() / 1000 : 0,
    };
  }

  async extendSplash({ ms }: ExtendSplashOptions): Promise<ExtendSplashResult> {
    const clamped = Math.max(0, Math.min(4000, Number(ms) || 0));
    return { extendedMs: clamped };
  }

  async isSplashVisible(): Promise<IsSplashVisibleResult> {
    return { visible: false };
  }
}
