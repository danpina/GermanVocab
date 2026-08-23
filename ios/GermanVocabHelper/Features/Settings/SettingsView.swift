import SwiftUI

struct SettingsView: View {
    @EnvironmentObject var session: SessionStore
    @StateObject private var viewModel = SettingsViewModel()
    @State private var serverURLText = ServerConfig.baseURL?.absoluteString ?? ""

    var body: some View {
        NavigationStack {
            Form {
                Section("I'm learning") {
                    Picker("Learning", selection: $viewModel.inputLang) {
                        ForEach(Languages.all) { Text($0.label).tag($0.code) }
                    }
                    .labelsHidden()
                }
                Section("Translate into") {
                    Picker("Translate into", selection: $viewModel.outputLang) {
                        ForEach(Languages.all) { Text($0.label).tag($0.code) }
                    }
                    .labelsHidden()
                }
                Section("Words per game (3–20)") {
                    Stepper(value: $viewModel.wordsPerGame, in: 3...20) {
                        Text("\(viewModel.wordsPerGame)")
                    }
                }

                if let error = viewModel.errorMessage {
                    Text(error).foregroundStyle(.red)
                }
                if let saved = viewModel.savedMessage {
                    Text(saved).foregroundStyle(.green)
                }

                Section {
                    Button {
                        Task { await viewModel.save(session: session) }
                    } label: {
                        if viewModel.isSaving {
                            ProgressView()
                        } else {
                            Text("Save")
                        }
                    }
                    .disabled(viewModel.isSaving)
                }

                Section("Server") {
                    TextField("https://your-app.example.com", text: $serverURLText)
                        .keyboardType(.URL)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                    Button("Update server URL") {
                        ServerConfig.baseURL = URL(string: serverURLText)
                    }
                }

                Section {
                    Button("Log out", role: .destructive) {
                        Task { await session.logout() }
                    }
                }
            }
            .navigationTitle("Settings")
            .task { viewModel.load(from: session.user) }
        }
    }
}
