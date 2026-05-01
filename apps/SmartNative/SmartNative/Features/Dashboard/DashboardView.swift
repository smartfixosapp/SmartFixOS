import SwiftUI
import Charts

struct DashboardView: View {
    @State private var vm = DashboardViewModel()
    @Environment(AppEnvironment.self) private var env

    let columns = [GridItem(.flexible()), GridItem(.flexible())]

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: Spacing.xl) {
                    if vm.isLoading && vm.kpis.totalRevenueMonth == 0 {
                        LoadingView()
                            .frame(height: 200)
                    } else {
                        kpiGrid
                        revenueChart
                        recentTransactionsList
                    }
                }
                .padding(Spacing.base)
            }
            .background(Color.appGroupedBackground)
            .refreshable { await vm.load() }
            .navigationTitle("Dashboard")
            .task { await vm.load() }
        }
    }

    private var kpiGrid: some View {
        LazyVGrid(columns: columns, spacing: Spacing.md) {
            KPICard(
                title: "Órdenes Hoy",
                value: "\(vm.kpis.totalOrdersToday)",
                systemImage: "wrench.and.screwdriver",
                color: .blue
            )
            KPICard(
                title: "Activas",
                value: "\(vm.kpis.activeOrders)",
                systemImage: "clock.arrow.circlepath",
                color: .orange
            )
            KPICard(
                title: "Listas",
                value: "\(vm.kpis.readyForPickup)",
                systemImage: "checkmark.circle.fill",
                color: .green
            )
            KPICard(
                title: "Ingresos Hoy",
                value: vm.kpis.totalRevenueToday.asCurrency,
                systemImage: "dollarsign.circle.fill",
                color: .cyan
            )
            KPICard(
                title: "Ingresos del Mes",
                value: vm.kpis.totalRevenueMonth.asCurrency,
                systemImage: "chart.line.uptrend.xyaxis",
                color: .purple,
                subtitle: "Mes actual"
            )
            KPICard(
                title: "Nuevos Clientes",
                value: "\(vm.kpis.newCustomersThisMonth)",
                systemImage: "person.badge.plus",
                color: .pink
            )
        }
    }

    @ViewBuilder
    private var revenueChart: some View {
        if !vm.recentTransactions.isEmpty {
            VStack(alignment: .leading, spacing: Spacing.md) {
                Text("Transacciones Recientes")
                    .font(.headline)
                    .padding(.horizontal, Spacing.xs)

                let chartData = vm.recentTransactions.prefix(10)

                Chart(Array(chartData.enumerated()), id: \.offset) { index, tx in
                    BarMark(
                        x: .value("Índice", index),
                        y: .value("Monto", tx.amount)
                    )
                    .foregroundStyle(tx.isIncome ? Color.green : Color.red)
                }
                .chartXAxis(.hidden)
                .frame(height: 150)
                .padding()
                .background(Color.appSecondaryBackground)
                .clipShape(RoundedRectangle(cornerRadius: CornerRadius.lg))
            }
        }
    }

    @ViewBuilder
    private var recentTransactionsList: some View {
        if !vm.recentTransactions.isEmpty {
            VStack(alignment: .leading, spacing: Spacing.sm) {
                Text("Últimas Transacciones")
                    .font(.headline)
                    .padding(.horizontal, Spacing.xs)

                VStack(spacing: 1) {
                    ForEach(vm.recentTransactions.prefix(5)) { tx in
                        TransactionRow(transaction: tx)
                    }
                }
                .background(Color.appSecondaryBackground)
                .clipShape(RoundedRectangle(cornerRadius: CornerRadius.lg))
            }
        }
    }
}

private struct TransactionRow: View {
    let transaction: Transaction

    var body: some View {
        HStack {
            Image(systemName: transaction.isIncome ? "arrow.down.circle.fill" : "arrow.up.circle.fill")
                .foregroundStyle(transaction.isIncome ? .green : .red)
                .font(.title3)

            VStack(alignment: .leading, spacing: 2) {
                Text(transaction.description ?? transaction.transactionType.label)
                    .font(.subheadline)
                    .fontWeight(.medium)
                if let date = transaction.created_date {
                    Text(date.displayString)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }

            Spacer()

            Text(transaction.amount.asCurrency)
                .font(.subheadline)
                .fontWeight(.semibold)
                .foregroundStyle(transaction.isIncome ? .green : .red)
        }
        .padding(.horizontal, Spacing.md)
        .padding(.vertical, Spacing.sm)
    }
}
