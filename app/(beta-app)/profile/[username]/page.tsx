import { Suspense } from 'react'
import { notFound, redirect } from 'next/navigation'
import { requireMember } from '@/lib/supabase/require-member'
import { signProfilePictureUrl } from '@/lib/supabase/profile-pictures'
import type { ListingBrowseCardData } from '@/components/listings/listing-browse-card'
import { OtherProfileSection } from './other-profile-section'
import type { Relationship } from '../friendship-actions'

async function OtherProfileContent({ username }: { username: string }) {
    const { db, user } = await requireMember()

    const { data: target } = await db
        .from('users')
        .select('id, username, preferred_name, first_name, responses, last_active_at')
        .eq('username', username)
        .maybeSingle()

    if (!target) {
        notFound()
    }

    if (target.id === user.id) {
        redirect('/profile')
    }

    const profilePictureUrl = await signProfilePictureUrl(db, target.responses?.profile_picture_path)

    const { data: listingRows } = await db
        .from('listings')
        .select('id, title, transaction_types, price_cents, status, category, published_at')
        .eq('owner_id', target.id)
        .in('status', ['active', 'reserved'])
        .order('published_at', { ascending: false })

    const listingIds = listingRows?.map((listing) => listing.id) ?? []
    const { data: coverPhotos } = listingIds.length > 0
        ? await db
            .from('listing_photos')
            .select('listing_id, storage_path')
            .in('listing_id', listingIds)
            .eq('position', 0)
        : { data: [] }

    const coverPaths = coverPhotos?.map((photo) => photo.storage_path) ?? []
    const { data: signedCoverPhotos } = coverPaths.length > 0
        ? await db.storage.from('listing-photos').createSignedUrls(coverPaths, 3600)
        : { data: [] }

    const coverPathByListingId = new Map(
        coverPhotos?.map((photo) => [photo.listing_id, photo.storage_path]) ?? [],
    )
    const signedUrlByPath = new Map(
        signedCoverPhotos?.map((photo) => [photo.path, photo.signedUrl]) ?? [],
    )

    const listings: ListingBrowseCardData[] = (listingRows ?? []).map((listing) => {
        const coverPath = coverPathByListingId.get(listing.id)
        return {
            id: listing.id,
            title: listing.title,
            transaction_types: listing.transaction_types,
            price_cents: listing.price_cents,
            status: listing.status,
            category: listing.category,
            coverPhotoUrl: coverPath ? signedUrlByPath.get(coverPath) ?? null : null,
        }
    })

    const { data: friendshipRow } = await db
        .from('friendships')
        .select('id, requester_id, addressee_id, status')
        .or(`and(requester_id.eq.${user.id},addressee_id.eq.${target.id}),and(requester_id.eq.${target.id},addressee_id.eq.${user.id})`)
        .maybeSingle()

    let relationship: Relationship = 'none'
    if (friendshipRow) {
        if (friendshipRow.status === 'accepted') {
            relationship = 'friend'
        } else if (friendshipRow.requester_id === user.id) {
            relationship = 'sent'
        } else {
            relationship = 'received'
        }
    }

    return (
        <OtherProfileSection
            profileId={target.id}
            username={target.username}
            preferredName={target.preferred_name || target.first_name || null}
            profilePictureUrl={profilePictureUrl}
            lastActive={target.last_active_at}
            responses={target.responses ?? null}
            listings={listings}
            relationship={relationship}
            friendshipId={friendshipRow?.id ?? null}
        />
    )
}

export default async function OtherProfilePage({ params }: { params: Promise<{ username: string }> }) {
    const { username } = await params

    return (
        <main className="relative flex flex-1 flex-col items-center justify-center px-8 pb-40 text-center">
            <Suspense fallback={null}>
                <div className="w-full max-w-3xl py-10">
                    <OtherProfileContent username={username} />
                </div>
            </Suspense>
        </main>
    )
}
