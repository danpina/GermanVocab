import SwiftUI

struct TodayView: View {
    @EnvironmentObject var session: SessionStore
    @EnvironmentObject var speech: SpeechService
    @StateObject private var viewModel = TodayViewModel()

    private var inputLocale: String { Languages.find(session.user?.inputLang ?? "DE").speechLocale }
    private var outputLocale: String { Languages.find(session.user?.outputLang ?? "EN").speechLocale }
    private let title = "Linguanest"

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextEditor(text: $viewModel.inputText)
                        .frame(minHeight: 90)

                    HStack {
                        Button {
                            speech.toggleDictation(locale: inputLocale)
                        } label: {
                            Label(
                                speech.isListening ? "Stop listening" : "Dictate",
                                systemImage: speech.isListening ? "stop.circle.fill" : "mic.fill"
                            )
                        }
                        Spacer()
                        Button {
                            speech.speak(viewModel.inputText, locale: inputLocale)
                        } label: {
                            Label("Hear it", systemImage: "speaker.wave.2")
                        }
                    }

                    if let dictationError = speech.dictationError {
                        Text(dictationError).foregroundStyle(.red).font(.footnote)
                    }

                    Button {
                        Task { await viewModel.translate() }
                    } label: {
                        if viewModel.isTranslating {
                            ProgressView()
                        } else {
                            Text("Translate")
                        }
                    }
                    .disabled(viewModel.isTranslating)
                }

                if !viewModel.translation.isEmpty {
                    Section("Translation") {
                        Text(viewModel.translation)
                        HStack {
                            Button {
                                speech.speak(viewModel.translation, locale: outputLocale)
                            } label: {
                                Label("Speak translation", systemImage: "speaker.wave.2")
                            }
                            Spacer()
                            Button("Save to list") {
                                Task { await viewModel.save() }
                            }
                        }
                    }
                }

                if let error = viewModel.errorMessage {
                    Text(error).foregroundStyle(.red)
                }

                Section("Today's list") {
                    if viewModel.todaysWords.isEmpty {
                        Text("Nothing saved today yet.").foregroundStyle(.secondary)
                    } else {
                        ForEach(viewModel.todaysWords) { word in
                            WordRow(
                                word: word,
                                onSpeak: { speech.speak(word.original, locale: inputLocale) },
                                onSave: { original, translation in
                                    await viewModel.update(word, original: original, translation: translation)
                                },
                                onDelete: { await viewModel.delete(word) }
                            )
                        }
                    }
                }
            }
            .navigationTitle(title)
            .task { await viewModel.loadTodaysWords() }
            .refreshable { await viewModel.loadTodaysWords() }
            .onReceive(speech.$transcript) { newValue in
                guard speech.isListening else { return }
                viewModel.inputText = newValue
            }
        }
    }
}
