import Combine
import Foundation

@MainActor
final class TodayViewModel: ObservableObject {
    @Published var inputText = ""
    @Published var translation = ""
    @Published var isTranslating = false
    @Published var errorMessage: String?
    @Published var todaysWords: [Word] = []

    func loadTodaysWords() async {
        do {
            let all: [Word] = try await APIClient.shared.send("/api/words", method: .get)
            todaysWords = all.filter { $0.dateKey == DateKey.today() }
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func translate() async {
        let text = inputText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else {
            errorMessage = "Type a word or sentence first."
            return
        }
        errorMessage = nil
        isTranslating = true
        defer { isTranslating = false }
        do {
            struct Body: Encodable { let text: String }
            struct Response: Decodable { let translation: String }
            let response: Response = try await APIClient.shared.send(
                "/api/translate", method: .post, body: Body(text: text)
            )
            translation = response.translation
        } catch {
            translation = ""
            errorMessage = error.localizedDescription
        }
    }

    func save() async {
        let original = inputText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !original.isEmpty, !translation.isEmpty else { return }
        do {
            struct Body: Encodable { let original: String; let translation: String }
            let _: Word = try await APIClient.shared.send(
                "/api/words", method: .post,
                body: Body(original: original, translation: translation)
            )
            inputText = ""
            translation = ""
            await loadTodaysWords()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func delete(_ word: Word) async {
        try? await APIClient.shared.sendNoContent("/api/words/\(word.id)", method: .delete)
        await loadTodaysWords()
    }

    func update(_ word: Word, original: String, translation: String) async {
        struct Body: Encodable { let original: String; let translation: String }
        let _: Word? = try? await APIClient.shared.send(
            "/api/words/\(word.id)", method: .patch,
            body: Body(original: original, translation: translation)
        )
        await loadTodaysWords()
    }
}
