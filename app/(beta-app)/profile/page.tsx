import { Suspense } from 'react'
import { requireMember } from '@/lib/supabase/require-member'
import { signProfilePictureUrl, signProfilePictureUrls } from '@/lib/supabase/profile-pictures'
import { PushNotificationToggle } from '@/components/push-notification-toggle'
import { ProfileSection } from './profile-section'
import { ProfileViewSwitcher } from './profile-view-switcher'
import { MyTroop } from './my-troop'
import type { ListingCardData } from '@/components/listings/listing-card'

type ProfileSearchParams = Promise<{ tab?: string | string[] }>

async function ProfileContent({ searchParams }: { searchParams: ProfileSearchParams }) {
    const { tab } = await searchParams
    const { profile, db, user } = await requireMember()
    const { data: fullProfile } = await db
        .from('users')
        .select('email, first_name, preferred_name, username, responses, created_at, last_active_at')
        .eq('id', user.id)
        .single()

    const profilePictureUrl = await signProfilePictureUrl(db, fullProfile?.responses?.profile_picture_path)

    const { data: listingRows, error: listingsError } = await db
        .from('listings')
        .select('id, title, category, other_category, condition, transaction_types, price_cents, pickup_area, status, published_at')
        .eq('owner_id', user.id)
        .in('status', ['active', 'reserved'])
        .order('published_at', { ascending: false })

    const listingIds = listingRows?.map((listing) => listing.id) ?? []
    const { data: coverPhotos, error: coverPhotosError } = listingIds.length > 0
        ? await db
            .from('listing_photos')
            .select('listing_id, storage_path')
            .in('listing_id', listingIds)
            .eq('position', 0)
        : { data: [], error: null }

    const coverPaths = coverPhotos?.map((photo) => photo.storage_path) ?? []
    const { data: signedCoverPhotos, error: signedCoverPhotosError } = coverPaths.length > 0
        ? await db.storage.from('listing-photos').createSignedUrls(coverPaths, 3600)
        : { data: [], error: null }

    const hasUnsignedCover = signedCoverPhotos?.some(
        (photo) => photo.error || !photo.signedUrl,
    ) ?? false
    const listingsLoadError = Boolean(
        listingsError || coverPhotosError || signedCoverPhotosError || hasUnsignedCover,
    )

    if (listingsError) {
        console.warn('Profile listings query failed:', listingsError.code)
    }
    if (coverPhotosError) {
        console.warn('Listing cover query failed:', coverPhotosError.code)
    }
    if (signedCoverPhotosError) {
        console.warn('Listing cover signing failed:', signedCoverPhotosError.statusCode)
    }
    if (hasUnsignedCover) {
        console.warn('At least one listing cover could not be signed.')
    }

    const coverPathByListingId = new Map(
        coverPhotos?.map((photo) => [photo.listing_id, photo.storage_path]) ?? [],
    )
    const signedUrlByPath = new Map(
        signedCoverPhotos?.map((photo) => [photo.path, photo.signedUrl]) ?? [],
    )
    const listings: ListingCardData[] = (listingRows ?? []).map((listing) => {
        const coverPath = coverPathByListingId.get(listing.id)

        return {
            ...listing,
            coverPhotoUrl: coverPath ? signedUrlByPath.get(coverPath) ?? null : null,
        }
    })

    // accepted friendships
    const { data: fullMyTroop } = await db
        .from('friendships')
        .select('*')
        .eq('status', 'accepted')
        .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)

    const friendIds = fullMyTroop?.map((row) => row.requester_id === user.id ? row.addressee_id : row.requester_id) ?? []
    const friendshipIdByFriendId = new Map(
        fullMyTroop?.map((row) => [row.requester_id === user.id ? row.addressee_id : row.requester_id, row.id]) ?? [],
    )

    // outgoing (sent) requests — keep the friendship row id alongside each person's id
    const { data: outgoingRequests } = await db
        .from('friendships')
        .select('*')
        .eq('requester_id', user.id)
        .eq('status', 'pending')

    const outgoingMap = new Map(outgoingRequests?.map((row) => [row.addressee_id, row.id]) ?? [])
    const requestedFriendsIds = [...outgoingMap.keys()]

    // incoming (received) requests
    const { data: incomingRequests } = await db
        .from('friendships')
        .select('*')
        .eq('addressee_id', user.id)
        .eq('status', 'pending')

    const incomingMap = new Map(incomingRequests?.map((row) => [row.requester_id, row.id]) ?? [])
    const incomingFriendsIds = [...incomingMap.keys()]

    const friendsWithPictures = (await resolveProfilesWithPictures(db, friendIds))
        .map((person) => ({ ...person, friendshipId: friendshipIdByFriendId.get(person.id)! }))
    const outgoingWithPictures = (await resolveProfilesWithPictures(db, requestedFriendsIds))
        .map((person) => ({ ...person, friendshipId: outgoingMap.get(person.id)! }))
    const incomingWithPictures = (await resolveProfilesWithPictures(db, incomingFriendsIds))
        .map((person) => ({ ...person, friendshipId: incomingMap.get(person.id)! }))

    return (
        <>
            <div className="mb-4 text-left">
                <PushNotificationToggle />
            </div>
            <ProfileViewSwitcher
                profileView={
                    <ProfileSection
                        username={fullProfile?.username ?? profile.username}
                        preferredName={fullProfile?.preferred_name || fullProfile?.first_name || null}
                        profilePictureUrl={profilePictureUrl}
                        lastActive={fullProfile?.last_active_at}
                        responses={fullProfile?.responses ?? null}
                        listings={listings}
                        listingsLoadError={listingsLoadError}
                        initialTab={tab === 'listings' ? 'listings' : 'about'}
                    />
                }
                troopView={
                    <MyTroop
                        friendsData={friendsWithPictures}
                        outgoingRequests={outgoingWithPictures}
                        incomingRequests={incomingWithPictures}
                    />
                }
            />
        </>
    )
}

async function resolveProfilesWithPictures(db: Awaited<ReturnType<typeof requireMember>>['db'], ids: string[]) {
    const { data: profiles } = await db
        .from('users')
        .select('id, username, responses')
        .in('id', ids)

    const paths = profiles?.map((p) => p.responses?.profile_picture_path) ?? []
    const signedUrlsByPath = await signProfilePictureUrls(db, paths)

    return profiles?.map((profile) => {
        const path = profile.responses?.profile_picture_path
        return {
            id: profile.id,
            username: profile.username,
            profilePictureUrl: (path && signedUrlsByPath.get(path)) ?? null,
        }
    }) ?? []
}

export default function ProfilePage({ searchParams }: { searchParams: ProfileSearchParams }) {
    return (
        <main className="relative flex min-h-screen flex-col items-center justify-center bg-background px-4 pb-28 text-center">
            <Suspense fallback={null}>
                <div className="w-full max-w-3xl py-10">
                    <ProfileContent searchParams={searchParams} />
                </div>
            </Suspense>
        </main>
    )
}
