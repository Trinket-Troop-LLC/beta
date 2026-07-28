'use client'
import { updateApplicantStatus } from './actions'

export function StatusDropdown({ applicantId, currentStatus }: { applicantId: string, currentStatus: string }) {
  return (
    <select
      defaultValue={currentStatus}
      onChange={(e) => updateApplicantStatus(applicantId, e.target.value as 'approved' | 'rejected')}
    >
      <option value="pending">Pending</option>
      <option value="approved">Approved</option>
      <option value="rejected">Rejected</option>
    </select>
  )
}