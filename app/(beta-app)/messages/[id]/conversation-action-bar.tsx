'use client'

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

// Listing-linked threads already have their own domain-specific ways to
// close (mark complete / didn't work out / unreserve below) -- a plain
// "end conversation" control is only for threads with no transaction
// attached to them, so it can't be used to dodge that flow.
export function ConversationActionBar({
    status,
    listingStatus,
    isLend,
    isListingOwner,
    isUpdatingListing,
    showReturnChoice,
    setShowReturnChoice,
    onMarkFulfilled,
    onUnreserve,
    onMarkReturned,
    canEndConversation,
    isEnding,
    showEndConfirm,
    setShowEndConfirm,
    onEndConversation,
}: {
    status: 'pending' | 'active'
    listingStatus: string | null
    isLend: boolean
    isListingOwner: boolean
    isUpdatingListing: boolean
    showReturnChoice: boolean
    setShowReturnChoice: (show: boolean) => void
    onMarkFulfilled: () => void
    onUnreserve: () => void
    onMarkReturned: (action: 'relist' | 'remove') => void
    canEndConversation: boolean
    isEnding: boolean
    showEndConfirm: boolean
    setShowEndConfirm: (show: boolean) => void
    onEndConversation: () => void
}) {
    return (
        <div className="flex flex-wrap items-center gap-2 border-b border-[#ded8cc]/70 bg-[#faf7f0]/90 px-4 py-3">
            <Link href="/messages" className="shrink-0 text-[#625f58] hover:text-[#30392d]">
                <ArrowLeft size={20} />
            </Link>

            <div className="flex flex-1 flex-wrap items-center justify-end gap-2">
                {listingStatus === 'reserved' && isLend && isListingOwner && (
                    showReturnChoice ? (
                        <>
                            <button
                                onClick={() => onMarkReturned('relist')}
                                disabled={isUpdatingListing}
                                className="rounded-full bg-[#7c9272] px-3 py-1.5 text-xs font-medium text-white transition hover:bg-[#667b5f] disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                Relist it
                            </button>
                            <button
                                onClick={() => onMarkReturned('remove')}
                                disabled={isUpdatingListing}
                                className="rounded-full border border-[#ded8cc] px-3 py-1.5 text-xs font-medium text-[#625f58] transition hover:bg-[#f5efe5] disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                Remove from profile
                            </button>
                        </>
                    ) : (
                        <>
                            <button
                                onClick={() => setShowReturnChoice(true)}
                                disabled={isUpdatingListing}
                                className="rounded-full bg-[#7c9272] px-3 py-1.5 text-xs font-medium text-white transition hover:bg-[#667b5f] disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                Item returned
                            </button>
                            <button
                                onClick={onUnreserve}
                                disabled={isUpdatingListing}
                                className="rounded-full border border-[#ded8cc] px-3 py-1.5 text-xs font-medium text-[#625f58] transition hover:bg-[#f5efe5] disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                Didn&apos;t work out
                            </button>
                        </>
                    )
                )}

                {listingStatus === 'reserved' && !isLend && isListingOwner && (
                    <>
                        <button
                            onClick={onMarkFulfilled}
                            disabled={isUpdatingListing}
                            className="rounded-full bg-[#7c9272] px-3 py-1.5 text-xs font-medium text-white transition hover:bg-[#667b5f] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            Mark complete
                        </button>
                        <button
                            onClick={onUnreserve}
                            disabled={isUpdatingListing}
                            className="rounded-full border border-[#ded8cc] px-3 py-1.5 text-xs font-medium text-[#625f58] transition hover:bg-[#f5efe5] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            Didn&apos;t work out
                        </button>
                    </>
                )}

                {canEndConversation && status === 'active' && (
                    showEndConfirm ? (
                        <div className="flex shrink-0 items-center gap-2 text-xs">
                            <span className="text-[#625f58]">End this conversation?</span>
                            <button
                                type="button"
                                onClick={onEndConversation}
                                disabled={isEnding}
                                className="rounded-full bg-red-600 px-2.5 py-1 font-medium text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                End
                            </button>
                            <button
                                type="button"
                                onClick={() => setShowEndConfirm(false)}
                                disabled={isEnding}
                                className="rounded-full border border-[#ded8cc] px-2.5 py-1 font-medium text-[#625f58] transition hover:bg-[#f5efe5]"
                            >
                                Cancel
                            </button>
                        </div>
                    ) : (
                        <button
                            type="button"
                            onClick={() => setShowEndConfirm(true)}
                            className="shrink-0 rounded-full px-2.5 py-1 text-xs font-medium text-[#7c8072] transition hover:bg-[#f5efe5] hover:text-[#30392d]"
                        >
                            End conversation
                        </button>
                    )
                )}
            </div>
        </div>
    )
}
