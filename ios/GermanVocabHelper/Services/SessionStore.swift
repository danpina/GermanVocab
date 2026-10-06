import Combine
import Foundation

@MainActor
final class SessionStore: ObservableObject {
    @Published var user: User?
    @Published var isCheckingSession = true
    @Published var errorMessage: String?
    /// Set when the server couldn't be reached while checking the session. Distinct
    /// from being signed out: the saved login may be perfectly valid.
    @Published var connectionError: String?

    init() {
        APIClient.shared.onUnauthorized = { [weak self] in
            Task { @MainActor in self?.user = nil }
        }
    }

    func bootstrap() async {
        isCheckingSession = true
        await refreshMe()
        isCheckingSession = false
    }

    func refreshMe() async {
        do {
            user = try await APIClient.shared.send("/api/me", method: .get)
            connectionError = nil
        } catch let error as APIError where error.isUnauthorized {
            user = nil
            connectionError = nil
        } catch {
            // Offline, timeout, server error: keep whatever we had instead of
            // pretending the user was signed out.
            connectionError = error.localizedDescription
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
            return await finishSignIn()
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
            return await finishSignIn()
        } catch {
            errorMessage = error.localizedDescription
            return false
        }
    }

    func loginWithApple(identityToken: String, authorizationCode: String?) async -> Bool {
        errorMessage = nil
        do {
            struct AppleBody: Encodable {
                let identityToken: String
                let authorizationCode: String?
            }
            let _: LoginResponse = try await APIClient.shared.send(
                "/api/auth/apple", method: .post,
                body: AppleBody(identityToken: identityToken, authorizationCode: authorizationCode)
            )
            return await finishSignIn()
        } catch {
            errorMessage = error.localizedDescription
            return false
        }
    }

    /// After the server accepts the credentials, load the full profile.
    private func finishSignIn() async -> Bool {
        await refreshMe()
        if user == nil {
            errorMessage = connectionError ?? "Couldn't load your account. Please try again."
        }
        return user != nil
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
