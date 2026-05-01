import SwiftUI

struct LoadingView: View {
    var message: String = "Cargando..."

    var body: some View {
        VStack(spacing: Spacing.base) {
            ProgressView()
                .scaleEffect(1.2)
            Text(message)
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

struct EmptyStateView: View {
    let title: String
    let message: String
    let systemImage: String
    var actionTitle: String? = nil
    var action: (() -> Void)? = nil

    var body: some View {
        VStack(spacing: Spacing.lg) {
            Image(systemName: systemImage)
                .font(.system(size: 56))
                .foregroundStyle(.quaternary)
            VStack(spacing: Spacing.xs) {
                Text(title)
                    .font(.headline)
                    .foregroundStyle(.primary)
                Text(message)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
            }
            if let title = actionTitle, let action = action {
                Button(title, action: action)
                    .buttonStyle(.bordered)
            }
        }
        .padding(Spacing.xxl)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

struct ErrorBanner: View {
    let message: String

    var body: some View {
        HStack(spacing: Spacing.sm) {
            Image(systemName: "exclamationmark.triangle.fill")
                .foregroundStyle(.red)
            Text(message)
                .font(.subheadline)
                .foregroundStyle(.primary)
            Spacer()
        }
        .padding(Spacing.md)
        .background(Color.red.opacity(0.1))
        .clipShape(RoundedRectangle(cornerRadius: CornerRadius.md))
    }
}
