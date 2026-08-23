import Combine
import Foundation

@MainActor
final class SettingsViewModel: ObservableObject {
    @Published var inputLang = "DE"
    @Published var outputLang = "EN"
    @Published var wordsPerGame = 6
    @Published var errorMessage: String?
    @Published var savedMessage: String?
    @Published var isSaving = false

    func load(from user: User?) {
        guard let user else { return }
        inputLang = user.inputLang
        outputLang = user.outputLang
        wordsPerGame = user.wordsPerGame
    }

    func save(session: SessionStore) async {
        errorMessage = nil
        savedMessage = nil
        isSaving = true
        defer { isSaving = false }
        do {
            struct Body: Encodable { let inputLang: String; let outputLang: String; let wordsPerGame: Int }
            struct Response: Decodable {
                let email: String
                let isAdmin: Bool
                let inputLang: String
                let outputLang: String
                let wordsPerGame: Int
            }
            let _: Response = try await APIClient.shared.send(
                "/api/me", method: .patch,
                body: Body(inputLang: inputLang, outputLang: outputLang, wordsPerGame: wordsPerGame)
            )
            savedMessage = "Saved."
            await session.refreshMe()
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}
