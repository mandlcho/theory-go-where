# Theory Go Where

An offline-friendly Singapore driving-theory practice app. It contains all ten Final Theory mock papers and is structured to support Basic Theory papers later.

## Included

- Final Theory Papers 1–10
- 500 multiple-choice questions
- 36 diagrams represented by 31 de-duplicated, high-quality WebP assets
- Progress saved locally in an independent record for each paper, with automatic migration from older saves
- Persistent icon-controlled light/night themes with compact, low-weight console typography throughout
- Viewport-fitted phone practice with persistent Papers/Cheatsheets/Scores tabs, thumb-friendly controls, a collapsible question palette, and no scrolling for typical answer and feedback states
- Shuffled practice attempts, scoring, flags, and answer review
- Missed-answer review that opens on the first wrong response and jumps directly between wrong questions
- Immediate right/wrong feedback after each locked answer, with choice-specific teaching explanations for mistakes
- A mobile-friendly tricky-topics cheat sheet with memory hooks and date-sensitive demerit-point guidance
- A searchable, topic-grouped knowledge index with 464 distinct question-and-answer facts after exact duplicate merging
- Topic-matched links to official Traffic Police and LTA guidance
- Per-paper and knowledge-index lazy loading, stable diagram sizing, and an offline cache for fast repeat visits

Use the [GitHub Pages site](https://mandlcho.github.io/theory-go-where/) for the optimized installable experience. It caches all papers and diagrams after the first successful visit so subsequent practice works offline. For a single downloadable file, open `final-theory-offline-practice.html`; it contains every paper and optimized diagram without requiring a server. Internet access is only needed when opening an official-source link.

## Rebuild

```sh
node generate-offline-practice.mjs
```

The generator reads the captured paper data and local diagrams, then produces the lightweight app shell, per-paper JSON files, manifest, service worker and self-contained offline backup. Optimized WebP assets are content-addressed in `optimized-assets/`.

## Sources and notice

Teaching notes link to official Singapore Traffic Police and Land Transport Authority resources, including the official Final Driving Theory Handbook, road-safety guidance, driving rules, expressway guidance, and Driver Improvement Point System information.

The captured mock questions are included for personal study and educational use. They remain the property of their respective rights holders. This repository does not claim affiliation with or endorsement by ComfortDelGro Driving Centre, the Singapore Police Force, or the Land Transport Authority.
