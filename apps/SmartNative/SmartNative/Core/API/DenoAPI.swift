import Foundation

// MARK: - Deno/Render API Client (serverless functions)

actor DenoAPI {
    static let shared = DenoAPI()
    private let baseURL = "https://smartfixos.onrender.com"
    private let session = URLSession.shared

    // MARK: - Sequence Number

    func generateSequenceNumber(tenantId: String, type: String = "order") async throws -> String {
        let payload = ["tenantId": tenantId, "type": type]
        let result = try await post(endpoint: "/generateSequenceNumber", body: payload)
        if let number = result["number"] as? String { return number }
        if let number = result["sequenceNumber"] as? String { return number }
        // Fallback: local generation
        return generateLocalSequence(type: type)
    }

    private func generateLocalSequence(type: String) -> String {
        let timestamp = Int(Date().timeIntervalSince1970)
        let prefix = type == "order" ? "WO" : type.uppercased().prefix(2)
        return "\(prefix)-\(timestamp % 100000)"
    }

    // MARK: - AI Invoice Extraction (Purchase Orders only)

    struct InvoiceExtractResult: Decodable {
        let supplier_name: String?
        let line_items: [InvoiceLineItem]?
        let subtotal: Double?
        let tax_amount: Double?
        let shipping_cost: Double?
        let total_amount: Double?
        let date: String?
    }

    struct InvoiceLineItem: Decodable {
        let description: String?
        let quantity: Double?
        let unit_price: Double?
        let total: Double?
    }

    func extractInvoice(fileURL: String, documentType: String = "invoice") async throws -> InvoiceExtractResult {
        let payload = ["file_url": fileURL, "document_type": documentType]
        let data = try await postData(endpoint: "/ai/extract-expense", body: payload)
        return try JSONDecoder().decode(InvoiceExtractResult.self, from: data)
    }

    // MARK: - Order Status Change

    func handleOrderStatusChange(orderId: String, newStatus: String, tenantId: String) async throws {
        let payload = [
            "orderId": orderId,
            "newStatus": newStatus,
            "tenantId": tenantId
        ]
        _ = try await post(endpoint: "/handleOrderStatusChange", body: payload)
    }

    // MARK: - KPIs

    func getKPIs(tenantId: String, period: String = "month") async throws -> [String: Any] {
        let payload = ["tenantId": tenantId, "period": period]
        return try await post(endpoint: "/getKPIs", body: payload)
    }

    // MARK: - Generic

    private func post<T: Encodable>(endpoint: String, body: T) async throws -> [String: Any] {
        let data = try await postData(endpoint: endpoint, body: body)
        return (try? JSONSerialization.jsonObject(with: data) as? [String: Any]) ?? [:]
    }

    private func postData<T: Encodable>(endpoint: String, body: T) async throws -> Data {
        guard let url = URL(string: baseURL + endpoint) else { throw URLError(.badURL) }
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONEncoder().encode(body)
        request.timeoutInterval = 60
        let (data, _) = try await session.data(for: request)
        return data
    }
}
