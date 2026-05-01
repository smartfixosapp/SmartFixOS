import Foundation
import Supabase

// MARK: - Supabase Configuration

private enum SupabaseConfig {
    static let url = "https://idntuvtabecwubzswpwi.supabase.co"
    static let anonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlkbnR1dnRhYmVjd3VienN3cHdpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxMDY2NDIsImV4cCI6MjA4ODY4MjY0Mn0.X2Ewcx-mds_Ua51XKy8zEFEA0fgUfHwmfuxMXu8ye_w"
}

// MARK: - Shared SupabaseClient

let supabase: SupabaseClient = {
    let decoder = JSONDecoder()
    decoder.dateDecodingStrategy = .custom { decoder in
        let container = try decoder.singleValueContainer()
        let string = try container.decode(String.self)
        let formatters: [DateFormatter] = [
            {
                let f = DateFormatter()
                f.dateFormat = "yyyy-MM-dd'T'HH:mm:ss.SSSSSSZ"
                return f
            }(),
            {
                let f = DateFormatter()
                f.dateFormat = "yyyy-MM-dd'T'HH:mm:ssZ"
                return f
            }(),
            {
                let f = DateFormatter()
                f.dateFormat = "yyyy-MM-dd"
                return f
            }()
        ]
        for formatter in formatters {
            if let date = formatter.date(from: string) { return date }
        }
        let iso = ISO8601DateFormatter()
        iso.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let date = iso.date(from: string) { return date }
        throw DecodingError.dataCorruptedError(in: container, debugDescription: "Cannot decode date: \(string)")
    }

    return SupabaseClient(
        supabaseURL: URL(string: SupabaseConfig.url)!,
        supabaseKey: SupabaseConfig.anonKey,
        options: SupabaseClientOptions(
            db: PostgrestClientOptions(schema: "public"),
            auth: GoTrueClientOptions(
                redirectToURL: URL(string: "com.smartfixos.pr911://auth/callback")
            )
        )
    )
}()
