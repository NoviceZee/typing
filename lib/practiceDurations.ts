export const PRACTICE_DURATIONS = [
  { label: "1 min", seconds: 60 },
  { label: "5 min", seconds: 300 },
  { label: "10 min", seconds: 600 }
];

export function getDurationFilterOptions(allLabel: string) {
  return [
    { label: allLabel, value: allLabel },
    ...PRACTICE_DURATIONS.map((duration) => ({
      label: duration.label,
      value: String(duration.seconds)
    }))
  ];
}
