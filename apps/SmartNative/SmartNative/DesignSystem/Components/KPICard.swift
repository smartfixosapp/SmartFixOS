import SwiftUI

struct KPICard: View {
    let title: String
    let value: String
    let systemImage: String
    let color: Color
    var subtitle: String? = nil

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.sm) {
            HStack {
                Image(systemName: systemImage)
                    .font(.title2)
                    .foregroundStyle(color)
                Spacer()
            }
            Text(value)
                .font(.system(.title2, design: .rounded))
                .fontWeight(.bold)
                .foregroundStyle(.primary)
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                if let subtitle = subtitle {
                    Text(subtitle)
                        .font(.caption2)
                        .foregroundStyle(.tertiary)
                }
            }
        }
        .padding(Spacing.base)
        .background(Color.appSecondaryBackground)
        .clipShape(RoundedRectangle(cornerRadius: CornerRadius.lg))
    }
}
