// Shared with AuthPage (registration) and the dashboards (map destination
// pin) so there's one source of truth for the known campus addresses.
export const UNIVERSITIES = [
  { value: "", label: "Select a university…", address: "" },
  {
    value: "ucla_anderson",
    label: "UCLA Anderson School of Management",
    address: "110 Westwood Plaza, Los Angeles, CA 90095",
  },
  { value: "ucla", label: "UCLA (University of California, Los Angeles)", address: "405 Hilgard Ave, Los Angeles, CA 90095" },
  { value: "other", label: "Other / not listed", address: "" },
];

const DEFAULT_DESTINATION = UNIVERSITIES.find((u) => u.value === "ucla").address;

/** Best-effort: turn a stored university label (or free text) back into a
 * known campus address, falling back to the general UCLA address so the
 * map always has *something* to point at. */
export function addressForUniversity(universityLabel) {
  if (!universityLabel) return DEFAULT_DESTINATION;
  const match = UNIVERSITIES.find((u) => u.label === universityLabel && u.address);
  return match ? match.address : DEFAULT_DESTINATION;
}
