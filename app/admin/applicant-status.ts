export const applicantStatuses = ["pending", "approved", "rejected"] as const;

export type ApplicantStatus = (typeof applicantStatuses)[number];

export function isApplicantStatus(value: unknown): value is ApplicantStatus {
  return (
    typeof value === "string" &&
    applicantStatuses.includes(value as ApplicantStatus)
  );
}
