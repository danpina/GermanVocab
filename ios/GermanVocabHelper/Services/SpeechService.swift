import AVFoundation
import Combine
import Speech

/// Native replacement for the web app's Web Speech API usage (speechSynthesis
/// for "Hear it" / SpeechRecognition for "Dictate").
@MainActor
final class SpeechService: NSObject, ObservableObject {
    @Published var isListening = false
    @Published var transcript = ""
    @Published var dictationError: String?

    private let synthesizer = AVSpeechSynthesizer()
    private var recognizer: SFSpeechRecognizer?
    private var recognitionRequest: SFSpeechAudioBufferRecognitionRequest?
    private var recognitionTask: SFSpeechRecognitionTask?
    private let audioEngine = AVAudioEngine()

    func speak(_ text: String, locale: String) {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }
        let utterance = AVSpeechUtterance(string: trimmed)
        utterance.voice = AVSpeechSynthesisVoice(language: locale)
        synthesizer.stopSpeaking(at: .immediate)
        synthesizer.speak(utterance)
    }

    func toggleDictation(locale: String) {
        if isListening {
            stopDictation()
        } else {
            startDictation(locale: locale)
        }
    }

    /// Stops dictation and forgets what was heard. Used when the input is cleared or
    /// saved: otherwise a still-running recognizer keeps re-sending the full
    /// transcript and the old text pops back into the box.
    func reset() {
        stopDictation()
        transcript = ""
    }

    private func startDictation(locale: String) {
        dictationError = nil
        SFSpeechRecognizer.requestAuthorization { [weak self] status in
            Task { @MainActor in
                guard status == .authorized else {
                    self?.dictationError = "Speech recognition isn't authorized. Enable it in iOS Settings."
                    return
                }
                self?.beginRecognition(locale: locale)
            }
        }
    }

    private func beginRecognition(locale: String) {
        let session = AVAudioSession.sharedInstance()
        do {
            try session.setCategory(.playAndRecord, mode: .measurement, options: [.duckOthers, .defaultToSpeaker])
            try session.setActive(true, options: .notifyOthersOnDeactivation)
        } catch {
            dictationError = "Couldn't start the microphone: \(error.localizedDescription)"
            return
        }

        recognizer = SFSpeechRecognizer(locale: Locale(identifier: locale))
        guard let recognizer, recognizer.isAvailable else {
            dictationError = "Dictation isn't available for this language on this device."
            return
        }

        let request = SFSpeechAudioBufferRecognitionRequest()
        request.shouldReportPartialResults = true
        recognitionRequest = request

        let inputNode = audioEngine.inputNode
        let format = inputNode.outputFormat(forBus: 0)
        inputNode.removeTap(onBus: 0)
        inputNode.installTap(onBus: 0, bufferSize: 1024, format: format) { buffer, _ in
            request.append(buffer)
        }

        audioEngine.prepare()
        do {
            try audioEngine.start()
        } catch {
            dictationError = "Couldn't start the microphone: \(error.localizedDescription)"
            return
        }

        isListening = true
        transcript = ""

        recognitionTask = recognizer.recognitionTask(with: request) { [weak self] result, error in
            Task { @MainActor in
                guard let self else { return }
                // Ignore stragglers that arrive after dictation was stopped or reset.
                if let result, self.isListening {
                    self.transcript = result.bestTranscription.formattedString
                }
                if error != nil || (result?.isFinal ?? false) {
                    self.stopDictation()
                }
            }
        }
    }

    private func stopDictation() {
        guard isListening || audioEngine.isRunning else { return }
        audioEngine.stop()
        audioEngine.inputNode.removeTap(onBus: 0)
        recognitionRequest?.endAudio()
        recognitionTask?.cancel()
        recognitionRequest = nil
        recognitionTask = nil
        isListening = false
    }
}
