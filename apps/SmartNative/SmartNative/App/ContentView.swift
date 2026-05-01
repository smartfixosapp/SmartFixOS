import SwiftUI

struct MainTabView: View {
    @Environment(AppEnvironment.self) private var env
    @State private var selectedTab = 0

    var body: some View {
        TabView(selection: $selectedTab) {
            Tab("Dashboard", systemImage: "chart.bar.fill", value: 0) {
                DashboardView()
            }

            Tab("Órdenes", systemImage: "wrench.and.screwdriver.fill", value: 1) {
                OrdersListView()
            }

            Tab("Clientes", systemImage: "person.2.fill", value: 2) {
                CustomersListView()
            }

            Tab("Inventario", systemImage: "shippingbox.fill", value: 3) {
                InventoryView()
            }

            Tab("Más", systemImage: "ellipsis.circle.fill", value: 4) {
                MoreView()
            }
        }
        .tabViewStyle(.automatic)
    }
}

struct MoreView: View {
    @Environment(AppEnvironment.self) private var env

    var body: some View {
        NavigationStack {
            List {
                Section {
                    NavigationLink {
                        FinancialView()
                    } label: {
                        Label("Financiero", systemImage: "chart.pie.fill")
                    }

                    NavigationLink {
                        NotificationsView()
                    } label: {
                        Label("Notificaciones", systemImage: "bell.fill")
                    }
                }

                Section {
                    if env.canAccessFinancials {
                        NavigationLink {
                            Text("Caja — Próximamente")
                                .foregroundStyle(.secondary)
                        } label: {
                            Label("Caja", systemImage: "dollarsign.circle.fill")
                        }
                    }

                    NavigationLink {
                        Text("Citas — Próximamente")
                            .foregroundStyle(.secondary)
                    } label: {
                        Label("Citas", systemImage: "calendar.badge.clock")
                    }
                }

                Section {
                    NavigationLink {
                        SettingsView()
                    } label: {
                        Label("Configuración", systemImage: "gear")
                    }
                }
            }
            .navigationTitle("Más")
            .listStyle(.insetGrouped)
        }
    }
}
