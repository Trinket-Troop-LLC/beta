'use client'
import { useState, useTransition } from 'react'
import { updateApplicantStatus } from './actions'
import {
  type ApplicantStatus,
  applicantStatuses,
  isApplicantStatus,
} from './applicant-status'

export function StatusDropdown({ applicantId, currentStatus }: { applicantId: string, currentStatus: string }) {
  const initialStatus = isApplicantStatus(currentStatus) ? currentStatus : 'pending'
  const [status, setStatus] = useState<ApplicantStatus>(initialStatus)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleStatusChange(nextStatus: string) {
    if (!isApplicantStatus(nextStatus) || nextStatus === status) {
      return
    }

    const previousStatus = status
    setStatus(nextStatus)
    setMessage(null)
    setError(null)

    startTransition(async () => {
      const result = await updateApplicantStatus(applicantId, nextStatus)

      if (!result.success) {
        setStatus(previousStatus)
        setError(result.error)
        return
      }

      setMessage(result.emailSent ? 'Approval email sent.' : 'Status updated.')
    })
  }

  return (
    <div className="flex min-w-44 flex-col items-center gap-1.5">
      <select
        aria-label="Applicant status"
        className="w-full rounded-lg border border-[#9aaa90] bg-white px-3 py-2 text-sm text-[#455442] outline-none transition focus:border-[#667b5f] focus:ring-2 focus:ring-[#87977d]/30 disabled:cursor-wait disabled:opacity-60"
        disabled={isPending}
        value={status}
        onChange={(event) => handleStatusChange(event.target.value)}
      >
        {applicantStatuses.map((applicantStatus) => (
          <option key={applicantStatus} value={applicantStatus}>
            {applicantStatus.charAt(0).toUpperCase() + applicantStatus.slice(1)}
          </option>
        ))}
      </select>

      {isPending && (
        <p className="text-xs text-[#7c8072]" role="status">
          {status === 'approved' ? 'Approving and sending email…' : 'Updating status…'}
        </p>
      )}
      {!isPending && message && (
        <p className="text-xs text-[#5f7258]" role="status">{message}</p>
      )}
      {!isPending && error && (
        <p className="max-w-56 text-xs text-red-600" role="alert">{error}</p>
      )}
    </div>
  )
}
