import Foundation

/// Mirrors wordsToCsv()/downloadCsv() in the web app's common.js.
enum CSVExport {
    static func csv(for words: [Word]) -> String {
        var rows = [["Original", "Translation", "Saved at"]]
        rows.append(contentsOf: words.map { [$0.original, $0.translation, $0.createdAt] })
        return rows
            .map { row in row.map(quote).joined(separator: ",") }
            .joined(separator: "\n")
    }

    private static func quote(_ field: String) -> String {
        "\"\(field.replacingOccurrences(of: "\"", with: "\"\""))\""
    }

    /// Writes CSV text to a temp file so ShareLink can offer it as a real .csv
    /// file (with the right filename) instead of plain text.
    static func writeTempFile(_ text: String, filename: String) -> URL? {
        let url = FileManager.default.temporaryDirectory.appendingPathComponent(filename)
        do {
            try text.write(to: url, atomically: true, encoding: .utf8)
            return url
        } catch {
            return nil
        }
    }
}
