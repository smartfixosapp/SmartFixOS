import SwiftUI

struct OrderStatusPicker: View {
    @Binding var selectedStatus: OrderStatus
    let onSelect: (OrderStatus) -> Void
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            List {
                ForEach(OrderStatus.allCases) { status in
                    Button {
                        onSelect(status)
                        dismiss()
                    } label: {
                        HStack {
                            Circle()
                                .fill(status.color)
                                .frame(width: 12, height: 12)
                            Text(status.label)
                                .foregroundStyle(.primary)
                            Spacer()
                            if status == selectedStatus {
                                Image(systemName: "checkmark")
                                    .foregroundStyle(.accent)
                            }
                            if status.isTerminal {
                                Image(systemName: "flag.fill")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                        }
                    }
                }
            }
            .navigationTitle("Cambiar Estado")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancelar") { dismiss() }
                }
            }
        }
    }
}
