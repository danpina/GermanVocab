import Combine
import Foundation

@MainActor
final class StatsViewModel: ObservableObject {
    @Published var stats: [WordStat] = []
    @Published var errorMessage: String?

    func load() async {
        do {
            stats = try await APIClient.shared.send("/api/stats", method: .get)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func reset() async {
        try? await APIClient.shared.sendNoContent("/api/stats", method: .delete)
        await load()
    }
}
