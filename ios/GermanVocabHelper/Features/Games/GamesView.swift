import SwiftUI

struct GamesView: View {
    @StateObject private var viewModel = GamesViewModel()

    var body: some View {
        NavigationStack {
            Group {
                switch viewModel.phase {
                case .selectingMode: ModeSelectView(viewModel: viewModel)
                case .playing: GamePlayView(viewModel: viewModel)
                case .results: GameResultsView(viewModel: viewModel)
                }
            }
            .navigationTitle("Games")
            .toolbar {
                if viewModel.phase == .playing {
                    ToolbarItem(placement: .cancellationAction) {
                        Button("Quit", role: .destructive) {
                            viewModel.changeMode()
                        }
                    }
                }
            }
        }
    }
}

private struct ModeSelectView: View {
    @ObservedObject var viewModel: GamesViewModel

    var body: some View {
        Form {
            Section("Practice your saved words. Words you get wrong show up more often.") {
                Picker("Mode", selection: $viewModel.selectedMode) {
                    ForEach(GameMode.allCases) { mode in
                        VStack(alignment: .leading, spacing: 2) {
                            Text(mode.title).bold()
                            Text(mode.subtitle).font(.caption).foregroundStyle(.secondary)
                        }
                        .tag(mode)
                    }
                }
                .pickerStyle(.inline)
                .labelsHidden()
            }

            if viewModel.selectedMode.isTypeMode || viewModel.selectedMode == .mixed {
                Section("Difficulty") {
                    Picker("Difficulty", selection: $viewModel.selectedDifficulty) {
                        ForEach(Difficulty.allCases) { Text($0.title).tag($0) }
                    }
                    .pickerStyle(.segmented)
                }
            }

            if let message = viewModel.notEnoughWordsMessage {
                Text(message).foregroundStyle(.red)
            }

            Section {
                Button {
                    Task { await viewModel.startGame() }
                } label: {
                    if viewModel.isLoading {
                        ProgressView()
                    } else {
                        Text("Start game")
                    }
                }
                .disabled(viewModel.isLoading)
            }
        }
    }
}
