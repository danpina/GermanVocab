import SwiftUI

struct ListsView: View {
    @EnvironmentObject var speech: SpeechService
    @StateObject private var viewModel = ListsViewModel()
    @State private var showingBulkAdd = false
    // Today's list starts open and the rest folded, like the web version.
    @State private var expandedDays: Set<String> = [DateKey.today()]
    @State private var dayToDelete: DayGroup?

    var body: some View {
        NavigationStack {
            List {
                if viewModel.allWords.isEmpty {
                    Text("Nothing saved yet. Go look up some words!").foregroundStyle(.secondary)
                } else {
                    ForEach(viewModel.groups) { group in
                        DisclosureGroup(isExpanded: expansionBinding(for: group.key)) {
                            ForEach(group.words) { word in
                                WordRow(
                                    word: word,
                                    onSpeak: { speech.speak(word.original, locale: Languages.find(word.inputLang).speechLocale) },
                                    onSave: { original, translation in
                                        await viewModel.update(word, original: original, translation: translation)
                                    },
                                    onDelete: { await viewModel.delete(word) }
                                )
                            }

                            HStack {
                                if let url = CSVExport.writeTempFile(CSVExport.csv(for: group.words), filename: "linguanest-\(group.key).csv") {
                                    ShareLink(item: url) {
                                        Label("Export this day", systemImage: "square.and.arrow.up")
                                    }
                                    .buttonStyle(.borderless)
                                }
                                Spacer()
                                Button(role: .destructive) {
                                    dayToDelete = group
                                } label: {
                                    Label("Delete day", systemImage: "trash")
                                }
                                .buttonStyle(.borderless)
                            }
                            .font(.footnote)
                        } label: {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(DateKey.label(for: group.key)).font(.headline)
                                Text("\(group.words.count) word\(group.words.count == 1 ? "" : "s")")
                                    .font(.footnote)
                                    .foregroundStyle(.secondary)
                            }
                        }
                    }
                }
            }
            .navigationTitle("All Lists")
            .keyboardDismissible()
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        showingBulkAdd = true
                    } label: {
                        Image(systemName: "plus")
                    }
                }
                ToolbarItem(placement: .topBarLeading) {
                    if let url = CSVExport.writeTempFile(CSVExport.csv(for: viewModel.allWords), filename: "linguanest-all.csv") {
                        ShareLink(item: url) {
                            Image(systemName: "square.and.arrow.up")
                        }
                    }
                }
            }
            .sheet(isPresented: $showingBulkAdd) {
                BulkAddView(viewModel: viewModel)
            }
            .confirmationDialog(
                dayToDelete.map {
                    "Delete all \($0.words.count) word\($0.words.count == 1 ? "" : "s") from \(DateKey.label(for: $0.key))? This can't be undone."
                } ?? "",
                isPresented: Binding(
                    get: { dayToDelete != nil },
                    set: { if !$0 { dayToDelete = nil } }
                ),
                titleVisibility: .visible,
                presenting: dayToDelete
            ) { group in
                Button("Delete day", role: .destructive) {
                    Task { await viewModel.deleteDay(group.key) }
                }
                Button("Cancel", role: .cancel) {}
            }
            .task { await viewModel.load() }
            .refreshable { await viewModel.load() }
        }
    }

    private func expansionBinding(for key: String) -> Binding<Bool> {
        Binding(
            get: { expandedDays.contains(key) },
            set: { isExpanded in
                if isExpanded {
                    expandedDays.insert(key)
                } else {
                    expandedDays.remove(key)
                }
            }
        )
    }
}
