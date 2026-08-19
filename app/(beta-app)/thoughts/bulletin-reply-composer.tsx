'use client'

import { useRouter } from 'next/navigation'
import { useRef, useState } from 'react'
import { Images, LoaderCircle } from 'lucide-react'
import { compressBulletinPhoto } from '@/lib/compress-image'
import { createClient } from '@/lib/supabase/client'
import { createBulletinReply } from './actions'

const bulletinPhotosBucket = 'bulletin-photos'
const maxPhotoCount = 2
const maxOriginalPhotoBytes = 20 * 1024 * 1024

export function BulletinReplyComposer({ postId }: { postId: string }) {
    const router = useRouter()
    const [content, setContent] = useState('')
    const [photos, setPhotos] = useState<File[]>([])
    const [error, setError] = useState<string | null>(null)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const photoInputRef = useRef<HTMLInputElement | null>(null)

    async function handlePhotoChange(event: React.ChangeEvent<HTMLInputElement>) {
        const selected = Array.from(event.target.files ?? [])
        if (photoInputRef.current) photoInputRef.current.value = ''
        if (selected.length === 0) return

        if (photos.length + selected.length > maxPhotoCount) {
            setError(`Choose no more than ${maxPhotoCount} photos.`)
            return
        }

        setError(null)
        const compressed: File[] = []

        for (const file of selected) {
            if (file.type !== 'image/jpeg' && file.type !== 'image/png') {
                setError('Choose a JPG or PNG file.')
                return
            }

            if (file.size > maxOriginalPhotoBytes) {
                setError('That photo is larger than the 20 MB selection limit.')
                return
            }

            try {
                compressed.push(await compressBulletinPhoto(file))
            } catch {
                setError('That photo could not be prepared. Choose a valid, uncorrupted JPG or PNG.')
                return
            }
        }

        setPhotos((current) => [...current, ...compressed])
    }

    async function handleSubmit(event: React.FormEvent) {
        event.preventDefault()

        const trimmed = content.trim()
        if (!trimmed) {
            setError('Write a reply.')
            return
        }

        setIsSubmitting(true)
        setError(null)

        try {
            const db = createClient()
            const { data: { user } } = await db.auth.getUser()

            if (!user) {
                setError('Sign in again before replying.')
                return
            }

            const imagePaths: string[] = []

            for (const photo of photos) {
                const path = `${user.id}/${crypto.randomUUID()}.jpg`
                const { error: uploadError } = await db.storage
                    .from(bulletinPhotosBucket)
                    .upload(path, photo, { cacheControl: '3600', contentType: 'image/jpeg', upsert: false })

                if (uploadError) {
                    setError('A photo could not upload. Check your connection and try again.')
                    return
                }

                imagePaths.push(path)
            }

            const result = await createBulletinReply(postId, trimmed, imagePaths)

            if (!result.success) {
                setError(result.error ?? 'Could not create your reply. Please try again.')
                return
            }

            setContent('')
            setPhotos([])
            router.refresh()
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <form onSubmit={handleSubmit} className="flex items-start gap-2">
            <div className="flex-1">
                <input
                    type="text"
                    value={content}
                    onChange={(event) => setContent(event.target.value)}
                    placeholder="Reply..."
                    maxLength={2000}
                    className="w-full rounded-full border border-input bg-background px-4 py-2 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
                {photos.length > 0 && (
                    <p className="mt-1 text-xs text-muted-foreground">{photos.length} photo(s) attached</p>
                )}
                {error && (
                    <p className="mt-1 text-xs text-destructive" role="alert">
                        {error}
                    </p>
                )}
            </div>

            <button
                type="button"
                onClick={() => photoInputRef.current?.click()}
                disabled={photos.length >= maxPhotoCount}
                className="flex size-9 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground transition hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Add photo"
            >
                <Images className="size-4" aria-hidden="true" />
            </button>
            <input
                ref={photoInputRef}
                type="file"
                accept="image/jpeg,image/png"
                multiple
                onChange={handlePhotoChange}
                className="hidden"
            />

            <button
                type="submit"
                disabled={isSubmitting}
                className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Send reply"
            >
                {isSubmitting ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : '→'}
            </button>
        </form>
    )
}
