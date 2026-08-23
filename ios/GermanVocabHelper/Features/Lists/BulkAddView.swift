import SwiftUI

struct BulkAddView: View {
    @ObservedObject var viewModel: ListsViewModel
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            Form {
                Section("One pair per line: word : translation") {
                    TextEditor(text: $viewModel.bulkText)
                        .frame(minHeight: 160)
                }
                if let error = viewModel.bulkError {
                    Text(error).foregroundStyle(.red)
                }
                if let message = viewModel.bulkMessage {
                    Text(message).foregroundStyle(.green)
                }
            }
            .navigationTitle("Add words in bulk")
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Add") {
                        Task {
                            await viewModel.addBulk()
                            if viewModel.bulkError == nil { dismiss() }
                        }
                    }
                    .disabled(viewModel.isBulkAdding)
                }
                ToolbarItem(placement: .cancellationAction) {
                    Button("Close") { dismiss() }
                }
            }
        }
    }
}
