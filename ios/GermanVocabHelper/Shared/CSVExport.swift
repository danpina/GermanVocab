import CoreTransferable
import Foundation
import UniformTypeIdentifiers

/// Mirrors wordsToCsv() in the web app's common.js.
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
}

/// A CSV the share sheet turns into a real .csv file. The file is only written when the
/// user actually taps share — not every time the Lists screen redraws.
struct CSVFile: Transferable {
    let text: String
    let filename: String

    static var transferRepresentation: some TransferRepresentation {
        FileRepresentation(exportedContentType: .commaSeparatedText) { file in
            let url = FileManager.default.temporaryDirectory.appendingPathComponent(file.filename)
            try file.text.write(to: url, atomically: true, encoding: .utf8)
            return SentTransferredFile(url)
        }
    }
}
