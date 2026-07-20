# Practice completion, manual results, and caret reliability

## Goal

Fix three related typing-session regressions without changing unrelated practice or training behaviour:

- Completing the full target in Practice Infinite must immediately open the result view.
- The blue input caret must remain clearly visible and correctly positioned in Practice and Training for English and Chinese text.
- Pressing Escape must show the current result without saving it or allowing it to affect progress.

## Completion rules

Sessions have two result eligibility classes:

- **Completed:** `time_up` for timed sessions and `text_completed` for finite-text sessions. These results follow the existing local and cloud persistence paths.
- **Manually ended:** `manual`, triggered by Escape. The result modal remains available for immediate feedback, but the result is not persisted or included in progress.

Practice Infinite is a finite-text session without a timer. Once its normalized target is fully typed according to the active typing rules, it finishes with `text_completed`. Timed Practice and timed Training continue until their timer expires even if the currently displayed text is exhausted. Training Words retains its existing full-text completion behaviour.

## Persistence boundary

Only completed results may:

- update the locally stored previous/personal result;
- append typing-attempt detail;
- upload a typing result or attempt detail;
- contribute to leaderboards, analytics, achievements, or progress milestones.

A manually ended result may calculate and display the current attempt's WPM, accuracy, elapsed time, mistakes, graph, and review. It must be labelled as manually ended or otherwise clearly identified as not saved. Previously saved comparison data may be displayed, but the manual result itself must not replace or mutate it.

## Caret behaviour

The blue input caret and the previous-pace marker are separate visual signals. The input caret follows the current comparison position; the previous-pace marker follows stored pace data.

The existing character-layer approach will be retained to minimize layout and scrolling risk. Caret styling and rendering contracts will ensure that:

- one input caret is present whenever an unfinished target has a current position;
- it remains visibly above character and token styling in light and dark themes;
- it works at ordinary characters, whitespace/token boundaries, and line breaks;
- English and Chinese Practice and Training use the same visibility contract;
- caret blink settings remain respected without allowing the low-opacity phase to become effectively invisible.

No terminal caret is required after the full target is complete because eligible finite-text sessions must transition directly to the result view.

## Implementation boundaries

The existing `finishTest` flow remains the single result-calculation entry point. A small eligibility decision derived from the completion reason will guard every persistence and progress side effect. Full-text completion detection will be extended only to Practice Infinite in addition to the existing Training Words path.

Caret changes stay within the typing character layer and its styles. This work will not redesign the typing surface, replace the session state machine, or alter previous-pace calculations.

## Testing

Regression tests will be written before production changes and must cover:

1. English and Chinese Practice Infinite opening the result when the target is completed.
2. Escape showing a manual result while leaving local previous results, attempt details, cloud saves, analytics loads, and milestones unchanged.
3. Time-up and text-completed sessions continuing to save exactly once.
4. A single current caret contract in English and Chinese Practice and Training, including token/whitespace and line-break positions.
5. Browser-level visual checks of caret visibility and result transitions in the four Practice/Training and English/Chinese combinations.

The final verification gate includes the focused regression tests, the full test suite, type checking, linting, a production build, and local browser checks.
