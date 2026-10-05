# Reply to Apple's "Information Needed" (Guideline 2.1)

Paste the text below into BOTH places in App Store Connect:
1. Reply to the review message (Resolution Center) — and attach the screen recording.
2. App Store → App Review Information → **Notes** (so it's there for future submissions).

Replace `<demo password>` with the demo account's password (not stored in this repo).

---

**1. Screen recording**
Attached. Recorded on a physical iPhone. It starts from launching the app and shows: account registration, login, the main features (translate and save words, lists, the practice games, statistics), and in-app account deletion (Settings → Delete account).

**2. Purpose and target audience**
Linguanest is a personal vocabulary notebook for people learning a foreign language (teenagers and adults). When you read or listen in another language you keep meeting words you don't know and forget them. Linguanest lets you look a word or sentence up, see the translation, hear it spoken, and save it to your own list. Short games built from your saved words then help you remember them, and the words you miss most often (and new, never-practiced words) come up more often. A statistics screen shows which words need the most work.

**3. How to access the main features**
Demo account (already contains 12 saved words so every feature can be tried):
- Email: reviewer@linguanest.test
- Password: <demo password>

Alternatively create your own account (open sign-up, any email and an 8+ character password) or use Sign in with Apple.

Walkthrough:
- **Today tab:** type a word such as "Haus" → tap Translate → tap Save to list. The speaker icons read the text aloud. Dictate uses the microphone (permission prompts appear on first use).
- **Lists tab:** saved words grouped by day (tap a day to expand); "+" adds several words at once; edit and delete icons are on each word.
- **Games tab:** choose a mode and tap Start game (needs at least 4 saved words; the demo account has 12). Answer the rounds and see the results.
- **Stats tab:** correct/incorrect counts per practiced word.
- **Settings tab:** language choices, words per game, Log out, and **Delete account** (please create your own test account to try deletion rather than deleting the demo account).

Note: the server runs on a hosting plan that sleeps when idle, so the very first request after a quiet period can take up to a minute (the app shows a waiting indicator). Please allow it to finish.

**4. External services used**
- Render — hosts the backend service.
- Turso (libSQL database on AWS, Ireland) — stores accounts, saved words and practice results.
- DeepL API — machine translation of the text the user chooses to translate.
- Sign in with Apple — optional sign-in method.
- Apple's Speech framework (dictation) and AVSpeechSynthesizer (read aloud) — on-device Apple frameworks.
No payment processors, advertising, analytics, or generative-AI services are used.

**5. Regional differences**
None. The app and its content behave the same in every region. Supported languages: German, English, Spanish, French, Italian, Portuguese, Dutch.

**6. Regulated industry / third-party material**
Not applicable. The app is not in a regulated industry and includes no protected third-party content. There is no user-generated content shared between users (each account only sees its own words), so reporting/blocking mechanisms do not apply. There are no in-app purchases or paid content.
