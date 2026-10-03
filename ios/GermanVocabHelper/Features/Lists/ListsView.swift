import SwiftUI

struct ListsView: View {
    @EnvironmentObject var speech: SpeechService
    @StateObject private var viewModel = ListsViewModel()
    @State private var showingBulkAdd = false

    var body: some View {
        NavigationStack {
            List {
                if viewModel.allWords.isEmpty {
                    Text("Nothing saved yet. Go look up some words!").foregroundStyle(.secondary)
                } else {
                    ForEach(viewModel.groups) { group in
                        Section {
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
                        } header: {
                            Text("\(DateKey.label(for: group.key)) — \(group.words.count) word\(group.words.count == 1 ? "" : "s")")
                        } footer: {
                            HStack {
                                if let url = CSVExport.writeTempFile(CSVExport.csv(for: group.words), filename: "german-vocab-\(group.key).csv") {
                                    ShareLink(item: url) {
                                        Label("Export this day", systemImage: "square.and.arrow.up")
                                    }
                                }
                                Spacer()
                                Button(role: .destructive) {
                                    Task { await viewModel.deleteDay(group.key) }
                                } label: {
                                    Label("Delete day", systemImage: "trash")
                                }
                            }
                            .font(.footnote)
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
                    if let url = CSVExport.writeTempFile(CSVExport.csv(for: viewModel.allWords), filename: "german-vocab-all.csv") {
                        ShareLink(item: url) {
                            Image(systemName: "square.and.arrow.up")
                        }
                    }
                }
            }
            .sheet(isPresented: $showingBulkAdd) {
                BulkAddView(viewModel: viewModel)
            }
            .task { await viewModel.load() }
            .refreshable { await viewModel.load() }
        }
    }
}
