import SwiftUI

struct LoginView: View {
    @EnvironmentObject var session: SessionStore
    @State private var serverURLText = ServerConfig.baseURL?.absoluteString ?? ""
    @State private var email = ""
    @State private var password = ""
    @State private var isLoggingIn = false

    var body: some View {
        NavigationStack {
            Form {
                if !ServerConfig.isConfigured {
                    Section("Server") {
                        TextField("https://your-app.example.com", text: $serverURLText)
                            .keyboardType(.URL)
                            .textInputAutocapitalization(.never)
                            .autocorrectionDisabled()
                        Text("Point this at your deployed Vocab Helper backend. In the Simulator, hitting your Mac's dev server, use http://localhost:3000.")
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                    }
                }

                Section("Log in") {
                    TextField("Email or user ID", text: $email)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .keyboardType(.emailAddress)
                    SecureField("Password", text: $password)
                }

                if let error = session.errorMessage {
                    Text(error).foregroundStyle(.red)
                }

                Section {
                    Button {
                        Task {
                            ServerConfig.baseURL = URL(string: serverURLText)
                            isLoggingIn = true
                            _ = await session.login(email: email, password: password)
                            isLoggingIn = false
                        }
                    } label: {
                        if isLoggingIn {
                            ProgressView()
                        } else {
                            Text("Log in")
                        }
                    }
                    .disabled(isLoggingIn || email.isEmpty || password.isEmpty || serverURLText.isEmpty)
                }
            }
            .navigationTitle("Vocab Helper")
        }
    }
}
