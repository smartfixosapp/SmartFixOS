import Foundation
import UIKit
import WebKit

/// LiquidGlassWebContainer
///
/// Wraps the Capacitor WKWebView in a translucent layer that adopts the
/// iOS 26 Liquid Glass material when available, and falls back to a
/// classic `UIBlurEffect` (system thin material) on iOS 15..25.
///
/// The result is the same visual SmartFixOS gets when modals or sheets
/// blur the background — but extended behind the entire WebView, so
/// status-bar / dynamic-island regions blend with the page underneath
/// instead of showing a hard edge.
///
/// Used by NativeUIPlugin.enableLiquidGlass.
public final class LiquidGlassWebContainer {

    /// Static check the JS side can query.
    public static var isSupported: Bool {
        if #available(iOS 26.0, *) { return true }
        return false
    }

    private weak var webView: WKWebView?
    private let intensity: CGFloat
    private var glassLayer: UIView?

    public init(webView: WKWebView, intensity: CGFloat) {
        self.webView = webView
        self.intensity = max(0, min(1, intensity))
    }

    public func applyToWebView() {
        guard let webView = self.webView, let parent = webView.superview else { return }

        let glass = makeGlassView(frame: parent.bounds)
        glass.translatesAutoresizingMaskIntoConstraints = false
        glass.isUserInteractionEnabled = false  // touches pass through to WebView

        // Insert the glass BEHIND the WebView so the WebView remains
        // the topmost interactive layer; the glass shows through any
        // transparent regions of the page.
        parent.insertSubview(glass, belowSubview: webView)

        NSLayoutConstraint.activate([
            glass.topAnchor.constraint(equalTo: parent.topAnchor),
            glass.bottomAnchor.constraint(equalTo: parent.bottomAnchor),
            glass.leadingAnchor.constraint(equalTo: parent.leadingAnchor),
            glass.trailingAnchor.constraint(equalTo: parent.trailingAnchor),
        ])

        // Make the WebView background transparent so the glass is visible.
        webView.isOpaque = false
        webView.backgroundColor = .clear
        webView.scrollView.backgroundColor = .clear

        self.glassLayer = glass
    }

    public func removeFromWebView() {
        glassLayer?.removeFromSuperview()
        glassLayer = nil
        // Restore an opaque background so the WebView paints normally.
        webView?.isOpaque = true
        webView?.backgroundColor = .systemBackground
        webView?.scrollView.backgroundColor = .systemBackground
    }

    // ─────────────────────────────────────────────────────────────────────
    // View construction
    // ─────────────────────────────────────────────────────────────────────

    private func makeGlassView(frame: CGRect) -> UIView {
        // iOS 26 introduces a Liquid Glass material. We detect it at
        // runtime via the new UIVisualEffect API; if unavailable, fall
        // back to UIBlurEffect with the system's thin material.
        if #available(iOS 26.0, *) {
            return makeLiquidGlassView(frame: frame)
        }
        return makeBlurFallback(frame: frame)
    }

    @available(iOS 26.0, *)
    private func makeLiquidGlassView(frame: CGRect) -> UIView {
        // The exact symbol may differ between iOS 26 betas; we use a
        // resilient lookup so the project still compiles on older Xcode.
        let cls: AnyClass? = NSClassFromString("UIGlassEffect")
        if let glassClass = cls as? UIVisualEffect.Type,
           let effect = (glassClass as? NSObject.Type)?.perform(NSSelectorFromString("regularEffect"))?.takeUnretainedValue() as? UIVisualEffect {
            let view = UIVisualEffectView(effect: effect)
            view.frame = frame
            view.alpha = intensity
            return view
        }
        // If the runtime symbol isn't present (older iOS 26 beta), use
        // the thinMaterial fallback.
        return makeBlurFallback(frame: frame)
    }

    private func makeBlurFallback(frame: CGRect) -> UIView {
        let style: UIBlurEffect.Style
        if #available(iOS 13.0, *) {
            style = .systemThinMaterial
        } else {
            style = .light
        }
        let blur = UIBlurEffect(style: style)
        let view = UIVisualEffectView(effect: blur)
        view.frame = frame
        view.alpha = intensity
        return view
    }
}
