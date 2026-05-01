import Foundation
import Observation
import Supabase

@Observable
final class FinancialViewModel {
    var transactions: [Transaction] = []
    var isLoading = false
    var error: String?
    var selectedPeriod: Period = .month

    enum Period: String, CaseIterable {
        case today = "Hoy"
        case week = "Semana"
        case month = "Mes"
        case year = "Año"
    }

    var income: Double {
        transactions.filter { $0.isIncome }.reduce(0) { $0 + $1.amount }
    }

    var expenses: Double {
        transactions.filter { $0.transactionType == .expense }.reduce(0) { $0 + $1.amount }
    }

    var profit: Double { income - expenses }

    var transactionsByPaymentMethod: [(method: String, amount: Double)] {
        let grouped = Dictionary(grouping: transactions.filter { $0.isIncome }) { $0.payment_method ?? "other" }
        return grouped.map { (method: $0.key, amount: $0.value.reduce(0) { $0 + $1.amount }) }
            .sorted { $0.amount > $1.amount }
    }

    private let env: AppEnvironment

    init(env: AppEnvironment = .shared) {
        self.env = env
    }

    func load() async {
        isLoading = true
        error = nil
        defer { isLoading = false }
        do {
            let startDate = periodStartDate
            transactions = try await supabase
                .from("transaction")
                .select()
                .eq("tenant_id", value: env.tenantId)
                .gte("created_date", value: AppDateFormatter.isoFull.string(from: startDate))
                .order("created_date", ascending: false)
                .execute()
                .value
        } catch {
            self.error = "No se pudieron cargar las transacciones."
        }
    }

    private var periodStartDate: Date {
        let calendar = Calendar.current
        let now = Date()
        switch selectedPeriod {
        case .today: return calendar.startOfDay(for: now)
        case .week: return calendar.date(byAdding: .day, value: -7, to: now) ?? now
        case .month: return calendar.date(from: calendar.dateComponents([.year, .month], from: now)) ?? now
        case .year: return calendar.date(from: calendar.dateComponents([.year], from: now)) ?? now
        }
    }
}
