# Theory Go Where

An offline-friendly Singapore driving-theory practice app. It currently contains five completed Final Theory mock papers and is structured to support Basic Theory papers later.

## Included

- Final Theory Papers 2, 4, 5, 6, and 9
- 250 multiple-choice questions
- 19 embedded diagrams that work offline
- Progress saved locally in the browser
- Shuffled practice attempts, scoring, flags, and answer review
- Choice-specific teaching feedback for incorrect answers
- Topic-matched links to official Traffic Police and LTA guidance
- Placeholder cards for Papers 1, 3, 7, 8, and 10

Open `index.html` directly in a browser. No installation or internet connection is required for practice; internet access is only needed when opening an official-source link.

## Rebuild

```sh
node generate-offline-practice.mjs
```

The generator reads the captured paper data and local diagram files, then produces both `index.html` and `final-theory-offline-practice.html` as self-contained files.

## Sources and notice

Teaching notes link to official Singapore Traffic Police and Land Transport Authority resources, including the official Final Driving Theory Handbook, road-safety guidance, driving rules, expressway guidance, and Driver Improvement Point System information.

The captured mock questions are included for personal study and educational use. They remain the property of their respective rights holders. This repository does not claim affiliation with or endorsement by ComfortDelGro Driving Centre, the Singapore Police Force, or the Land Transport Authority.
