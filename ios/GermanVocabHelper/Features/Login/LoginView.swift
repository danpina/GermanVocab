import AuthenticationServices
import SwiftUI

struct LoginView: View {
    @EnvironmentObject var session: SessionStore
    @State private var serverURLText = ServerConfig.baseURL?.absoluteString ?? ""
    @State private var email = ""
    @State private var password = ""
    @State private var mode: Mode = .logIn
    @State private var isSubmitting = false

    private enum Mode: String, CaseIterable {
        case logIn = "Log in"
        case signUp = "Sign up"
    }

    var body: some View {
        NavigationStack {
            Form {
                #if DEBUG
                Section("Server (debug builds only)") {
                    TextField("https://your-app.example.com", text: $serverURLText)
                        .keyboardType(.URL)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                    Text("Defaults to the production server. For a local dev server in the Simulator, use http://localhost:3000.")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
                #endif

                Section {
                    Picker("Mode", selection: $mode) {
                        ForEach(Mode.allCases, id: \.self) { Text($0.rawValue).tag($0) }
                    }
                    .pickerStyle(.segmented)
                }

                Section(mode == .logIn ? "Log in" : "Create an account") {
                    TextField("Email", text: $email)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .keyboardType(.emailAddress)
                    SecureField("Password", text: $password)
                    if mode == .signUp {
                        Text("At least 8 characters.")
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                    }
                }

                if let error = session.errorMessage {
                    Text(error).foregroundStyle(.red)
                }

                Section {
                    Button {
                        Task { await submit() }
                    } label: {
                        if isSubmitting {
                            ProgressView()
                        } else {
                            Text(mode == .logIn ? "Log in" : "Create account")
                        }
                    }
                    .disabled(isSubmitting || email.isEmpty || password.isEmpty || serverURLText.isEmpty)
                }

                Section {
                    SignInWithAppleButton(.signIn, onRequest: { request in
                        request.requestedScopes = [.email]
                    }, onCompletion: handleAppleCompletion)
                    .signInWithAppleButtonStyle(.black)
                    .frame(height: 44)
                    .listRowInsets(EdgeInsets())
                    .disabled(serverURLText.isEmpty)
                } footer: {
                    if serverURLText.isEmpty {
                        Text("Set a Server URL above first.")
                    }
                }
            }
            .navigationTitle("Linguanest")
            .keyboardDismissible()
        }
    }

    private func submit() async {
        ServerConfig.baseURL = URL(string: serverURLText)
        isSubmitting = true
        defer { isSubmitting = false }
        switch mode {
        case .logIn:
            _ = await session.login(email: email, password: password)
        case .signUp:
            _ = await session.register(email: email, password: password)
        }
    }

    private func handleAppleCompletion(_ result: Result<ASAuthorization, Error>) {
        ServerConfig.baseURL = URL(string: serverURLText)
        switch result {
        case .success(let authorization):
            guard
                let credential = authorization.credential as? ASAuthorizationAppleIDCredential,
                let tokenData = credential.identityToken,
                let token = String(data: tokenData, encoding: .utf8)
            else {
                session.errorMessage = "Couldn't read the Apple credential."
                return
            }
            let code = credential.authorizationCode.flatMap { String(data: $0, encoding: .utf8) }
            Task {
                _ = await session.loginWithApple(identityToken: token, authorizationCode: code, email: credential.email)
            }
        case .failure(let error):
            session.errorMessage = error.localizedDescription
        }
    }
}
