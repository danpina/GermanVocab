import SwiftUI

struct RootView: View {
    @EnvironmentObject var session: SessionStore

    var body: some View {
        Group {
            if session.isCheckingSession {
                ProgressView()
            } else if session.user != nil {
                MainTabView()
            } else {
                LoginView()
            }
        }
        .task { await session.bootstrap() }
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
