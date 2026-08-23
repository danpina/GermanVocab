import SwiftUI

struct StatsView: View {
    @StateObject private var viewModel = StatsViewModel()
    @State private var showingResetConfirm = false

    var body: some View {
        NavigationStack {
            List {
                if viewModel.stats.isEmpty {
                    Text("No game data yet — play a few rounds in Games and your results will show up here.")
                        .foregroundStyle(.secondary)
                } else {
                    Section {
                        Text("\(viewModel.stats.count) word\(viewModel.stats.count == 1 ? "" : "s") practiced")
                            .foregroundStyle(.secondary)
                    }
                    ForEach(viewModel.stats) { stat in
                        HStack {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(stat.original).font(.body.weight(.semibold))
                                Text(stat.translation).font(.footnote).foregroundStyle(.secondary)
                            }
                            Spacer()
                            VStack(alignment: .trailing, spacing: 2) {
                                Text("\(accuracy(stat))%")
                                Text("✓\(stat.correctCount) ✗\(stat.incorrectCount)")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                        }
                    }
                }
            }
            .navigationTitle("Stats")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Reset", role: .destructive) { showingResetConfirm = true }
                }
            }
            .confirmationDialog(
                "Reset all your game stats? This clears your correct/incorrect history for every word (your saved words themselves are not affected).",
                isPresented: $showingResetConfirm,
                titleVisibility: .visible
            ) {
                Button("Reset stats", role: .destructive) { Task { await viewModel.reset() } }
                Button("Cancel", role: .cancel) {}
            }
            .task { await viewModel.load() }
            .refreshable { await viewModel.load() }
        }
    }

    private func accuracy(_ stat: WordStat) -> Int {
        let total = stat.correctCount + stat.incorrectCount
        guard total > 0 else { return 0 }
        return Int((Double(stat.correctCount) / Double(total) * 100).rounded())
    }
}
