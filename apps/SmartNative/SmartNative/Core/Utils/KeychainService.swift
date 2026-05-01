import Foundation
import Security

enum KeychainKey: String {
    case authToken = "com.smartfixos.authToken"
    case refreshToken = "com.smartfixos.refreshToken"
    case tenantId = "com.smartfixos.tenantId"
    case employeeId = "com.smartfixos.employeeId"
    case biometricEnabled = "com.smartfixos.biometricEnabled"
    case pinSessionExpiry = "com.smartfixos.pinSessionExpiry"
    case lastLoggedEmail = "com.smartfixos.lastLoggedEmail"
}

final class KeychainService {
    static let shared = KeychainService()
    private init() {}

    func save(_ value: String, forKey key: KeychainKey) {
        let data = Data(value.utf8)
        let query: [CFString: Any] = [
            kSecClass: kSecClassGenericPassword,
            kSecAttrAccount: key.rawValue,
            kSecAttrService: "com.smartfixos.native",
            kSecValueData: data
        ]
        SecItemDelete(query as CFDictionary)
        SecItemAdd(query as CFDictionary, nil)
    }

    func load(forKey key: KeychainKey) -> String? {
        let query: [CFString: Any] = [
            kSecClass: kSecClassGenericPassword,
            kSecAttrAccount: key.rawValue,
            kSecAttrService: "com.smartfixos.native",
            kSecReturnData: true,
            kSecMatchLimit: kSecMatchLimitOne
        ]
        var item: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &item)
        guard status == errSecSuccess,
              let data = item as? Data,
              let string = String(data: data, encoding: .utf8) else { return nil }
        return string
    }

    func delete(forKey key: KeychainKey) {
        let query: [CFString: Any] = [
            kSecClass: kSecClassGenericPassword,
            kSecAttrAccount: key.rawValue,
            kSecAttrService: "com.smartfixos.native"
        ]
        SecItemDelete(query as CFDictionary)
    }

    func deleteAll() {
        for key in KeychainKey.allCases {
            delete(forKey: key)
        }
    }
}

extension KeychainKey: CaseIterable {}
