# Theory Go Where

An offline-friendly Singapore driving-theory practice app. It contains all ten Final Theory mock papers and is structured to support Basic Theory papers later.

## Included

- Final Theory Papers 1–10
- 500 multiple-choice questions
- 36 embedded diagrams that work offline
- Progress saved locally in the browser
- Phone-first practice mode with a persistent Papers/Cheatsheets/Scores tab bar, thumb-friendly exam controls, and a collapsible question palette
- Shuffled practice attempts, scoring, flags, and answer review
- Missed-answer review that opens on the first wrong response and jumps directly between wrong questions
- Immediate right/wrong feedback after each locked answer, with choice-specific teaching explanations for mistakes
- A mobile-friendly tricky-topics cheat sheet with memory hooks and date-sensitive demerit-point guidance
- A searchable, topic-grouped knowledge index with 464 distinct question-and-answer facts after exact duplicate merging
- Topic-matched links to official Traffic Police and LTA guidance

Open `index.html` directly in a browser. No installation or internet connection is required for practice; internet access is only needed when opening an official-source link.

## Rebuild

```sh
node generate-offline-practice.mjs
```

The generator reads the captured paper data and local diagram files, then produces both `index.html` and `final-theory-offline-practice.html` as self-contained files.

## Sources and notice

Teaching notes link to official Singapore Traffic Police and Land Transport Authority resources, including the official Final Driving Theory Handbook, road-safety guidance, driving rules, expressway guidance, and Driver Improvement Point System information.

The captured mock questions are included for personal study and educational use. They remain the property of their respective rights holders. This repository does not claim affiliation with or endorsement by ComfortDelGro Driving Centre, the Singapore Police Force, or the Land Transport Authority.
