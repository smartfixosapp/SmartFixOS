import Foundation
import Observation
import UserNotifications
import Supabase

@Observable
final class NotificationsViewModel {
    var notifications: [AppNotification] = []
    var isLoading = false
    var error: String?

    var unreadCount: Int {
        notifications.filter { !$0.isRead }.count
    }

    private let env: AppEnvironment

    init(env: AppEnvironment = .shared) {
        self.env = env
    }

    func load() async {
        isLoading = true
        error = nil
        defer { isLoading = false }
        do {
            notifications = try await supabase
                .from("notification")
                .select()
                .eq("tenant_id", value: env.tenantId)
                .order("created_date", ascending: false)
                .limit(50)
                .execute()
                .value
        } catch {
            self.error = "No se pudieron cargar las notificaciones."
        }
    }

    func markAsRead(_ notification: AppNotification) async {
        do {
            try await supabase
                .from("notification")
                .update(["read": AnyJSON.bool(true)])
                .eq("id", value: notification.id)
                .execute()
            if let index = notifications.firstIndex(where: { $0.id == notification.id }) {
                notifications[index].read = true
            }
        } catch { /* silent */ }
    }

    func markAllAsRead() async {
        do {
            try await supabase
                .from("notification")
                .update(["read": AnyJSON.bool(true)])
                .eq("tenant_id", value: env.tenantId)
                .eq("read", value: false)
                .execute()
            for i in notifications.indices {
                notifications[i].read = true
            }
        } catch { /* silent */ }
    }

    // MARK: - APNs Registration

    func requestPushPermission() async {
        let center = UNUserNotificationCenter.current()
        try? await center.requestAuthorization(options: [.alert, .sound, .badge])
    }
}
