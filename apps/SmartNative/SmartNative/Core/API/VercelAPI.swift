import Foundation

// MARK: - Vercel API Client (cloud functions)

actor VercelAPI {
    static let shared = VercelAPI()
    private let baseURL = "https://smart-fix-os-smart.vercel.app"
    private let session = URLSession.shared

    // MARK: - Cash Register

    struct CashRegisterRequest: Encodable {
        let action: String
        let tenantId: String
        let userId: String
        let userName: String?
        let amount: Double?
        let denominations: [String: Double]?
        let paymentMethod: String?
        let saleData: SalePayload?

        struct SalePayload: Encodable {
            let items: [[String: String]]
            let subtotal: Double
            let taxAmount: Double
            let total: Double
            let paymentMethod: String
            let cashReceived: Double?
            let changeDue: Double?
            let orderId: String?
        }
    }

    func openCashRegister(tenantId: String, userId: String, userName: String, denominations: [String: Double]) async throws -> [String: Any] {
        let payload = CashRegisterRequest(
            action: "open",
            tenantId: tenantId,
            userId: userId,
            userName: userName,
            amount: denominations.values.reduce(0, +),
            denominations: denominations,
            paymentMethod: nil,
            saleData: nil
        )
        return try await post(endpoint: "/api/cash-register", body: payload)
    }

    func closeCashRegister(tenantId: String, userId: String, denominations: [String: Double]) async throws -> [String: Any] {
        let payload = CashRegisterRequest(
            action: "close",
            tenantId: tenantId,
            userId: userId,
            userName: nil,
            amount: denominations.values.reduce(0, +),
            denominations: denominations,
            paymentMethod: nil,
            saleData: nil
        )
        return try await post(endpoint: "/api/cash-register", body: payload)
    }

    func recordSale(cart: POSCart, tenantId: String, userId: String, orderId: String? = nil) async throws -> [String: Any] {
        let items = cart.items.map { item in
            [
                "id": item.product.id.uuidString,
                "name": item.product.name,
                "quantity": String(item.quantity),
                "price": String(item.product.price)
            ]
        }
        let salePayload = CashRegisterRequest.SalePayload(
            items: items,
            subtotal: cart.subtotal,
            taxAmount: cart.taxAmount,
            total: cart.total,
            paymentMethod: cart.paymentMethod.rawValue,
            cashReceived: cart.paymentMethod == .cash ? cart.cashReceived : nil,
            changeDue: cart.paymentMethod == .cash ? cart.changeDue : nil,
            orderId: orderId
        )
        let payload = CashRegisterRequest(
            action: "record_sale",
            tenantId: tenantId,
            userId: userId,
            userName: nil,
            amount: cart.total,
            denominations: nil,
            paymentMethod: cart.paymentMethod.rawValue,
            saleData: salePayload
        )
        return try await post(endpoint: "/api/cash-register", body: payload)
    }

    // MARK: - Email

    func sendEmail(to: String, subject: String, body: String) async throws {
        let payload = ["to": to, "subject": subject, "body": body]
        _ = try await post(endpoint: "/api/send-email", body: payload)
    }

    // MARK: - Generic POST

    private func post<T: Encodable>(endpoint: String, body: T) async throws -> [String: Any] {
        guard let url = URL(string: baseURL + endpoint) else {
            throw URLError(.badURL)
        }
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONEncoder().encode(body)
        request.timeoutInterval = 30

        let (data, response) = try await session.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse,
              (200..<300).contains(httpResponse.statusCode) else {
            throw URLError(.badServerResponse)
        }
        return (try? JSONSerialization.jsonObject(with: data) as? [String: Any]) ?? [:]
    }
}
