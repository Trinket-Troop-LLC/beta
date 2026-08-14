import { unstable_cache } from 'next/cache'
import type { createClient } from '@/lib/supabase/server'

type Db = Awaited<ReturnType<typeof createClient>>

const BUCKET = 'bulletin-photos'
const EXPIRES_IN_SECONDS = 60 * 60
// Stay comfortably under EXPIRES_IN_SECONDS so a cached URL is never served
// past the point where it'd actually be expired.
const CACHE_REVALIDATE_SECONDS = 55 * 60

async function signCached(db: Db, path: string): Promise<string | null> {
    const getSignedUrl = unstable_cache(
        async (p: string) => {
            const { data } = await db.storage.from(BUCKET).createSignedUrl(p, EXPIRES_IN_SECONDS)
            return data?.signedUrl ?? null
        },
        ['bulletin-photo-signed-url', path],
        { revalidate: CACHE_REVALIDATE_SECONDS }
    )
    return getSignedUrl(path)
}

/** Signs a single bulletin photo path, reusing a cached URL when one is still fresh. */
export async function signBulletinPhotoUrl(db: Db, path: string | null | undefined): Promise<string | null> {
    if (!path) return null
    return signCached(db, path)
}

/**
 * Signs a batch of bulletin photo paths, keyed by path so callers with
 * overlapping paths share cache hits.
 */
export async function signBulletinPhotoUrls(
    db: Db,
    paths: (string | null | undefined)[]
): Promise<Map<string, string>> {
    const uniquePaths = [...new Set(paths.filter((path): path is string => Boolean(path)))]
    if (uniquePaths.length === 0) return new Map()

    const entries = await Promise.all(
        uniquePaths.map(async (path) => [path, await signCached(db, path)] as const)
    )

    return new Map(entries.filter((entry): entry is [string, string] => Boolean(entry[1])))
}
