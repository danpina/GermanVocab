import Combine
import Foundation

@MainActor
final class SessionStore: ObservableObject {
    @Published var user: User?
    @Published var isCheckingSession = true
    @Published var errorMessage: String?

    init() {
        APIClient.shared.onUnauthorized = { [weak self] in
            Task { @MainActor in self?.user = nil }
        }
    }

    func bootstrap() async {
        guard ServerConfig.isConfigured else {
            isCheckingSession = false
            return
        }
        await refreshMe()
        isCheckingSession = false
    }

    func refreshMe() async {
        do {
            user = try await APIClient.shared.send("/api/me", method: .get)
        } catch {
            user = nil
        }
    }

    func login(email: String, password: String) async -> Bool {
        errorMessage = nil
        do {
            struct LoginBody: Encodable { let email: String; let password: String }
            let _: LoginResponse = try await APIClient.shared.send(
                "/api/login", method: .post,
                body: LoginBody(email: email, password: password)
            )
            await refreshMe()
            return user != nil
        } catch {
            errorMessage = error.localizedDescription
            return false
        }
    }

    func register(email: String, password: String) async -> Bool {
        errorMessage = nil
        do {
            struct RegisterBody: Encodable { let email: String; let password: String }
            let _: LoginResponse = try await APIClient.shared.send(
                "/api/register", method: .post,
                body: RegisterBody(email: email, password: password)
            )
            await refreshMe()
            return user != nil
        } catch {
            errorMessage = error.localizedDescription
            return false
        }
    }

    func loginWithApple(identityToken: String, authorizationCode: String?, email: String?) async -> Bool {
        errorMessage = nil
        do {
            struct AppleBody: Encodable {
                let identityToken: String
                let authorizationCode: String?
                let email: String?
            }
            let _: LoginResponse = try await APIClient.shared.send(
                "/api/auth/apple", method: .post,
                body: AppleBody(identityToken: identityToken, authorizationCode: authorizationCode, email: email)
            )
            await refreshMe()
            return user != nil
        } catch {
            errorMessage = error.localizedDescription
            return false
        }
    }

    /// Permanently deletes the signed-in account (words and stats included).
    func deleteAccount() async -> String? {
        do {
            try await APIClient.shared.sendNoContent("/api/me", method: .delete)
            user = nil
            return nil
        } catch {
            return error.localizedDescription
        }
    }

    func logout() async {
        try? await APIClient.shared.sendNoContent("/api/logout", method: .post)
        user = nil
    }
}
