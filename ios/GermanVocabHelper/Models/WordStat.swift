import Foundation

/// GET /api/stats — already sorted worst-first by the server.
struct WordStat: Decodable, Identifiable {
    let id: String
    let original: String
    let translation: String
    let inputLang: String
    let outputLang: String
    let correctCount: Int
    let incorrectCount: Int
    let lastSeenAt: String?
}
