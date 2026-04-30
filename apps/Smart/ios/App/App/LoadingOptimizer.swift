import Foundation
import UIKit
import Capacitor

/// LoadingOptimizer
///
/// Native splash + first-paint optimizer for SmartFixOS on iOS.
///
/// Goals:
///   1. Hide the launch screen as soon as the WebView signals first contentful
///      paint, instead of after a fixed delay (default Capacitor behavior).
///   2. Pre-warm DNS / TLS for the Supabase + Vercel hosts so the first
///      authenticated request after launch is faster.
///   3. Surface a `prepareLaunch()` and `applicationDidEnterBackground()`
///      hook the AppDelegate calls.
///
/// JS side: see apps/Smart/src/plugins/LoadingOptimizer.ts
@objc(LoadingOptimizer)
public class LoadingOptimizer: CAPPlugin {

    /// Singleton accessible from AppDelegate (the plugin instance is
    /// created later by Capacitor; this provides early-launch access).
    @objc public static let shared = LoadingOptimizer()

    private var didReportFirstPaint = false
    private var preconnectURLs: [URL] = [
        URL(string: "https://idntuvtabecwubzswpwi.supabase.co")!,
        URL(string: "https://smart-fix-os-smart.vercel.app")!,
    ]

    // ─────────────────────────────────────────────────────────────────────
    // Public entry points (called by AppDelegate)
    // ─────────────────────────────────────────────────────────────────────

    /// Called from AppDelegate.didFinishLaunchingWithOptions before the
    /// WebView is fully attached. Pre-warms network connections.
    @objc public func prepareLaunch() {
        let session = URLSession.shared
        for url in preconnectURLs {
            var req = URLRequest(url: url)
            req.httpMethod = "HEAD"
            req.timeoutInterval = 3.0
            session.dataTask(with: req) { _, _, _ in
                // Fire-and-forget; only goal is the TCP+TLS handshake.
            }.resume()
        }
        print("[LoadingOptimizer] preconnect to \(preconnectURLs.count) hosts started")
    }

    /// Called when the app moves to the background. Resets the
    /// "first paint" flag so the next foreground gets fresh measurements.
    @objc public func applicationDidEnterBackground() {
        didReportFirstPaint = false
    }

    // ─────────────────────────────────────────────────────────────────────
    // Capacitor plugin methods (callable from JS)
    // ─────────────────────────────────────────────────────────────────────

    /// JS calls this when the React app reaches first meaningful paint.
    /// We hide the splash here (with a tiny fade so it's not jarring).
    @objc func reportReady(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            self.didReportFirstPaint = true
            self.fadeOutNativeSplashIfPresent()
            call.resolve(["acknowledged": true, "atUptime": ProcessInfo.processInfo.systemUptime])
        }
    }

    /// JS can ask the native side to keep the splash up a little longer
    /// (e.g. while bootstrapping Supabase auth). Default cap is 4s.
    @objc func extendSplash(_ call: CAPPluginCall) {
        let extraMs = call.getInt("ms", 0)
        let clamped = min(max(extraMs, 0), 4000)
        DispatchQueue.main.asyncAfter(deadline: .now() + .milliseconds(clamped)) {
            if !self.didReportFirstPaint {
                self.fadeOutNativeSplashIfPresent()
            }
        }
        call.resolve(["extendedMs": clamped])
    }

    /// Returns whether the native splash is currently visible.
    @objc func isSplashVisible(_ call: CAPPluginCall) {
        call.resolve(["visible": !didReportFirstPaint])
    }

    // ─────────────────────────────────────────────────────────────────────
    // Helpers
    // ─────────────────────────────────────────────────────────────────────

    private func fadeOutNativeSplashIfPresent() {
        // The splash plugin from @capacitor/splash-screen owns the actual
        // splash view. We simply trigger its hide method via the bridge,
        // but do it with a soft fade for a less jarring transition.
        guard let bridge = self.bridge else { return }
        if let splash = bridge.plugin(withName: "SplashScreen") {
            // Reflect into the existing hide method to avoid hard-linking.
            if splash.responds(to: NSSelectorFromString("hide:")) {
                let dummyCall = CAPPluginCall(callbackId: "hide", options: [:], success: { _, _ in }, error: { _ in })
                if let dummyCall = dummyCall {
                    splash.perform(NSSelectorFromString("hide:"), with: dummyCall)
                }
            }
        }
    }
}
