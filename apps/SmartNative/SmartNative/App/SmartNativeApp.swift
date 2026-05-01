import SwiftUI

@main
struct SmartNativeApp: App {
    @State private var env = AppEnvironment.shared

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(env)
                .onOpenURL { url in
                    handleDeepLink(url)
                }
        }
    }

    private func handleDeepLink(_ url: URL) {
        // Handle com.smartfixos.pr911:// deep links
        // Auth callbacks are handled by supabase-swift automatically
        Task {
            try? await supabase.auth.session
        }
    }
}

struct RootView: View {
    @Environment(AppEnvironment.self) private var env

    var body: some View {
        if env.isAuthenticated {
            MainTabView()
        } else {
            LoginView()
        }
    }
}
