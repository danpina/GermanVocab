import Combine
import Foundation

@MainActor
final class GamesViewModel: ObservableObject {
    @Published var selectedMode: GameMode = .multipleChoice
    @Published var selectedDifficulty: Difficulty = .easy

    @Published var notEnoughWordsMessage: String?
    @Published var isLoading = false

    @Published var sessionWords: [GameWord] = []
    @Published var rounds: [GameRound] = []
    @Published var roundIndex = 0
    @Published var score = 0
    @Published var missed: [MissedWord] = []

    @Published var choices: [String] = []
    @Published var selectedChoice: String?
    @Published var typedAnswer = ""
    @Published var answered = false
    @Published var feedback: String?
    @Published var hint: String?

    @Published var phase: Phase = .selectingMode
    enum Phase { case selectingMode, playing, results }

    var currentRound: GameRound? {
        rounds.indices.contains(roundIndex) ? rounds[roundIndex] : nil
    }

    var prompt: String {
        guard let round = currentRound else { return "" }
        switch round.mode {
        case .multipleChoice, .typeItReversed: return round.word.original
        case .multipleChoiceReversed, .typeIt: return round.word.translation
        case .mixed: return ""
        }
    }

    var correctText: String {
        guard let round = currentRound else { return "" }
        switch round.mode {
        case .multipleChoice, .typeIt: return round.word.translation
        case .multipleChoiceReversed, .typeItReversed: return round.word.original
        case .mixed: return ""
        }
    }

    func startGame() async {
        notEnoughWordsMessage = nil
        isLoading = true
        defer { isLoading = false }
        do {
            let response: GameWordsResponse = try await APIClient.shared.send("/api/game/words", method: .get)
            guard response.words.count >= response.minRequired else {
                notEnoughWordsMessage = "Save at least \(response.minRequired) words before playing (you have \(response.available))."
                return
            }
            sessionWords = response.words
            rounds = sessionWords.map { word in
                let mode = selectedMode == .mixed ? GameMode.concreteModes.randomElement()! : selectedMode
                return GameRound(word: word, mode: mode, difficulty: selectedDifficulty)
            }
            roundIndex = 0
            score = 0
            missed = []
            phase = .playing
            setUpRound()
        } catch {
            notEnoughWordsMessage = error.localizedDescription
        }
    }

    private func setUpRound() {
        guard let round = currentRound else { return }
        answered = false
        feedback = nil
        selectedChoice = nil
        typedAnswer = ""
        hint = nil
        choices = []

        if round.mode.isChoiceMode {
            let showOriginal = round.mode == .multipleChoice
            let correct = showOriginal ? round.word.translation : round.word.original
            let pool = sessionWords
                .filter { $0.id != round.word.id }
                .map { showOriginal ? $0.translation : $0.original }
            let distractors = Self.pickDistractors(pool: pool, correctText: correct, count: 2)
            choices = (distractors + [correct]).shuffled()
        } else {
            let showOriginal = round.mode == .typeItReversed
            let correct = showOriginal ? round.word.translation : round.word.original
            hint = Self.buildHint(correct, difficulty: round.difficulty)
        }
    }

    func choose(_ option: String) {
        guard !answered, currentRound != nil else { return }
        selectedChoice = option
        submit(correct: Self.normalize(option) == Self.normalize(correctText))
    }

    func submitTyped() {
        guard !answered, currentRound != nil else { return }
        submit(correct: Self.normalize(typedAnswer) == Self.normalize(correctText))
    }

    private func submit(correct: Bool) {
        guard let round = currentRound else { return }
        answered = true

        if correct {
            score += 1
            feedback = "✅ Correct!"
        } else {
            missed.append(MissedWord(id: round.word.id, original: round.word.original, translation: round.word.translation))
            feedback = "❌ The right answer was \"\(correctText)\"."
        }

        Task {
            struct Body: Encodable { let wordId: String; let correct: Bool }
            try? await APIClient.shared.sendNoContent(
                "/api/game/result", method: .post,
                body: Body(wordId: round.word.id, correct: correct)
            )
        }
    }

    func next() {
        roundIndex += 1
        if roundIndex >= rounds.count {
            phase = .results
        } else {
            setUpRound()
        }
    }

    func playAgain() {
        Task { await startGame() }
    }

    func changeMode() {
        phase = .selectingMode
    }

    /// Case/space/hyphen-insensitive, matching normalizeAnswer() in the web app's games.js.
    static func normalize(_ text: String) -> String {
        text.lowercased().replacingOccurrences(of: "[\\s-]+", with: "", options: .regularExpression)
    }

    static func pickDistractors(pool: [String], correctText: String, count: Int) -> [String] {
        let candidates = pool.filter { normalize($0) != normalize(correctText) }
        let unique = Array(Set(candidates))
        return Array(unique.shuffled().prefix(count))
    }

    static func buildHint(_ word: String, difficulty: Difficulty) -> String {
        word.enumerated().map { index, character -> String in
            if character == " " { return " " }
            switch difficulty {
            case .easy: return index % 2 == 0 ? String(character) : "_"
            case .medium: return index == 0 ? String(character) : "_"
            case .hard: return "_"
            }
        }.joined(separator: " ")
    }
}
