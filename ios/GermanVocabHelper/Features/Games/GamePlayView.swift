import SwiftUI

struct GamePlayView: View {
    @ObservedObject var viewModel: GamesViewModel

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                Text("Round \(viewModel.roundIndex + 1)/\(viewModel.rounds.count) · Score: \(viewModel.score)")
                    .foregroundStyle(.secondary)

                Text(viewModel.prompt)
                    .font(.largeTitle.bold())

                if let hint = viewModel.hint {
                    Text(hint).font(.title3).monospaced()
                }

                if viewModel.currentRound?.mode.isChoiceMode == true {
                    ForEach(viewModel.choices, id: \.self) { option in
                        Button {
                            viewModel.choose(option)
                        } label: {
                            HStack {
                                Text(option)
                                Spacer()
                                if viewModel.answered {
                                    if GamesViewModel.normalize(option) == GamesViewModel.normalize(viewModel.correctText) {
                                        Image(systemName: "checkmark.circle.fill").foregroundStyle(.green)
                                    } else if option == viewModel.selectedChoice {
                                        Image(systemName: "xmark.circle.fill").foregroundStyle(.red)
                                    }
                                }
                            }
                            .padding()
                            .background(.thinMaterial, in: RoundedRectangle(cornerRadius: 10))
                        }
                        .disabled(viewModel.answered)
                        .buttonStyle(.plain)
                    }
                } else {
                    TextField("Type your answer", text: $viewModel.typedAnswer)
                        .textFieldStyle(.roundedBorder)
                        .autocorrectionDisabled()
                        .textInputAutocapitalization(.never)
                        .disabled(viewModel.answered)
                        .onSubmit { viewModel.submitTyped() }
                    Button("Submit") { viewModel.submitTyped() }
                        .buttonStyle(.borderedProminent)
                        .disabled(viewModel.answered)
                }

                if let feedback = viewModel.feedback {
                    Text(feedback).font(.headline)
                }

                if viewModel.answered {
                    Button(viewModel.roundIndex + 1 >= viewModel.rounds.count ? "See results" : "Next") {
                        viewModel.next()
                    }
                    .buttonStyle(.borderedProminent)
                }
            }
            .padding()
        }
    }
}
