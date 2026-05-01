import Foundation

enum AppDateFormatter {
    static let display: DateFormatter = {
        let f = DateFormatter()
        f.dateStyle = .medium
        f.timeStyle = .short
        f.locale = Locale(identifier: "es_PR")
        return f
    }()

    static let shortDate: DateFormatter = {
        let f = DateFormatter()
        f.dateStyle = .short
        f.timeStyle = .none
        f.locale = Locale(identifier: "es_PR")
        return f
    }()

    static let timeOnly: DateFormatter = {
        let f = DateFormatter()
        f.dateStyle = .none
        f.timeStyle = .short
        f.locale = Locale(identifier: "es_PR")
        return f
    }()

    static let isoFull: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f
    }()
}

extension Date {
    var displayString: String { AppDateFormatter.display.string(from: self) }
    var shortDateString: String { AppDateFormatter.shortDate.string(from: self) }
    var timeString: String { AppDateFormatter.timeOnly.string(from: self) }

    var relativeString: String {
        let formatter = RelativeDateTimeFormatter()
        formatter.locale = Locale(identifier: "es")
        formatter.unitsStyle = .short
        return formatter.localizedString(for: self, relativeTo: Date())
    }

    var isToday: Bool { Calendar.current.isDateInToday(self) }
    var isYesterday: Bool { Calendar.current.isDateInYesterday(self) }
}
