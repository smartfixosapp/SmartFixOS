import Foundation
import UIKit
import Capacitor

/// AdaptiveCapacitorViewController
///
/// A drop-in replacement for the default `CAPBridgeViewController` that:
///   - allows JS to override the status-bar style at runtime
///   - re-publishes safe-area changes as CSS variables on `:root`
///   - hides the home indicator when in fullscreen modes (POS checkout)
///   - locks orientation to portrait by default; landscape only when JS
///     explicitly opts in
///
/// To use, set this as the storyboard's view controller class. If you
/// keep the default `CAPBridgeViewController`, this file is harmless —
/// nothing else references it directly.
public class AdaptiveCapacitorViewController: CAPBridgeViewController {

    /// Set by NativeUIPlugin.setStatusBarStyle. `nil` defers to the
    /// system / Info.plist configuration.
    public var overrideStatusBarStyle: UIStatusBarStyle? = nil

    /// JS toggle for orientation. Defaults to portrait-only because the
    /// SmartFixOS layout is built mobile-first portrait.
    public var allowLandscape: Bool = false

    /// JS toggle for hiding the home indicator on iPhone X+ during
    /// distraction-free flows (e.g. signature capture, kiosk POS).
    public var hideHomeIndicator: Bool = false

    // ─────────────────────────────────────────────────────────────────────
    // Status bar
    // ─────────────────────────────────────────────────────────────────────

    public override var preferredStatusBarStyle: UIStatusBarStyle {
        if let override = overrideStatusBarStyle { return override }
        return super.preferredStatusBarStyle
    }

    // ─────────────────────────────────────────────────────────────────────
    // Orientation
    // ─────────────────────────────────────────────────────────────────────

    public override var supportedInterfaceOrientations: UIInterfaceOrientationMask {
        return allowLandscape ? .all : .portrait
    }

    public override var shouldAutorotate: Bool {
        return allowLandscape
    }

    // ─────────────────────────────────────────────────────────────────────
    // Home indicator (iPhone X+)
    // ─────────────────────────────────────────────────────────────────────

    public override var prefersHomeIndicatorAutoHidden: Bool {
        return hideHomeIndicator
    }

    // ─────────────────────────────────────────────────────────────────────
    // Safe-area → CSS variables
    // ─────────────────────────────────────────────────────────────────────

    public override func viewSafeAreaInsetsDidChange() {
        super.viewSafeAreaInsetsDidChange()
        publishSafeAreaToWebView()
    }

    public override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        publishSafeAreaToWebView()
    }

    private func publishSafeAreaToWebView() {
        guard let webView = self.webView else { return }
        let i = self.view.safeAreaInsets
        let js = """
        (function () {
            var r = document.documentElement;
            r.style.setProperty('--ios-safe-top',    '\(i.top)px');
            r.style.setProperty('--ios-safe-right',  '\(i.right)px');
            r.style.setProperty('--ios-safe-bottom', '\(i.bottom)px');
            r.style.setProperty('--ios-safe-left',   '\(i.left)px');
            window.dispatchEvent(new CustomEvent('iosSafeAreaUpdated', {
                detail: { top: \(i.top), right: \(i.right), bottom: \(i.bottom), left: \(i.left) }
            }));
        })();
        """
        webView.evaluateJavaScript(js, completionHandler: nil)
    }

    // ─────────────────────────────────────────────────────────────────────
    // Trait changes (dark mode, dynamic type)
    // ─────────────────────────────────────────────────────────────────────

    public override func traitCollectionDidChange(_ previousTraitCollection: UITraitCollection?) {
        super.traitCollectionDidChange(previousTraitCollection)

        let isDark = traitCollection.userInterfaceStyle == .dark
        let js = """
        (function () {
            document.documentElement.setAttribute('data-ios-color-scheme', '\(isDark ? "dark" : "light")');
            window.dispatchEvent(new CustomEvent('iosColorSchemeChanged', {
                detail: { dark: \(isDark) }
            }));
        })();
        """
        self.webView?.evaluateJavaScript(js, completionHandler: nil)
    }
}
