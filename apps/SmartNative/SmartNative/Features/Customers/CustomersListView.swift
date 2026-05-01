import SwiftUI

struct CustomersListView: View {
    @State private var vm = CustomersViewModel()

    var body: some View {
        NavigationStack {
            Group {
                if vm.isLoading && vm.customers.isEmpty {
                    LoadingView()
                } else if vm.filteredCustomers.isEmpty {
                    EmptyStateView(
                        title: vm.searchText.isEmpty ? "Sin clientes" : "Sin resultados",
                        message: vm.searchText.isEmpty ? "Los clientes aparecerán aquí." : "Prueba con otro término.",
                        systemImage: "person.2"
                    )
                } else {
                    List(vm.filteredCustomers) { customer in
                        CustomerRow(customer: customer)
                            .swipeActions(edge: .leading) {
                                if let phone = customer.phone {
                                    Button {
                                        callPhone(phone)
                                    } label: {
                                        Label("Llamar", systemImage: "phone.fill")
                                    }
                                    .tint(.green)
                                }
                            }
                    }
                }
            }
            .navigationTitle("Clientes")
            .searchable(text: $vm.searchText, prompt: "Buscar por nombre, teléfono, email...")
            .toolbar {
                ToolbarItem(placement: .primaryAction) {
                    Button {
                        // TODO: New customer form
                    } label: {
                        Image(systemName: "plus")
                    }
                }
            }
            .task { await vm.load() }
            .refreshable { await vm.load() }
        }
    }

    private func callPhone(_ phone: String) {
        let digits = phone.filter { $0.isNumber }
        if let url = URL(string: "tel:\(digits)") {
            UIApplication.shared.open(url)
        }
    }
}

private struct CustomerRow: View {
    let customer: Customer

    var body: some View {
        HStack(spacing: Spacing.md) {
            Circle()
                .fill(Color(hex: customer.loyaltyTierColor).opacity(0.2))
                .overlay {
                    Text(customer.initials)
                        .font(.callout)
                        .fontWeight(.semibold)
                        .foregroundStyle(Color(hex: customer.loyaltyTierColor))
                }
                .frame(width: 44, height: 44)

            VStack(alignment: .leading, spacing: 2) {
                HStack {
                    Text(customer.name)
                        .font(.subheadline)
                        .fontWeight(.medium)
                    if customer.is_b2b == true {
                        Text("B2B")
                            .font(.caption2)
                            .fontWeight(.bold)
                            .padding(.horizontal, 4)
                            .padding(.vertical, 1)
                            .background(Color.purple.opacity(0.15))
                            .foregroundStyle(.purple)
                            .clipShape(Capsule())
                    }
                }
                Text(customer.displayPhone)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            Spacer()

            VStack(alignment: .trailing, spacing: 2) {
                if let orders = customer.total_orders, orders > 0 {
                    Label("\(orders)", systemImage: "wrench")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                if let spent = customer.total_spent, spent > 0 {
                    Text(spent.asCurrency)
                        .font(.caption2)
                        .foregroundStyle(.tertiary)
                }
            }
        }
        .padding(.vertical, Spacing.xs)
    }
}
