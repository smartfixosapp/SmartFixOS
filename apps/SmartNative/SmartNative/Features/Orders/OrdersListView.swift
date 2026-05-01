import SwiftUI

struct OrdersListView: View {
    @State private var vm = OrdersViewModel()
    @State private var showingQueue = false

    var body: some View {
        NavigationStack {
            Group {
                if vm.isLoading && vm.orders.isEmpty {
                    LoadingView()
                } else if vm.filteredOrders.isEmpty {
                    emptyState
                } else {
                    ordersList
                }
            }
            .navigationTitle("Órdenes")
            .searchable(text: $vm.searchText, placement: .navigationBarDrawer(displayMode: .always), prompt: "Buscar por # orden, cliente, modelo...")
            .onChange(of: vm.searchText) { vm.applyFilters() }
            .toolbar {
                ToolbarItem(placement: .primaryAction) {
                    Button {
                        showingQueue = true
                    } label: {
                        Label("Cola", systemImage: "list.bullet.clipboard")
                    }
                }
            }
            .task { await vm.load() }
        }
        .sheet(isPresented: $showingQueue) {
            WorkQueueView(vm: vm)
        }
    }

    private var ordersList: some View {
        List {
            filterBar
            ForEach(vm.filteredOrders) { order in
                NavigationLink(value: order) {
                    OrderRow(order: order)
                }
                .swipeActions(edge: .trailing, allowsFullSwipe: false) {
                    Button {
                        Task {
                            await vm.updateStatus(order: order, newStatus: .readyForPickup)
                        }
                    } label: {
                        Label("Listo", systemImage: "checkmark.circle.fill")
                    }
                    .tint(.green)
                }
            }
        }
        .listStyle(.plain)
        .refreshable { await vm.load() }
        .navigationDestination(for: Order.self) { order in
            OrderDetailView(order: order)
        }
    }

    private var filterBar: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: Spacing.sm) {
                ForEach(OrderFilter.allCases) { filter in
                    Button(filter.rawValue) {
                        vm.selectedFilter = filter
                        vm.applyFilters()
                    }
                    .font(.subheadline)
                    .fontWeight(vm.selectedFilter == filter ? .semibold : .regular)
                    .padding(.horizontal, Spacing.md)
                    .padding(.vertical, Spacing.xs)
                    .background(vm.selectedFilter == filter ? Color.accentColor : Color.appSecondaryBackground)
                    .foregroundStyle(vm.selectedFilter == filter ? .white : .primary)
                    .clipShape(Capsule())
                }
            }
            .padding(.horizontal, Spacing.xs)
            .padding(.vertical, Spacing.xs)
        }
        .listRowInsets(EdgeInsets())
        .listRowBackground(Color.clear)
    }

    private var emptyState: some View {
        EmptyStateView(
            title: vm.searchText.isEmpty ? "Sin órdenes" : "Sin resultados",
            message: vm.searchText.isEmpty ? "Las órdenes de trabajo aparecerán aquí." : "Intenta con otro término de búsqueda.",
            systemImage: "wrench.and.screwdriver"
        )
    }
}

// MARK: - Work Queue Sheet

struct WorkQueueView: View {
    let vm: OrdersViewModel
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            let queueOrders = vm.orders.filter { ["intake","diagnosing","in_progress","warranty"].contains($0.status) }
                .sorted { $0.order_number < $1.order_number }

            Group {
                if queueOrders.isEmpty {
                    EmptyStateView(
                        title: "Cola vacía",
                        message: "No hay órdenes activas en cola.",
                        systemImage: "list.bullet.clipboard"
                    )
                } else {
                    List(queueOrders) { order in
                        OrderRow(order: order)
                    }
                }
            }
            .navigationTitle("Cola de Trabajo")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Cerrar") { dismiss() }
                }
            }
        }
    }
}
