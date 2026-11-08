// Platform measurement conventions, independent of examples, AI, or provider data.
export const standardClaimFields = {
  schemaVersion: 1,
  confidencePct: null,
  rationale: "",
  assumptions: [],
  returnConvention: { kind: "price_return", dividends: "excluded", splits: "adjusted" },
  measurement: {
    start: "first_observation_after_commitment",
    end: "first_observation_on_or_after_target",
    sampling: "daily",
    calendarArithmetic: "calendar_units_clamp_month_end",
    missingData: "await_data_never_substitute",
  },
} as const;
