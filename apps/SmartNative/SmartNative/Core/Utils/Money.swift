import Foundation

enum Money {
    static let taxRate: Double = 0.115 // IVU Puerto Rico

    static func formatted(_ amount: Double) -> String {
        formatter.string(from: NSNumber(value: amount)) ?? "$0.00"
    }

    static func withTax(_ amount: Double) -> Double {
        amount * (1 + taxRate)
    }

    static func taxAmount(for subtotal: Double) -> Double {
        subtotal * taxRate
    }

    private static let formatter: NumberFormatter = {
        let f = NumberFormatter()
        f.numberStyle = .currency
        f.currencyCode = "USD"
        f.locale = Locale(identifier: "es_PR")
        return f
    }()
}

extension Double {
    var asCurrency: String { Money.formatted(self) }
}
