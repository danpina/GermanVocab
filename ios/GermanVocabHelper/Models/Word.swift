import Foundation

struct Word: Decodable, Identifiable, Equatable {
    let id: String
    var original: String
    var translation: String
    let date: String
    let createdAt: String
    let inputLang: String
    let outputLang: String
}

extension Word {
    /// Older entries saved before per-word dates existed fall back to their
    /// createdAt timestamp, mirroring wordDateKey() in the web app's common.js.
    var dateKey: String {
        date.isEmpty ? String(createdAt.prefix(10)) : date
    }
}
