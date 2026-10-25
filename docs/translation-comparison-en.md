# Chrome built-in translation and Google Translate comparison

[한국어](translation-comparison.md) · [English](translation-comparison-en.md) · [日本語](translation-comparison-ja.md)

## Method

On 2026-10-26, each engine translated 24 synthetic English sentences into Korean once. The set covered everyday conversation, idioms, negation and quantities, technical terms, proper names, colloquial speech, ambiguity, long sentences, split and joined subtitles, conditions, and units.

- Chrome: saved results from the user running the `Translator` API on a local test page. The browser reported Chrome 156; the translation model version was not collected.
- Google: direct execution of AST's `translateCuesWithGoogle`, using `/translate_a/t?client=gtx`. These are not official Google Cloud Translation API results.
- Sources, reference translations, actual responses, and item assessments: [test data](translation-comparison-results.json). References and assessment notes are in Korean.

## Assessment and results

This is the author's qualitative assessment. A score of 4 means meaning and key expressions were preserved; 3 means core meaning was preserved with minor awkwardness or omissions; 2 means partial meaning with an important expression lost; 1 means major mistranslation; 0 means the main intent was lost or reversed. The references written before the test were not treated as the only acceptable translations.

The context-free sentence `I saw her duck.` was excluded because both the bird and the act of ducking are valid readings. Across the remaining 23 items, Chrome scored 52/92 and Google scored 63/92. Google led on 6 items, Chrome led on 0, and 17 tied. These scores are not accuracy percentages.

| Case | Chrome built-in | Google Translate |
| --- | --- | --- |
| `give me a hand` | Literal hand gesture | Awkward wording, but preserved the request for help |
| `generalizes poorly` | Lost the poor-performance meaning | Preserved the core meaning |
| `Green River` | Translated as a green-colored river | Preserved the proper name |
| `spilled the beans` | Literal spilled beans | Literal spilled beans |
| `not unlikely` | Reversed the likelihood | Reversed the likelihood |
| `her duck` with an approaching ball | Her bird | Her bird |

## Timing and limitations

Chrome initialization, including model download and preparation, took 7.56 seconds. Its subsequent 24 translation calls totaled 196.8ms, with a median of 7.7ms. Google's complete AST batch path took 332.7ms. Request structure, cache state, and execution environments differ; these measurements do not establish a speed ranking.

This is a small, challenging synthetic sample without external reviewers or repeated measurements. It does not represent other languages, videos, or model versions. Both engines failed some idiom and context cases.

## Decision for AST

Google led in this trial, so the results do not justify replacing the default engine with Chrome built-in translation to improve quality. Local processing or a backup for Google connection failures remains worth investigating. The Chrome Translator API is not currently integrated into AST.
