import { Suspense } from 'react'
import { requireMember } from '@/lib/supabase/require-member'
import { signProfilePictureUrl, signProfilePictureUrls } from '@/lib/supabase/profile-pictures'
import { BetaBottomNav } from '@/components/beta-bottom-nav'
import { Skeleton } from '@/components/ui/skeleton'
import { ProfileSection } from './profile-section'
import { ProfileViewSwitcher } from './profile-view-switcher'
import { MyTroop } from './my-troop'
import type { ListingCardData } from '@/components/listings/listing-card'

type ProfileSearchParams = Promise<{ tab?: string | string[] }>

async function ProfileContent({ searchParams }: { searchParams: ProfileSearchParams }) {
    const { tab } = await searchParams
    const { profile, db, user } = await requireMember()

    // These five only depend on user.id, not on each other — run them together
    // instead of one round-trip at a time.
    const [
        { data: fullProfile },
        { data: listingRows, error: listingsError },
        { data: fullMyTroop }, // accepted friendships
        { data: outgoingRequests }, // sent requests — friendship row id kept alongside each person's id
        { data: incomingRequests }, // received requests
    ] = await Promise.all([
        db
            .from('users')
            .select('email, first_name, preferred_name, username, responses, created_at')
            .eq('id', user.id)
            .single(),
        db
            .from('listings')
            .select('id, title, category, other_category, condition, transaction_types, price_cents, pickup_area, status, published_at')
            .eq('owner_id', user.id)
            .in('status', ['active', 'reserved', 'fulfilled'])
            .order('published_at', { ascending: false }),
        db
            .from('friendships')
            .select('*')
            .eq('status', 'accepted')
            .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`),
        db
            .from('friendships')
            .select('*')
            .eq('requester_id', user.id)
            .eq('status', 'pending'),
        db
            .from('friendships')
            .select('*')
            .eq('addressee_id', user.id)
            .eq('status', 'pending'),
    ])

    const listingIds = listingRows?.map((listing) => listing.id) ?? []
    const friendIds = fullMyTroop?.map((row) => row.requester_id === user.id ? row.addressee_id : row.requester_id) ?? []
    const outgoingMap = new Map(outgoingRequests?.map((row) => [row.addressee_id, row.id]) ?? [])
    const requestedFriendsIds = [...outgoingMap.keys()]
    const incomingMap = new Map(incomingRequests?.map((row) => [row.requester_id, row.id]) ?? [])
    const incomingFriendsIds = [...incomingMap.keys()]

    // Second wave: each of these depends on a result above, but not on each
    // other, so they still run concurrently rather than one after another.
    const [
        profilePictureUrl,
        { data: coverPhotos, error: coverPhotosError },
        friendsWithPictures,
        outgoingWithPicturesRaw,
        incomingWithPicturesRaw,
    ] = await Promise.all([
        signProfilePictureUrl(db, fullProfile?.responses?.profile_picture_path),
        listingIds.length > 0
            ? db
                .from('listing_photos')
                .select('listing_id, storage_path')
                .in('listing_id', listingIds)
                .eq('position', 0)
            : { data: [], error: null },
        resolveProfilesWithPictures(db, friendIds),
        resolveProfilesWithPictures(db, requestedFriendsIds),
        resolveProfilesWithPictures(db, incomingFriendsIds),
    ])

    const outgoingWithPictures = outgoingWithPicturesRaw
        .map((person) => ({ ...person, friendshipId: outgoingMap.get(person.id)! }))
    const incomingWithPictures = incomingWithPicturesRaw
        .map((person) => ({ ...person, friendshipId: incomingMap.get(person.id)! }))

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

    return (
        <>
            <ProfileViewSwitcher
                profileView={
                    <ProfileSection
                        username={fullProfile?.username ?? profile.username}
                        preferredName={fullProfile?.preferred_name || fullProfile?.first_name || null}
                        profilePictureUrl={profilePictureUrl}
                        responses={fullProfile?.responses ?? null}
                        listings={listings}
                        listingsLoadError={listingsLoadError}
                        initialTab={tab === 'listings' ? 'listings' : 'about'}
                    />
                }
                troopView={
                    <MyTroop
                        userId={profile.id}
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

function ProfileSkeleton() {
    return (
        <div className="w-full max-w-3xl py-10">
            <div className="mb-6 flex flex-col items-center">
                <Skeleton className="mb-3 size-20 rounded-full" />
                <Skeleton className="mb-2 h-6 w-40" />
                <Skeleton className="h-4 w-56 max-w-full" />
            </div>
            <div className="mb-6 flex justify-center gap-2">
                <Skeleton className="h-8 w-20 rounded-full" />
                <Skeleton className="h-8 w-20 rounded-full" />
            </div>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => (
                    <Skeleton key={i} className="aspect-square w-full rounded-xl" />
                ))}
            </div>
        </div>
    )
}

export default function ProfilePage({ searchParams }: { searchParams: ProfileSearchParams }) {
    return (
        <main className="relative flex min-h-screen flex-col items-center justify-center bg-background px-4 pb-28 text-center">
            <Suspense fallback={<ProfileSkeleton />}>
                <div className="w-full max-w-3xl py-10">
                    <ProfileContent searchParams={searchParams} />
                </div>
            </Suspense>
            <BetaBottomNav />
        </main>
    )
}
