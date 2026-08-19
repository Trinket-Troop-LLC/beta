'use client'

import { useRouter } from 'next/navigation'
import { useRef, useState } from 'react'
import { Images, LoaderCircle } from 'lucide-react'
import { compressBulletinPhoto } from '@/lib/compress-image'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { createBulletinPost } from './actions'

const bulletinPhotosBucket = 'bulletin-photos'
const maxPhotoCount = 3
const maxOriginalPhotoBytes = 20 * 1024 * 1024

export function BulletinComposer() {
    const router = useRouter()
    const [content, setContent] = useState('')
    const [photos, setPhotos] = useState<File[]>([])
    const [photoPreviews, setPhotoPreviews] = useState<string[]>([])
    const [troopOnly, setTroopOnly] = useState(false)
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
        setPhotoPreviews((current) => [...current, ...compressed.map((file) => URL.createObjectURL(file))])
    }

    function removePhoto(index: number) {
        URL.revokeObjectURL(photoPreviews[index])
        setPhotos((current) => current.filter((_, i) => i !== index))
        setPhotoPreviews((current) => current.filter((_, i) => i !== index))
    }

    async function handleSubmit(event: React.FormEvent) {
        event.preventDefault()

        const trimmed = content.trim()
        if (!trimmed) {
            setError('Write something to post.')
            return
        }

        setIsSubmitting(true)
        setError(null)

        try {
            const db = createClient()
            const { data: { user } } = await db.auth.getUser()

            if (!user) {
                setError('Sign in again before posting.')
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

            const result = await createBulletinPost(trimmed, imagePaths, troopOnly ? 'troop' : 'global')

            if (!result.success) {
                setError(result.error ?? 'Could not create your post. Please try again.')
                return
            }

            photoPreviews.forEach((url) => URL.revokeObjectURL(url))
            setContent('')
            setPhotos([])
            setPhotoPreviews([])
            setTroopOnly(false)
            router.refresh()
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <form onSubmit={handleSubmit} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <textarea
                value={content}
                onChange={(event) => setContent(event.target.value)}
                placeholder="Share a thought with the troop..."
                rows={3}
                maxLength={2000}
                className="w-full resize-none rounded-xl border border-input bg-background px-4 py-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20"
            />

            {photoPreviews.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                    {photoPreviews.map((url, index) => (
                        <div key={url} className="relative size-20 overflow-hidden rounded-lg border border-border">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={url} alt="" className="size-full object-cover" />
                            <button
                                type="button"
                                onClick={() => removePhoto(index)}
                                className="absolute right-1 top-1 flex size-5 items-center justify-center rounded-full bg-black/60 text-xs text-white"
                                aria-label="Remove photo"
                            >
                                ×
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {error && (
                <p className="mt-2 text-sm text-destructive" role="alert">
                    {error}
                </p>
            )}

            <div className="mt-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <button
                        type="button"
                        onClick={() => photoInputRef.current?.click()}
                        disabled={photos.length >= maxPhotoCount}
                        className="flex items-center gap-1.5 text-sm text-muted-foreground transition hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        <Images className="size-4" aria-hidden="true" />
                        Add photo
                    </button>
                    <input
                        ref={photoInputRef}
                        type="file"
                        accept="image/jpeg,image/png"
                        multiple
                        onChange={handlePhotoChange}
                        className="hidden"
                    />

                    <label className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <input
                            type="checkbox"
                            checked={troopOnly}
                            onChange={(event) => setTroopOnly(event.target.checked)}
                            className="size-4 rounded border-input"
                        />
                        Post to my troop only
                    </label>
                </div>

                <Button type="submit" disabled={isSubmitting} size="sm">
                    {isSubmitting && <LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" />}
                    {isSubmitting ? 'Posting…' : 'Post'}
                </Button>
            </div>
        </form>
    )
}
