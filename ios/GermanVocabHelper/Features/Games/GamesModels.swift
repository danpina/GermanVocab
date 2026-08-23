import Foundation

struct GameWord: Decodable, Identifiable, Equatable {
    let id: String
    let original: String
    let translation: String
    let inputLang: String
    let outputLang: String
}

/// GET /api/game/words
struct GameWordsResponse: Decodable {
    let words: [GameWord]
    let available: Int
    let minRequired: Int
}

enum GameMode: String, CaseIterable, Identifiable {
    case multipleChoice = "a"
    case multipleChoiceReversed = "b"
    case typeIt = "c"
    case typeItReversed = "d"
    case mixed = "e"

    var id: String { rawValue }

    var title: String {
        switch self {
        case .multipleChoice: return "Multiple choice"
        case .multipleChoiceReversed: return "Multiple choice (reversed)"
        case .typeIt: return "Type it"
        case .typeItReversed: return "Type it (reversed)"
        case .mixed: return "Mixed bag"
        }
    }

    var subtitle: String {
        switch self {
        case .multipleChoice: return "See it, pick the translation"
        case .multipleChoiceReversed: return "See the translation, pick the word"
        case .typeIt: return "See the translation, type the word"
        case .typeItReversed: return "See the word, type the translation"
        case .mixed: return "A random mix of all four"
        }
    }

    var isChoiceMode: Bool { self == .multipleChoice || self == .multipleChoiceReversed }
    var isTypeMode: Bool { self == .typeIt || self == .typeItReversed }

    /// The four concrete modes "Mixed bag" picks a random one from each round.
    static let concreteModes: [GameMode] = [.multipleChoice, .multipleChoiceReversed, .typeIt, .typeItReversed]
}

enum Difficulty: String, CaseIterable, Identifiable {
    case easy, medium, hard
    var id: String { rawValue }
    var title: String { rawValue.capitalized }
}

struct GameRound: Identifiable {
    let id = UUID()
    let word: GameWord
    let mode: GameMode
    let difficulty: Difficulty
}

struct MissedWord: Identifiable {
    let id: String
    let original: String
    let translation: String
}
