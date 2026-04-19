import UIKit
import WebKit
import Capacitor

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // Clear only HTTP caches so new JS bundles load after updates,
        // but PRESERVE localStorage / cookies / IndexedDB so the Supabase
        // session survives app kills from multitasking.
        let dataStore = WKWebsiteDataStore.default()
        let dataTypes: Set<String> = [
            WKWebsiteDataTypeDiskCache,
            WKWebsiteDataTypeMemoryCache,
            WKWebsiteDataTypeOfflineWebApplicationCache,
        ]
        let date = Date(timeIntervalSince1970: 0)
        dataStore.removeData(ofTypes: dataTypes, modifiedSince: date) {
            print("WebView HTTP cache cleared (session preserved)")
        }
        return true
    }

    func applicationWillResignActive(_ application: UIApplication) {
        // Sent when the application is about to move from active to inactive state. This can occur for certain types of temporary interruptions (such as an incoming phone call or SMS message) or when the user quits the application and it begins the transition to the background state.
        // Use this method to pause ongoing tasks, disable timers, and invalidate graphics rendering callbacks. Games should use this method to pause the game.
    }

    func applicationDidEnterBackground(_ application: UIApplication) {
        // Use this method to release shared resources, save user data, invalidate timers, and store enough application state information to restore your application to its current state in case it is terminated later.
        // If your application supports background execution, this method is called instead of applicationWillTerminate: when the user quits.
    }

    func applicationWillEnterForeground(_ application: UIApplication) {
        // Called as part of the transition from the background to the active state; here you can undo many of the changes made on entering the background.
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
        // Restart any tasks that were paused (or not yet started) while the application was inactive. If the application was previously in the background, optionally refresh the user interface.
    }

    func applicationWillTerminate(_ application: UIApplication) {
        // Called when the application is about to terminate. Save data if appropriate. See also applicationDidEnterBackground:.
    }

    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        // Called when the app was launched with a url. Feel free to add additional processing here,
        // but if you want the App API to support tracking app url opens, make sure to keep this call
        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
    }

    func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
        // Called when the app was launched with an activity, including Universal Links.
        // Feel free to add additional processing here, but if you want the App API to support
        // tracking app url opens, make sure to keep this call
        return ApplicationDelegateProxy.shared.application(application, continue: userActivity, restorationHandler: restorationHandler)
    }

}

// iOS 13+ scene lifecycle support.
// Required to avoid runtime asserts when using Main.storyboard.
class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    // Cold-start: app was killed and is being launched fresh by a URL open.
    // The URL arrives in connectionOptions.urlContexts here, NOT in openURLContexts.
    // Without forwarding it, the OAuth deep link is silently dropped on cold start.
    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        if let urlContext = connectionOptions.urlContexts.first {
            let url = urlContext.url
            print("⚡️ [SceneDelegate] willConnectTo cold-start URL → \(url.absoluteString)")
            // Defer slightly so Capacitor finishes bootstrapping before we hand it the URL.
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
                _ = ApplicationDelegateProxy.shared.application(
                    UIApplication.shared,
                    open: url,
                    options: [:]
                )
            }
        }
    }

    // Forward custom URL scheme opens (e.g. com.smartfixos.pr911://) to Capacitor.
    // With the scene-based lifecycle (iOS 13+), URL opens arrive here — NOT in
    // AppDelegate.application(_:open:options:). Without this, appUrlOpen never fires
    // when the app was already running in background.
    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        guard let url = URLContexts.first?.url else {
            print("⚡️ [SceneDelegate] openURLContexts called but no URL found")
            return
        }
        print("⚡️ [SceneDelegate] openURLContexts → \(url.absoluteString)")
        _ = ApplicationDelegateProxy.shared.application(
            UIApplication.shared,
            open: url,
            options: [:]
        )
    }

    // Universal Links cold-start support (in case OAuth provider issues a Universal Link).
    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        print("⚡️ [SceneDelegate] continue userActivity → \(userActivity.activityType)")
        _ = ApplicationDelegateProxy.shared.application(
            UIApplication.shared,
            continue: userActivity,
            restorationHandler: { _ in }
        )
    }
}
