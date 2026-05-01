import SwiftUI

struct PrimaryButton: View {
    let title: String
    let systemImage: String?
    let isLoading: Bool
    let action: () -> Void

    init(_ title: String, systemImage: String? = nil, isLoading: Bool = false, action: @escaping () -> Void) {
        self.title = title
        self.systemImage = systemImage
        self.isLoading = isLoading
        self.action = action
    }

    var body: some View {
        Button(action: action) {
            HStack(spacing: Spacing.sm) {
                if isLoading {
                    ProgressView()
                        .progressViewStyle(.circular)
                        .tint(.white)
                        .scaleEffect(0.8)
                } else if let image = systemImage {
                    Image(systemName: image)
                }
                Text(title)
                    .fontWeight(.semibold)
            }
            .frame(maxWidth: .infinity)
            .frame(height: 50)
        }
        .buttonStyle(.borderedProminent)
        .controlSize(.large)
        .disabled(isLoading)
    }
}

struct DestructiveButton: View {
    let title: String
    let action: () -> Void

    var body: some View {
        Button(role: .destructive, action: action) {
            Text(title)
                .frame(maxWidth: .infinity)
                .frame(height: 50)
                .fontWeight(.semibold)
        }
        .buttonStyle(.borderedProminent)
        .tint(.red)
    }
}
