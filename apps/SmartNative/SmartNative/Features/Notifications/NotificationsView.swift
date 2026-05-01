import SwiftUI

struct NotificationsView: View {
    @State private var vm = NotificationsViewModel()

    var body: some View {
        NavigationStack {
            Group {
                if vm.isLoading && vm.notifications.isEmpty {
                    LoadingView()
                } else if vm.notifications.isEmpty {
                    EmptyStateView(
                        title: "Sin notificaciones",
                        message: "Las notificaciones aparecerán aquí.",
                        systemImage: "bell.slash"
                    )
                } else {
                    notificationList
                }
            }
            .navigationTitle("Notificaciones")
            .toolbar {
                if vm.unreadCount > 0 {
                    ToolbarItem(placement: .primaryAction) {
                        Button("Marcar leídas") {
                            Task { await vm.markAllAsRead() }
                        }
                    }
                }
            }
            .task {
                await vm.load()
                await vm.requestPushPermission()
            }
            .refreshable { await vm.load() }
        }
    }

    private var notificationList: some View {
        List {
            ForEach(vm.notifications) { notification in
                NotificationRow(notification: notification)
                    .contentShape(Rectangle())
                    .onTapGesture {
                        if !notification.isRead {
                            Task { await vm.markAsRead(notification) }
                        }
                    }
                    .listRowBackground(notification.isRead ? Color.clear : Color.accentColor.opacity(0.05))
            }
        }
        .listStyle(.plain)
    }
}

private struct NotificationRow: View {
    let notification: AppNotification

    var body: some View {
        HStack(alignment: .top, spacing: Spacing.md) {
            Circle()
                .fill(Color.accentColor.opacity(0.15))
                .frame(width: 40, height: 40)
                .overlay {
                    Image(systemName: notification.notificationType.systemImage)
                        .foregroundStyle(.accent)
                        .font(.callout)
                }

            VStack(alignment: .leading, spacing: Spacing.xs) {
                HStack {
                    Text(notification.title)
                        .font(.subheadline)
                        .fontWeight(notification.isRead ? .regular : .semibold)
                    Spacer()
                    if !notification.isRead {
                        Circle()
                            .fill(Color.accentColor)
                            .frame(width: 8, height: 8)
                    }
                }
                if let message = notification.message {
                    Text(message)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .lineLimit(2)
                }
                Text(notification.timeAgo)
                    .font(.caption2)
                    .foregroundStyle(.tertiary)
            }
        }
        .padding(.vertical, Spacing.xs)
    }
}
