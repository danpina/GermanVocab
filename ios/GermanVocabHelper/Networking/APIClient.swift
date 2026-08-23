import Foundation

/// Thin wrapper around URLSession. Auth is cookie-based (same JWT-in-cookie
/// session the web app uses) — URLSession's shared cookie storage persists and
/// resends it automatically, so there's no token handling to do here.
@MainActor
final class APIClient {
    static let shared = APIClient()
    private init() {}

    enum Method: String {
        case get = "GET"
        case post = "POST"
        case patch = "PATCH"
        case delete = "DELETE"
    }

    /// Fires whenever a request comes back 401, so the app can drop back to the login screen.
    var onUnauthorized: (() -> Void)?

    private let encoder = JSONEncoder()
    private let decoder = JSONDecoder()

    private func makeRequest(
        _ path: String,
        method: Method,
        body: Encodable?,
        query: [String: String]?
    ) throws -> URLRequest {
        guard let base = ServerConfig.baseURL else {
            throw APIError(message: "Server URL isn't set yet. Add it in Settings.")
        }
        guard var components = URLComponents(url: base.appendingPathComponent(path), resolvingAgainstBaseURL: false) else {
            throw APIError(message: "Invalid server URL.")
        }
        if let query, !query.isEmpty {
            components.queryItems = query.map { URLQueryItem(name: $0.key, value: $0.value) }
        }
        guard let url = components.url else {
            throw APIError(message: "Invalid server URL.")
        }

        var request = URLRequest(url: url)
        request.httpMethod = method.rawValue
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        if let body {
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.httpBody = try encoder.encode(body)
        }
        return request
    }

    @discardableResult
    func send<Response: Decodable>(
        _ path: String,
        method: Method,
        body: Encodable? = nil,
        query: [String: String]? = nil
    ) async throws -> Response {
        let request = try makeRequest(path, method: method, body: body, query: query)
        let (data, response) = try await URLSession.shared.data(for: request)
        try validate(response, data: data)
        return try decoder.decode(Response.self, from: data)
    }

    func sendNoContent(
        _ path: String,
        method: Method,
        body: Encodable? = nil,
        query: [String: String]? = nil
    ) async throws {
        let request = try makeRequest(path, method: method, body: body, query: query)
        let (data, response) = try await URLSession.shared.data(for: request)
        try validate(response, data: data)
    }

    private func validate(_ response: URLResponse, data: Data) throws {
        guard let http = response as? HTTPURLResponse else {
            throw APIError(message: "No response from server.")
        }
        if http.statusCode == 401 {
            onUnauthorized?()
            throw APIError(message: "Not logged in")
        }
        guard (200...299).contains(http.statusCode) else {
            if let decoded = try? decoder.decode(ServerErrorBody.self, from: data) {
                throw APIError(message: decoded.error)
            }
            throw APIError(message: "Request failed (\(http.statusCode)).")
        }
    }
}

private struct ServerErrorBody: Decodable {
    let error: String
}
