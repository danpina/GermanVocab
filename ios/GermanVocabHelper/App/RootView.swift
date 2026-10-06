import SwiftUI

struct RootView: View {
    @EnvironmentObject var session: SessionStore

    var body: some View {
        Group {
            if session.isCheckingSession {
                VStack(spacing: 12) {
                    ProgressView()
                    WakeHint().padding(.horizontal)
                }
            } else if session.user != nil {
                MainTabView()
            } else if let message = session.connectionError {
                ConnectionErrorView(message: message) {
                    Task { await session.bootstrap() }
                }
            } else {
                LoginView()
            }
        }
        .task { await session.bootstrap() }
    }
}

/// Shown when the saved session couldn't be checked because the server was unreachable,
/// so a slow or sleeping server doesn't look like being logged out.
struct ConnectionErrorView: View {
    let message: String
    let retry: () -> Void

    var body: some View {
        VStack(spacing: 16) {
            Image(systemName: "wifi.exclamationmark")
                .font(.system(size: 44))
                .foregroundStyle(.secondary)
            Text("Can't reach Linguanest")
                .font(.title2.bold())
            Text(message)
                .multilineTextAlignment(.center)
                .foregroundStyle(.secondary)
            Button("Try again", action: retry)
                .buttonStyle(.borderedProminent)
                .controlSize(.large)
        }
        .padding(32)
    }
}

struct MainTabView: View {
    var body: some View {
        TabView {
            TodayView()
                .tabItem { Label("Today", systemImage: "text.book.closed") }
            ListsView()
                .tabItem { Label("Lists", systemImage: "list.bullet") }
            GamesView()
                .tabItem { Label("Games", systemImage: "gamecontroller") }
            StatsView()
                .tabItem { Label("Stats", systemImage: "chart.bar") }
            SettingsView()
                .tabItem { Label("Settings", systemImage: "gearshape") }
        }
    }
}
