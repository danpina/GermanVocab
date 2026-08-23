import Foundation

/// GET /api/me — the full session user, including id.
struct User: Decodable, Equatable {
    let id: String
    let email: String
    let isAdmin: Bool
    let inputLang: String
    let outputLang: String
    let wordsPerGame: Int
}

/// POST /api/login only confirms the login; we refetch /api/me for the full User.
struct LoginResponse: Decodable {
    let email: String
    let isAdmin: Bool
}
