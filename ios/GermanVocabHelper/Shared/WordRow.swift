import SwiftUI

/// Mirrors createWordListItem() in the web app's common.js: view/edit toggle,
/// speak, delete.
struct WordRow: View {
    let word: Word
    var onSpeak: () -> Void
    var onSave: (String, String) async -> Void
    var onDelete: () async -> Void

    @State private var isEditing = false
    @State private var editedOriginal = ""
    @State private var editedTranslation = ""

    var body: some View {
        Group {
            if isEditing {
                editForm
            } else {
                readOnlyRow
            }
        }
    }

    private var readOnlyRow: some View {
        HStack(alignment: .top) {
            VStack(alignment: .leading, spacing: 4) {
                Text(word.original).font(.body.weight(.semibold))
                Text(word.translation).foregroundStyle(.secondary)
            }
            Spacer()
            Button(action: onSpeak) {
                Image(systemName: "speaker.wave.2.fill")
            }
            .buttonStyle(.borderless)
        }
        .contentShape(Rectangle())
        .swipeActions(edge: .trailing) {
            Button(role: .destructive) {
                Task { await onDelete() }
            } label: {
                Label("Delete", systemImage: "trash")
            }
            Button {
                editedOriginal = word.original
                editedTranslation = word.translation
                isEditing = true
            } label: {
                Label("Edit", systemImage: "pencil")
            }
            .tint(.orange)
        }
    }

    private var editForm: some View {
        VStack(alignment: .leading, spacing: 8) {
            TextField("Word", text: $editedOriginal)
                .textFieldStyle(.roundedBorder)
            TextField("Translation", text: $editedTranslation)
                .textFieldStyle(.roundedBorder)
            HStack {
                Button("Save") {
                    let original = editedOriginal.trimmingCharacters(in: .whitespaces)
                    let translation = editedTranslation.trimmingCharacters(in: .whitespaces)
                    guard !original.isEmpty, !translation.isEmpty else { return }
                    Task {
                        await onSave(original, translation)
                        isEditing = false
                    }
                }
                .buttonStyle(.borderedProminent)
                Button("Cancel", role: .cancel) { isEditing = false }
            }
        }
        .padding(.vertical, 4)
    }
}
