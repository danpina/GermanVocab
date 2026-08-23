import Foundation

struct Language: Identifiable, Equatable {
    let code: String
    let label: String
    let speechLocale: String
    var id: String { code }
}

/// Kept in sync by hand with languages.js at the repo root, same as
/// public/languages.js is for the web app.
enum Languages {
    static let all: [Language] = [
        Language(code: "DE", label: "German", speechLocale: "de-DE"),
        Language(code: "EN", label: "English", speechLocale: "en-US"),
        Language(code: "ES", label: "Spanish", speechLocale: "es-ES"),
        Language(code: "FR", label: "French", speechLocale: "fr-FR"),
        Language(code: "IT", label: "Italian", speechLocale: "it-IT"),
        Language(code: "PT", label: "Portuguese", speechLocale: "pt-PT"),
        Language(code: "NL", label: "Dutch", speechLocale: "nl-NL"),
    ]

    static func find(_ code: String) -> Language {
        all.first { $0.code == code } ?? all[0]
    }
}
