import Foundation

struct APIError: Error, LocalizedError {
    let message: String
    /// True only when a signed-in session was rejected (as opposed to a wrong
    /// password at the login screen, which also comes back as HTTP 401).
    var isUnauthorized = false

    var errorDescription: String? { message }
}
