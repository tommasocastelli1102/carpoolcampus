// Single source of truth for payment method options — driver registration
// preferences, ride-request payment choice, review "how did you pay", and
// the balance page's "mark as paid" picker all pull from this list.
export const PAYMENT_METHODS = [
  { value: "venmo", label: "Venmo" },
  { value: "zelle", label: "Zelle" },
  { value: "revolut", label: "Revolut" },
  { value: "cash", label: "Cash" },
  { value: "beer", label: "Beer" },
  { value: "aux_cord", label: "Aux cord / set the music" },
  { value: "coffee", label: "Coffee" },
  { value: "other", label: "Other" },
];

export const PAYMENT_LABELS = Object.fromEntries(PAYMENT_METHODS.map((m) => [m.value, m.label]));
