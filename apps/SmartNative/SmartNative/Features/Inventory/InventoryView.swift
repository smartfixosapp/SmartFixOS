import SwiftUI

struct InventoryView: View {
    @State private var vm = InventoryViewModel()

    var body: some View {
        NavigationStack {
            Group {
                if vm.isLoading && vm.products.isEmpty {
                    LoadingView()
                } else if vm.filteredProducts.isEmpty {
                    EmptyStateView(
                        title: "Sin productos",
                        message: "El inventario aparecerá aquí.",
                        systemImage: "shippingbox"
                    )
                } else {
                    productList
                }
            }
            .navigationTitle("Inventario")
            .searchable(text: $vm.searchText, prompt: "Buscar por nombre, SKU, código...")
            .toolbar {
                ToolbarItem(placement: .primaryAction) {
                    Button {
                        // TODO: New product form
                    } label: {
                        Image(systemName: "plus")
                    }
                }
                ToolbarItem(placement: .topBarLeading) {
                    if vm.lowStockCount > 0 {
                        Label("\(vm.lowStockCount) bajo stock", systemImage: "exclamationmark.triangle.fill")
                            .font(.caption)
                            .foregroundStyle(.orange)
                    }
                }
            }
            .task { await vm.load() }
            .refreshable { await vm.load() }
        }
    }

    private var productList: some View {
        List {
            // Category filter
            if !vm.categories.isEmpty {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: Spacing.sm) {
                        FilterChip(label: "Todos", isSelected: vm.selectedCategory == nil) {
                            vm.selectedCategory = nil
                        }
                        ForEach(vm.categories, id: \.self) { cat in
                            FilterChip(label: cat, isSelected: vm.selectedCategory == cat) {
                                vm.selectedCategory = vm.selectedCategory == cat ? nil : cat
                            }
                        }
                    }
                    .padding(.horizontal, Spacing.xs)
                }
                .listRowInsets(EdgeInsets())
                .listRowBackground(Color.clear)
                .padding(.vertical, Spacing.xs)
            }

            ForEach(vm.filteredProducts) { product in
                ProductRow(product: product)
            }
        }
        .listStyle(.plain)
    }
}

private struct FilterChip: View {
    let label: String
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(label, action: action)
            .font(.subheadline)
            .padding(.horizontal, Spacing.md)
            .padding(.vertical, Spacing.xs)
            .background(isSelected ? Color.accentColor : Color.appSecondaryBackground)
            .foregroundStyle(isSelected ? .white : .primary)
            .clipShape(Capsule())
    }
}

private struct ProductRow: View {
    let product: Product

    var body: some View {
        HStack(spacing: Spacing.md) {
            RoundedRectangle(cornerRadius: CornerRadius.sm)
                .fill(product.isLowStock ? Color.orange.opacity(0.15) : Color.appTertiaryBackground)
                .frame(width: 44, height: 44)
                .overlay {
                    Image(systemName: product.productType == .service ? "bolt.fill" : "shippingbox.fill")
                        .foregroundStyle(product.isLowStock ? .orange : .secondary)
                }

            VStack(alignment: .leading, spacing: 2) {
                Text(product.name)
                    .font(.subheadline)
                    .fontWeight(.medium)
                HStack(spacing: Spacing.xs) {
                    if let sku = product.sku {
                        Text(sku)
                            .font(.caption2)
                            .foregroundStyle(.tertiary)
                    }
                    if let cat = product.category {
                        Text("·")
                            .foregroundStyle(.tertiary)
                        Text(cat)
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                    }
                }
            }

            Spacer()

            VStack(alignment: .trailing, spacing: 2) {
                Text(product.price.asCurrency)
                    .font(.subheadline)
                    .fontWeight(.semibold)
                if let stock = product.stock {
                    HStack(spacing: 2) {
                        if product.isLowStock {
                            Image(systemName: "exclamationmark.triangle.fill")
                                .font(.caption2)
                                .foregroundStyle(.orange)
                        }
                        Text("\(stock) uds")
                            .font(.caption)
                            .foregroundStyle(product.isLowStock ? .orange : .secondary)
                    }
                }
            }
        }
        .padding(.vertical, Spacing.xs)
    }
}
