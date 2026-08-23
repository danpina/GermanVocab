import Combine
import Foundation

struct DayGroup: Identifiable {
    let key: String
    let words: [Word]
    var id: String { key }
}

@MainActor
final class ListsViewModel: ObservableObject {
    @Published var allWords: [Word] = []
    @Published var errorMessage: String?

    @Published var bulkText = ""
    @Published var bulkMessage: String?
    @Published var bulkError: String?
    @Published var isBulkAdding = false

    var groups: [DayGroup] {
        let grouped = Dictionary(grouping: allWords, by: \.dateKey)
        return grouped.keys.sorted(by: >).map { DayGroup(key: $0, words: grouped[$0] ?? []) }
    }

    func load() async {
        do {
            allWords = try await APIClient.shared.send("/api/words", method: .get)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func delete(_ word: Word) async {
        try? await APIClient.shared.sendNoContent("/api/words/\(word.id)", method: .delete)
        await load()
    }

    func update(_ word: Word, original: String, translation: String) async {
        struct Body: Encodable { let original: String; let translation: String }
        let _: Word? = try? await APIClient.shared.send(
            "/api/words/\(word.id)", method: .patch,
            body: Body(original: original, translation: translation)
        )
        await load()
    }

    func deleteDay(_ key: String) async {
        struct DeleteResponse: Decodable { let deleted: Int }
        let _: DeleteResponse? = try? await APIClient.shared.send(
            "/api/words", method: .delete, query: ["date": key]
        )
        await load()
    }

    func addBulk() async {
        bulkError = nil
        bulkMessage = nil
        let parsed = Self.parseBulkLines(bulkText)
        guard !parsed.words.isEmpty else {
            bulkError = "Nothing to add — each line needs \"word : translation\"."
            return
        }

        isBulkAdding = true
        defer { isBulkAdding = false }
        do {
            struct Entry: Encodable { let original: String; let translation: String }
            struct Body: Encodable { let words: [Entry] }
            struct Response: Decodable { let added: Int; let skipped: Int }
            let response: Response = try await APIClient.shared.send(
                "/api/words/bulk", method: .post,
                body: Body(words: parsed.words.map { Entry(original: $0.original, translation: $0.translation) })
            )
            var message = "Added \(response.added) word\(response.added == 1 ? "" : "s")."
            if !parsed.invalidLines.isEmpty {
                let lines = parsed.invalidLines.map(String.init).joined(separator: ", ")
                message += " Skipped line\(parsed.invalidLines.count == 1 ? "" : "s") \(lines) (missing \"word : translation\")."
            }
            bulkMessage = message
            bulkText = ""
            await load()
        } catch {
            bulkError = error.localizedDescription
        }
    }

    static func parseBulkLines(_ text: String) -> (words: [(original: String, translation: String)], invalidLines: [Int]) {
        var words: [(String, String)] = []
        var invalidLines: [Int] = []

        let lines = text.split(separator: "\n", omittingEmptySubsequences: false)
        for (index, rawLine) in lines.enumerated() {
            let trimmed = rawLine.trimmingCharacters(in: .whitespaces)
            if trimmed.isEmpty { continue }

            guard let colonIndex = trimmed.firstIndex(of: ":") else {
                invalidLines.append(index + 1)
                continue
            }

            let original = trimmed[trimmed.startIndex..<colonIndex].trimmingCharacters(in: .whitespaces)
            let translation = trimmed[trimmed.index(after: colonIndex)...].trimmingCharacters(in: .whitespaces)
            guard !original.isEmpty, !translation.isEmpty else {
                invalidLines.append(index + 1)
                continue
            }

            words.append((original, translation))
        }
        return (words, invalidLines)
    }
}
