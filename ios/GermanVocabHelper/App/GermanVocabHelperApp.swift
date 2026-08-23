import SwiftUI

@main
struct GermanVocabHelperApp: App {
    @StateObject private var session = SessionStore()
    @StateObject private var speech = SpeechService()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(session)
                .environmentObject(speech)
        }
    }
}
