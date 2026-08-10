export type ImageValidationResult =
    | { extension: 'png'; contentType: 'image/png' }
    | { extension: 'jpg'; contentType: 'image/jpeg' }
    | { error: string }

export type ImageDimensions = {
    width: number
    height: number
}

const jpegStartOfFrameMarkers = new Set([
    0xc0, 0xc1, 0xc2, 0xc3,
    0xc5, 0xc6, 0xc7,
    0xc9, 0xca, 0xcb,
    0xcd, 0xce, 0xcf,
])

export async function getVerifiedImageExtension(
    file: Blob,
    maxBytes = 8 * 1024 * 1024,
): Promise<ImageValidationResult> {
    if (file.size > maxBytes) {
        return { error: `Images must be ${Math.round(maxBytes / (1024 * 1024))} MB or smaller` }
    }

    if (file.type !== 'image/jpeg' && file.type !== 'image/png') {
        return { error: 'Images must be a PNG or JPEG image' }
    }

    const bytes = new Uint8Array(await file.slice(0, 8).arrayBuffer())
    const isPng =
        bytes.length >= 8 &&
        bytes[0] === 0x89 &&
        bytes[1] === 0x50 &&
        bytes[2] === 0x4e &&
        bytes[3] === 0x47 &&
        bytes[4] === 0x0d &&
        bytes[5] === 0x0a &&
        bytes[6] === 0x1a &&
        bytes[7] === 0x0a
    const isJpeg =
        bytes.length >= 3 &&
        bytes[0] === 0xff &&
        bytes[1] === 0xd8 &&
        bytes[2] === 0xff

    if (file.type === 'image/png' && isPng) {
        return { extension: 'png', contentType: 'image/png' }
    }

    if (file.type === 'image/jpeg' && isJpeg) {
        return { extension: 'jpg', contentType: 'image/jpeg' }
    }

    return { error: 'Please choose a valid PNG or JPEG image' }
}

/**
 * Reads JPEG dimensions from a Start Of Frame segment without decoding the
 * bitmap. This lets trusted upload validation reject oversized pixel canvases
 * before the image reaches Next.js image optimization.
 */
export async function getJpegDimensions(file: Blob): Promise<ImageDimensions | null> {
    const bytes = new Uint8Array(await file.arrayBuffer())

    if (
        bytes.length < 4
        || bytes[0] !== 0xff
        || bytes[1] !== 0xd8
    ) {
        return null
    }

    let offset = 2

    while (offset + 3 < bytes.length) {
        if (bytes[offset] !== 0xff) {
            offset += 1
            continue
        }

        while (offset < bytes.length && bytes[offset] === 0xff) {
            offset += 1
        }

        if (offset >= bytes.length) {
            return null
        }

        const marker = bytes[offset]
        offset += 1

        if (marker === 0xd9 || marker === 0xda) {
            return null
        }

        if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)) {
            continue
        }

        if (offset + 1 >= bytes.length) {
            return null
        }

        const segmentLength = (bytes[offset] << 8) | bytes[offset + 1]

        if (segmentLength < 2 || offset + segmentLength > bytes.length) {
            return null
        }

        if (jpegStartOfFrameMarkers.has(marker)) {
            if (segmentLength < 7) {
                return null
            }

            const height = (bytes[offset + 3] << 8) | bytes[offset + 4]
            const width = (bytes[offset + 5] << 8) | bytes[offset + 6]

            return width > 0 && height > 0 ? { width, height } : null
        }

        offset += segmentLength
    }

    return null
}
