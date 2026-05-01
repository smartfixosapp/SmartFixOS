import SwiftUI

struct StatusBadge: View {
    let status: OrderStatus

    var body: some View {
        Text(status.label)
            .font(.caption)
            .fontWeight(.medium)
            .padding(.horizontal, Spacing.sm)
            .padding(.vertical, Spacing.xs)
            .background(status.color.opacity(0.15))
            .foregroundStyle(status.color)
            .clipShape(Capsule())
    }
}

struct PriorityBadge: View {
    let priority: OrderPriority

    var body: some View {
        Label(priority.label, systemImage: priority == .urgent ? "exclamationmark.2" : "arrow.up")
            .font(.caption2)
            .fontWeight(.semibold)
            .padding(.horizontal, Spacing.xs)
            .padding(.vertical, 2)
            .background(priority.color.opacity(0.15))
            .foregroundStyle(priority.color)
            .clipShape(Capsule())
    }
}
