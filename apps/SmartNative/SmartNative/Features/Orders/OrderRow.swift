import SwiftUI

struct OrderRow: View {
    let order: Order

    var body: some View {
        HStack(spacing: Spacing.md) {
            // Status indicator
            RoundedRectangle(cornerRadius: 3)
                .fill(order.orderStatus.color)
                .frame(width: 4)
                .frame(maxHeight: .infinity)

            VStack(alignment: .leading, spacing: Spacing.xs) {
                HStack {
                    Text(order.order_number)
                        .font(.headline)
                        .fontWeight(.semibold)
                    Spacer()
                    StatusBadge(status: order.orderStatus)
                }

                Text(order.customer_name)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)

                HStack(spacing: Spacing.sm) {
                    Label(order.device_type, systemImage: "iphone")
                        .font(.caption)
                        .foregroundStyle(.secondary)

                    if let model = order.device_model {
                        Text("·")
                            .foregroundStyle(.tertiary)
                        Text(model)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }

                    Spacer()

                    if let date = order.created_date {
                        Text(date.relativeString)
                            .font(.caption2)
                            .foregroundStyle(.tertiary)
                    }
                }

                if let estimate = order.cost_estimate, estimate > 0 {
                    HStack {
                        Spacer()
                        Text(estimate.asCurrency)
                            .font(.caption)
                            .fontWeight(.medium)
                            .foregroundStyle(.primary)
                    }
                }
            }
        }
        .padding(.vertical, Spacing.xs)
    }
}
