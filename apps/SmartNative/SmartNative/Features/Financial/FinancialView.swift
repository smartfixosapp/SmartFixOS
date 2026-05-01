import SwiftUI
import Charts

struct FinancialView: View {
    @State private var vm = FinancialViewModel()
    @Environment(AppEnvironment.self) private var env

    var body: some View {
        NavigationStack {
            Group {
                if vm.isLoading && vm.transactions.isEmpty {
                    LoadingView()
                } else {
                    financialContent
                }
            }
            .navigationTitle("Financiero")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Picker("Período", selection: $vm.selectedPeriod) {
                        ForEach(FinancialViewModel.Period.allCases, id: \.self) { p in
                            Text(p.rawValue).tag(p)
                        }
                    }
                    .pickerStyle(.menu)
                }
            }
            .onChange(of: vm.selectedPeriod) { Task { await vm.load() } }
            .task { await vm.load() }
            .refreshable { await vm.load() }
        }
    }

    private var financialContent: some View {
        List {
            // Summary cards
            Section {
                HStack(spacing: Spacing.md) {
                    SummaryCard(
                        title: "Ingresos",
                        amount: vm.income,
                        color: .green,
                        systemImage: "arrow.down.circle.fill"
                    )
                    SummaryCard(
                        title: "Gastos",
                        amount: vm.expenses,
                        color: .red,
                        systemImage: "arrow.up.circle.fill"
                    )
                }
                .listRowInsets(EdgeInsets())
                .listRowBackground(Color.clear)

                HStack {
                    Text("Ganancia neta")
                        .font(.headline)
                    Spacer()
                    Text(vm.profit.asCurrency)
                        .font(.headline)
                        .fontWeight(.bold)
                        .foregroundStyle(vm.profit >= 0 ? .green : .red)
                }
                .padding(Spacing.md)
                .background(vm.profit >= 0 ? Color.green.opacity(0.1) : Color.red.opacity(0.1))
                .clipShape(RoundedRectangle(cornerRadius: CornerRadius.md))
                .listRowInsets(EdgeInsets())
                .listRowBackground(Color.clear)
            } header: {
                Text("Resumen — \(vm.selectedPeriod.rawValue)")
            }

            // Payment method breakdown
            if !vm.transactionsByPaymentMethod.isEmpty {
                Section("Por Método de Pago") {
                    Chart(vm.transactionsByPaymentMethod, id: \.method) { item in
                        SectorMark(
                            angle: .value("Monto", item.amount),
                            innerRadius: .ratio(0.6)
                        )
                        .foregroundStyle(by: .value("Método", PaymentMethod(rawValue: item.method)?.label ?? item.method))
                    }
                    .frame(height: 180)
                    .listRowInsets(EdgeInsets(top: 8, leading: 0, bottom: 8, trailing: 0))

                    ForEach(vm.transactionsByPaymentMethod, id: \.method) { item in
                        HStack {
                            Image(systemName: PaymentMethod(rawValue: item.method)?.systemImage ?? "creditcard")
                                .foregroundStyle(.secondary)
                            Text(PaymentMethod(rawValue: item.method)?.label ?? item.method)
                            Spacer()
                            Text(item.amount.asCurrency)
                                .fontWeight(.medium)
                        }
                    }
                }
            }

            // Transactions list
            Section("Transacciones") {
                ForEach(vm.transactions) { tx in
                    FinancialTransactionRow(transaction: tx)
                }
            }
        }
        .listStyle(.insetGrouped)
    }
}

private struct SummaryCard: View {
    let title: String
    let amount: Double
    let color: Color
    let systemImage: String

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.xs) {
            Image(systemName: systemImage)
                .foregroundStyle(color)
                .font(.title3)
            Text(amount.asCurrency)
                .font(.system(.headline, design: .rounded))
                .fontWeight(.bold)
            Text(title)
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(Spacing.md)
        .background(color.opacity(0.1))
        .clipShape(RoundedRectangle(cornerRadius: CornerRadius.md))
    }
}

private struct FinancialTransactionRow: View {
    let transaction: Transaction

    var body: some View {
        HStack {
            Image(systemName: transaction.isIncome ? "arrow.down.circle.fill" : "arrow.up.circle.fill")
                .foregroundStyle(transaction.isIncome ? .green : .red)
            VStack(alignment: .leading) {
                Text(transaction.description ?? transaction.transactionType.label)
                    .font(.subheadline)
                if let date = transaction.created_date {
                    Text(date.displayString)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
            Spacer()
            Text(transaction.amount.asCurrency)
                .fontWeight(.medium)
                .foregroundStyle(transaction.isIncome ? .green : .red)
        }
    }
}
