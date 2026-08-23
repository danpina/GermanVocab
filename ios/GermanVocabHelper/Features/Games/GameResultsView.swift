import SwiftUI

struct GameResultsView: View {
    @ObservedObject var viewModel: GamesViewModel

    var body: some View {
        Form {
            Section {
                Text("Score: \(viewModel.score)/\(viewModel.rounds.count)")
                    .font(.title2.bold())
            }
            Section("Missed") {
                if viewModel.missed.isEmpty {
                    Text("Perfect round — nothing missed!")
                } else {
                    ForEach(viewModel.missed) { word in
                        Text("\(word.original) — \(word.translation)")
                    }
                }
            }
            Section {
                Button("Play again") { viewModel.playAgain() }
                Button("Choose a different mode") { viewModel.changeMode() }
            }
        }
    }
}
