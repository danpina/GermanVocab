import Foundation

/// The backend base URL, chosen by the user (Login screen the first time,
/// Settings after that) rather than hardcoded — so the same build can point at
/// a local dev server, a LAN IP, or the deployed production host.
enum ServerConfig {
    private static let key = "serverBaseURL"

    static var baseURL: URL? {
        get {
            guard let raw = UserDefaults.standard.string(forKey: key), !raw.isEmpty else { return nil }
            return URL(string: raw)
        }
        set {
            UserDefaults.standard.set(newValue?.absoluteString, forKey: key)
        }
    }

    static var isConfigured: Bool { baseURL != nil }
}
