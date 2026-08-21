'use client'

import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'
import { Images, LoaderCircle, X } from 'lucide-react'
import { compressBulletinPhoto } from '@/lib/compress-image'
import { createClient } from '@/lib/supabase/client'
import { createBulletinPost, createBulletinReply } from './actions'
import type { BulletinAuthor, BulletinPost, BulletinReply } from './types'

const bulletinPhotosBucket = 'bulletin-photos'
const maxPhotoCount = 4
const maxOriginalPhotoBytes = 20 * 1024 * 1024
const maxContentLength = 2000

type PreparedPhoto = { file: File; previewUrl: string }

type BulletinComposerProps =
    | {
        variant: 'post'
        currentUser: BulletinAuthor
        onPosted: (post: BulletinPost) => void
    }
    | {
        variant: 'reply'
        postId: string
        currentUser: BulletinAuthor
        parentReplyId?: string
        replyingToUsername?: string
        onPosted: (reply: BulletinReply) => void
        onCancel: () => void
    }

export function BulletinComposer(props: BulletinComposerProps) {
    const { variant, currentUser, onPosted } = props
    const [content, setContent] = useState('')
    const [photos, setPhotos] = useState<PreparedPhoto[]>([])
    const [isPreparingPhotos, setIsPreparingPhotos] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [progress, setProgress] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)
    const inputRef = useRef<HTMLInputElement>(null)
    const [allowMessages, setAllowMessages] = useState(true)
    const [visibility, setVisibility] = useState<'public' | 'troop'>('public')

    const photosRef = useRef(photos)
    photosRef.current = photos

    useEffect(() => {
        return () => {
            photosRef.current.forEach((photo) => URL.revokeObjectURL(photo.previewUrl))
        }
    }, [])
    
    async function handlePhotoChange(event: React.ChangeEvent<HTMLInputElement>) {
        const input = event.currentTarget
        const selected = Array.from(input.files ?? [])
        input.value = ''

        if (selected.length === 0) return

        setError(null)

        if (photos.length + selected.length > maxPhotoCount) {
            setError(`Choose no more than ${maxPhotoCount} photos.`)
            return
        }

        if (typeof createImageBitmap !== 'function') {
            setError('This browser cannot prepare photos. Update it or use another browser.')
            return
        }

        setIsPreparingPhotos(true)

        try {
            const prepared: PreparedPhoto[] = []

            for (const photo of selected) {
                if (photo.type !== 'image/jpeg' && photo.type !== 'image/png') {
                    throw new Error(`"${photo.name}" is not a PNG or JPEG image.`)
                }

                if (photo.size > maxOriginalPhotoBytes) {
                    throw new Error(`"${photo.name}" is larger than the 20 MB selection limit.`)
                }

                let compressed: File
                try {
                    compressed = await compressBulletinPhoto(photo)
                } catch {
                    throw new Error(`"${photo.name}" could not be opened or resized.`)
                }

                prepared.push({ file: compressed, previewUrl: URL.createObjectURL(compressed) })
            }

            setPhotos((current) => [...current, ...prepared])
        } catch (photoError) {
            setError(photoError instanceof Error ? photoError.message : 'Those photos could not be prepared.')
        } finally {
            setIsPreparingPhotos(false)
        }
    }

    function removePhoto(index: number) {
        setPhotos((current) => {
            URL.revokeObjectURL(current[index].previewUrl)
            return current.filter((_, i) => i !== index)
        })
    }

    async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault()

        const trimmed = content.trim()
        if (!trimmed) {
            setError(variant === 'post' ? 'Write a message to post on the bulletin.' : 'Write a reply.')
            return
        }
        if (trimmed.length > maxContentLength) {
            setError(`Keep it to ${maxContentLength} characters or fewer.`)
            return
        }

        setError(null)
        setIsSubmitting(true)
        setProgress(photos.length > 0 ? `uploading photo 1 of ${photos.length}...` : 'posting...')

        const db = createClient()
        const uploadedPaths: string[] = []

        try {
            for (const [index, photo] of photos.entries()) {
                setProgress(`uploading photo ${index + 1} of ${photos.length}...`)
                const path = `${currentUser.id}/${crypto.randomUUID()}.jpg`

                const { error: uploadError } = await db.storage
                    .from(bulletinPhotosBucket)
                    .upload(path, photo.file, {
                        cacheControl: '3600',
                        contentType: 'image/jpeg',
                        upsert: false,
                    })

                if (uploadError) {
                    throw new Error('A photo could not be uploaded. Check your connection and try again.')
                }

                uploadedPaths.push(path)
            }

            setProgress(variant === 'post' ? 'posting...' : 'replying...')

            const photoUrls = photos.map((photo) => photo.previewUrl)

            if (variant === 'post') {
                const result = await createBulletinPost(trimmed, uploadedPaths, allowMessages, visibility)

                if (!result.success) {
                    throw new Error(result.error)
                }

                onPosted({
                    id: result.postId,
                    author: currentUser,
                    content: trimmed,
                    createdAt: new Date().toISOString(),
                    photoUrls,
                    replies: [],
                    visibility,
                    allowMessages,
                })
            } else {
                const result = await createBulletinReply(
                    props.postId,
                    trimmed,
                    uploadedPaths,
                    props.parentReplyId,
                )

                if (!result.success) {
                    throw new Error(result.error)
                }

                onPosted({
                    id: result.replyId,
                    postId: props.postId,
                    author: currentUser,
                    content: trimmed,
                    createdAt: new Date().toISOString(),
                    photoUrls,
                    parentReplyId: result.parentReplyId,
                    parentAuthorUsername: result.parentReplyId ? props.replyingToUsername ?? null : null,
                })
            }

            setAllowMessages(true)
            setVisibility('public')

            setContent('')
            setPhotos([])
        } catch (submitError) {
            setError(submitError instanceof Error ? submitError.message : 'Something went wrong. Please try again.')
        } finally {
            setIsSubmitting(false)
            setProgress(null)
        }
    }

    const isBusy = isSubmitting || isPreparingPhotos

    return (
        <form
            onSubmit={handleSubmit}
            aria-busy={isBusy}
            className={variant === 'post'
                ? 'flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm'
                : 'flex flex-col gap-2 rounded-xl border border-border bg-background p-3'}
        >
            {variant === 'reply' && props.replyingToUsername && (
                <p className="text-xs font-medium text-primary">
                    Replying to @{props.replyingToUsername}
                </p>
            )}

            {variant === 'post' && (
                <>
                    <label className="flex items-center gap-2 text-sm text-foreground">
                        <input
                            type="checkbox"
                            checked={allowMessages}
                            onChange={(e) => setAllowMessages(e.target.checked)}
                            className="size-4 accent-primary"
                        />
                        Allow people to message me about this post
                    </label>

                    <label className="flex flex-col gap-1 text-sm text-foreground">
                        Who can see this post?
                        <select
                            value={visibility}
                            onChange={(e) => setVisibility(e.target.value as 'public' | 'troop')}
                            className="rounded-lg border border-input bg-white px-4 py-3 text-black outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                        >
                            <option value="public">Public</option>
                            <option value="troop">Troop only</option>
                        </select>
                    </label>

                    {visibility === 'troop' && (
                        <p className="text-xs text-muted-foreground">
                            Only your troop members will be able to see this post. This can&apos;t be changed later.
                        </p>
                    )}
                </>
            )}
            <textarea
                value={content}
                onChange={(event) => setContent(event.target.value)}
                maxLength={maxContentLength}
                rows={variant === 'post' ? 3 : 2}
                disabled={isBusy}
                placeholder={variant === 'post'
                    ? "What's on your mind?"
                    : variant === 'reply' && props.replyingToUsername
                        ? `Reply to @${props.replyingToUsername}...`
                        : 'Write a reply...'}
                className="resize-none rounded-lg border border-input bg-white px-3 py-2 text-sm text-black outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
            />

            {photos.length > 0 && (
                <div className="grid grid-cols-4 gap-2">
                    {photos.map((photo, index) => (
                        <div
                            key={photo.previewUrl}
                            className="relative aspect-square overflow-hidden rounded-lg border border-border bg-muted"
                        >
                            <Image
                                src={photo.previewUrl}
                                alt={`Photo ${index + 1} preview`}
                                fill
                                sizes="120px"
                                className="object-cover"
                                unoptimized
                            />
                            <button
                                type="button"
                                onClick={() => removePhoto(index)}
                                disabled={isBusy}
                                aria-label={`Remove photo ${index + 1}`}
                                className="absolute right-1 top-1 flex size-5 items-center justify-center rounded-full bg-black/60 text-white"
                            >
                                <X size={12} />
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {error && (
                <p role="alert" className="text-sm text-red-600">{error}</p>
            )}

            <div className="flex items-center justify-between gap-2">
                <label className={`flex cursor-pointer items-center gap-1.5 text-sm text-muted-foreground transition hover:text-foreground ${isBusy || photos.length >= maxPhotoCount ? 'pointer-events-none opacity-50' : ''}`}>
                    <Images size={16} />
                    photos
                    <input
                        ref={inputRef}
                        type="file"
                        accept="image/png,image/jpeg"
                        multiple
                        disabled={isBusy || photos.length >= maxPhotoCount}
                        onChange={handlePhotoChange}
                        className="sr-only"
                    />
                </label>

                <div className="flex items-center gap-2">
                    {variant === 'reply' && (
                        <button
                            type="button"
                            onClick={props.onCancel}
                            disabled={isSubmitting}
                            className="rounded-full px-3 py-1.5 text-sm font-medium text-muted-foreground transition hover:bg-muted"
                        >
                            Cancel
                        </button>
                    )}
                    <button
                        type="submit"
                        disabled={isBusy || !content.trim()}
                        className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {isBusy && <LoaderCircle size={14} className="animate-spin" />}
                        {progress ?? (variant === 'post' ? 'Post' : 'Reply')}
                    </button>
                </div>
            </div>
        </form>
    )
}
