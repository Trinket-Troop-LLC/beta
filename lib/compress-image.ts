type CompressImageOptions = {
    maxDimension: number
    quality: number
    fallbackName: string
    background?: string
}

export async function compressImage(file: File, options: CompressImageOptions): Promise<File> {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })

    try {
        const scale = Math.min(1, options.maxDimension / Math.max(bitmap.width, bitmap.height))
        const width = Math.max(1, Math.round(bitmap.width * scale))
        const height = Math.max(1, Math.round(bitmap.height * scale))

        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height

        const context = canvas.getContext('2d')

        if (!context) {
            throw new Error('Canvas is not supported')
        }

        if (options.background) {
            context.fillStyle = options.background
            context.fillRect(0, 0, width, height)
        }

        context.drawImage(bitmap, 0, 0, width, height)

        const blob = await new Promise<Blob>((resolve, reject) => {
            canvas.toBlob(
                (result) => (result ? resolve(result) : reject(new Error('Could not compress image'))),
                'image/jpeg',
                options.quality,
            )
        })

        const baseName = file.name.replace(/\.[^./]+$/, '') || options.fallbackName
        return new File([blob], `${baseName}.jpg`, { type: 'image/jpeg' })
    } finally {
        bitmap.close()
    }
}

export function compressListingPhoto(file: File) {
    return compressImage(file, {
        maxDimension: 1600,
        quality: 0.82,
        fallbackName: 'listing-photo',
        background: '#fbf7f1',
    })
}

export function compressBulletinPhoto(file: File) {
    return compressImage(file, {
        maxDimension: 1600,
        quality: 0.82,
        fallbackName: 'bulletin-photo',
        background: '#fbf7f1',
    })
}
