export type ImageValidationResult =
    | { extension: 'png'; contentType: 'image/png' }
    | { extension: 'jpg'; contentType: 'image/jpeg' }
    | { error: string }

export async function getVerifiedImageExtension(
    file: File,
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
