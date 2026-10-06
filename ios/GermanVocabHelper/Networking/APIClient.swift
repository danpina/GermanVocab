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

    /// Fires when a request made *while signed in* is rejected as unauthenticated, so
    /// the app can drop back to the login screen.
    var onUnauthorized: (() -> Void)?

    private let encoder = JSONEncoder()
    private let decoder = JSONDecoder()

    /// The free hosting plan sleeps when idle and can take close to a minute to wake,
    /// so the default 60 seconds is too tight for the first request after a quiet spell.
    private static let requestTimeout: TimeInterval = 120

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
        request.timeoutInterval = Self.requestTimeout
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
        let data = try await perform(request, path: path)
        do {
            return try decoder.decode(Response.self, from: data)
        } catch {
            throw APIError(message: "The server sent an unexpected response. Please try again.")
        }
    }

    func sendNoContent(
        _ path: String,
        method: Method,
        body: Encodable? = nil,
        query: [String: String]? = nil
    ) async throws {
        let request = try makeRequest(path, method: method, body: body, query: query)
        _ = try await perform(request, path: path)
    }

    private func perform(_ request: URLRequest, path: String) async throws -> Data {
        let result: (Data, URLResponse)
        do {
            result = try await URLSession.shared.data(for: request)
        } catch let error as URLError where error.code != .cancelled {
            throw APIError(message: Self.friendlyMessage(for: error))
        }
        let (data, response) = result
        try validate(response, data: data, path: path)
        return data
    }

    private static func friendlyMessage(for error: URLError) -> String {
        switch error.code {
        case .notConnectedToInternet, .dataNotAllowed, .networkConnectionLost, .internationalRoamingOff:
            return "You're offline. Check your connection and try again."
        case .timedOut:
            return "The server took too long to respond. Please try again."
        case .cannotFindHost, .cannotConnectToHost, .dnsLookupFailed, .secureConnectionFailed:
            return "Can't reach the server right now. Please try again in a moment."
        default:
            return error.localizedDescription
        }
    }

    private func validate(_ response: URLResponse, data: Data, path: String) throws {
        guard let http = response as? HTTPURLResponse else {
            throw APIError(message: "No response from server.")
        }

        let serverMessage = (try? decoder.decode(ServerErrorBody.self, from: data))?.error

        if http.statusCode == 401 {
            // A 401 from the sign-in endpoints just means the credentials were wrong:
            // show the server's message ("Incorrect email/ID or password") and don't
            // treat it as an expired session.
            let isSignInEndpoint = path.hasPrefix("/api/login") || path.hasPrefix("/api/register") || path.hasPrefix("/api/auth/")
            if !isSignInEndpoint { onUnauthorized?() }
            throw APIError(message: serverMessage ?? "Please log in again.", isUnauthorized: !isSignInEndpoint)
        }

        guard (200...299).contains(http.statusCode) else {
            throw APIError(message: serverMessage ?? "Request failed (\(http.statusCode)).")
        }
    }
}

private struct ServerErrorBody: Decodable {
    let error: String
}
