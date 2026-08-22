'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

const viewportSize = 280
const outputSize = 640
const maxZoom = 4
const outputQuality = 0.85

type Position = { x: number; y: number }

type Gesture =
    | { type: 'pan'; pointerId: number; startX: number; startY: number; startPos: Position }
    // Anchored on the pinch's midpoint (or the wheel cursor) so the point of
    // the photo under your fingers/cursor stays put as the zoom changes,
    // instead of the image drifting out from under the gesture.
    | { type: 'pinch'; startDistance: number; startZoom: number; anchor: Position; anchorImagePoint: Position }

function clampPosition(pos: Position, displayedW: number, displayedH: number): Position {
    const minX = Math.min(0, viewportSize - displayedW)
    const minY = Math.min(0, viewportSize - displayedH)
    return {
        x: Math.min(0, Math.max(minX, pos.x)),
        y: Math.min(0, Math.max(minY, pos.y)),
    }
}

function distanceBetween(a: Position, b: Position) {
    return Math.hypot(a.x - b.x, a.y - b.y)
}

export function ProfilePictureCropper({
    file,
    onCancel,
    onCropped,
}: {
    file: File
    onCancel: () => void
    onCropped: (file: File) => void
}) {
    const [imageUrl, setImageUrl] = useState<string | null>(null)
    const [naturalSize, setNaturalSize] = useState<{ width: number; height: number } | null>(null)
    const [zoom, setZoom] = useState(1)
    const [pos, setPos] = useState<Position>({ x: 0, y: 0 })
    const [error, setError] = useState<string | null>(null)
    const [isExporting, setIsExporting] = useState(false)
    const imgRef = useRef<HTMLImageElement>(null)
    const containerRef = useRef<HTMLDivElement>(null)
    const pointers = useRef<Map<number, Position>>(new Map())
    const gesture = useRef<Gesture | null>(null)

    useEffect(() => {
        const url = URL.createObjectURL(file)
        setImageUrl(url)
        return () => URL.revokeObjectURL(url)
    }, [file])

    // The scale that makes the image exactly cover the (square) viewport with
    // no gaps -- the floor for zoom, since going below it would show empty
    // space around the circle.
    const baseScale = useMemo(() => {
        if (!naturalSize) return 1
        return Math.max(viewportSize / naturalSize.width, viewportSize / naturalSize.height)
    }, [naturalSize])

    const scale = baseScale * zoom
    const displayedW = (naturalSize?.width ?? 0) * scale
    const displayedH = (naturalSize?.height ?? 0) * scale

    function handleImageLoad() {
        const img = imgRef.current
        if (!img) return
        setNaturalSize({ width: img.naturalWidth, height: img.naturalHeight })
        setZoom(1)
        setPos({ x: 0, y: 0 })
    }

    function handleImageError() {
        setError('That file could not be opened as an image. Choose a different photo.')
    }

    function centerAt(width: number, height: number) {
        return { x: (viewportSize - width) / 2, y: (viewportSize - height) / 2 }
    }

    useEffect(() => {
        if (!naturalSize) return
        setPos(centerAt(displayedW, displayedH))
        // Only re-center when the image itself (or the base "cover" scale it
        // implies) changes -- zoom/pan afterward should never snap back to
        // center on their own.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [naturalSize, baseScale])

    function getLocalPoint(clientX: number, clientY: number): Position {
        const rect = containerRef.current?.getBoundingClientRect()
        return { x: clientX - (rect?.left ?? 0), y: clientY - (rect?.top ?? 0) }
    }

    // Applies a new zoom level while keeping `anchor` (a point in viewport
    // coordinates) pinned over the same spot on the photo -- e.g. the pinch
    // midpoint, or the cursor for wheel-zoom.
    function applyAnchoredZoom(nextZoomRaw: number, anchor: Position, anchorImagePoint: Position) {
        const nextZoom = Math.min(maxZoom, Math.max(1, nextZoomRaw))
        const nextScale = baseScale * nextZoom
        const nextW = (naturalSize?.width ?? 0) * nextScale
        const nextH = (naturalSize?.height ?? 0) * nextScale
        setZoom(nextZoom)
        setPos(clampPosition(
            { x: anchor.x - anchorImagePoint.x * nextScale, y: anchor.y - anchorImagePoint.y * nextScale },
            nextW,
            nextH,
        ))
    }

    function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
        event.currentTarget.setPointerCapture(event.pointerId)
        pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })

        if (pointers.current.size === 2) {
            const [p1, p2] = [...pointers.current.values()]
            const midpoint = getLocalPoint((p1.x + p2.x) / 2, (p1.y + p2.y) / 2)
            gesture.current = {
                type: 'pinch',
                startDistance: distanceBetween(p1, p2),
                startZoom: zoom,
                anchor: midpoint,
                anchorImagePoint: { x: (midpoint.x - pos.x) / scale, y: (midpoint.y - pos.y) / scale },
            }
        } else if (pointers.current.size === 1) {
            gesture.current = { type: 'pan', pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, startPos: pos }
        }
    }

    function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
        if (!pointers.current.has(event.pointerId)) return
        pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })

        const active = gesture.current
        if (!active) return

        if (active.type === 'pan' && pointers.current.size === 1) {
            const dx = event.clientX - active.startX
            const dy = event.clientY - active.startY
            setPos(clampPosition(
                { x: active.startPos.x + dx, y: active.startPos.y + dy },
                displayedW,
                displayedH,
            ))
        } else if (active.type === 'pinch' && pointers.current.size === 2) {
            const [p1, p2] = [...pointers.current.values()]
            const distance = distanceBetween(p1, p2)
            applyAnchoredZoom(active.startZoom * (distance / active.startDistance), active.anchor, active.anchorImagePoint)
        }
    }

    function endPointer(event: React.PointerEvent<HTMLDivElement>) {
        pointers.current.delete(event.pointerId)

        if (pointers.current.size === 1) {
            // Resume single-finger panning from here rather than jumping to
            // whatever position the pinch gesture's math would otherwise imply.
            const [[pointerId, point]] = [...pointers.current.entries()]
            gesture.current = { type: 'pan', pointerId, startX: point.x, startY: point.y, startPos: pos }
        } else if (pointers.current.size === 0) {
            gesture.current = null
        }
    }

    function handleWheel(event: React.WheelEvent<HTMLDivElement>) {
        event.preventDefault()
        const anchor = getLocalPoint(event.clientX, event.clientY)
        const anchorImagePoint = { x: (anchor.x - pos.x) / scale, y: (anchor.y - pos.y) / scale }
        applyAnchoredZoom(zoom - event.deltaY * 0.0025 * zoom, anchor, anchorImagePoint)
    }

    async function handleConfirm() {
        const img = imgRef.current
        if (!img || !naturalSize) return

        setIsExporting(true)
        setError(null)

        try {
            // pos/scale describe how the natural-size image is displayed inside
            // the viewport -- invert that to find which square region of the
            // original image the viewport is currently showing.
            const sourceSize = viewportSize / scale
            const sourceX = -pos.x / scale
            const sourceY = -pos.y / scale

            const canvas = document.createElement('canvas')
            canvas.width = outputSize
            canvas.height = outputSize
            const context = canvas.getContext('2d')
            if (!context) throw new Error('Canvas is not supported')

            context.drawImage(img, sourceX, sourceY, sourceSize, sourceSize, 0, 0, outputSize, outputSize)

            const blob = await new Promise<Blob>((resolve, reject) => {
                canvas.toBlob(
                    (result) => (result ? resolve(result) : reject(new Error('Could not export image'))),
                    'image/jpeg',
                    outputQuality,
                )
            })

            const baseName = file.name.replace(/\.[^./]+$/, '') || 'profile-picture'
            onCropped(new File([blob], `${baseName}.jpg`, { type: 'image/jpeg' }))
        } catch {
            setError('Could not crop that photo. Please try again.')
        } finally {
            setIsExporting(false)
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
            <div className="flex w-full max-w-sm flex-col gap-4 rounded-2xl bg-card p-5 shadow-lg">
                <p className="text-sm font-medium text-foreground">Adjust your photo</p>

                <div
                    ref={containerRef}
                    className="relative mx-auto touch-none overflow-hidden rounded-full border border-border bg-secondary"
                    style={{ width: viewportSize, height: viewportSize, cursor: 'grab' }}
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={endPointer}
                    onPointerCancel={endPointer}
                    onWheel={handleWheel}
                >
                    {imageUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                            ref={imgRef}
                            src={imageUrl}
                            alt="Selected profile picture"
                            onLoad={handleImageLoad}
                            onError={handleImageError}
                            draggable={false}
                            className="absolute select-none"
                            style={{
                                left: pos.x,
                                top: pos.y,
                                width: displayedW || undefined,
                                height: displayedH || undefined,
                                maxWidth: 'none',
                            }}
                        />
                    )}
                </div>

                <p className="text-center text-sm text-muted-foreground">
                    Drag to reposition &middot; pinch to zoom
                </p>

                {error && (
                    <p className="text-sm text-red-600" role="alert">{error}</p>
                )}

                <div className="flex gap-3">
                    <button
                        type="button"
                        onClick={handleConfirm}
                        disabled={isExporting || !naturalSize}
                        className="rounded-lg bg-primary px-4 py-2 font-medium text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {isExporting ? 'saving...' : 'use this photo'}
                    </button>
                    <button
                        type="button"
                        onClick={onCancel}
                        disabled={isExporting}
                        className="rounded-lg border border-border px-4 py-2 font-medium text-foreground transition hover:bg-secondary"
                    >
                        cancel
                    </button>
                </div>
            </div>
        </div>
    )
}
