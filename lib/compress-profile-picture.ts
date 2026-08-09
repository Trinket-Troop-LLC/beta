const maxProfilePictureDimension = 1600
const profilePictureQuality = 0.85

export async function compressProfilePicture(file: File): Promise<File> {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })

    try {
        const scale = Math.min(1, maxProfilePictureDimension / Math.max(bitmap.width, bitmap.height))
        const width = Math.round(bitmap.width * scale)
        const height = Math.round(bitmap.height * scale)

        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height

        const context = canvas.getContext('2d')

        if (!context) {
            throw new Error('Canvas is not supported')
        }

        context.drawImage(bitmap, 0, 0, width, height)

        const blob = await new Promise<Blob>((resolve, reject) => {
            canvas.toBlob(
                (result) => (result ? resolve(result) : reject(new Error('Could not compress image'))),
                'image/jpeg',
                profilePictureQuality,
            )
        })

        const baseName = file.name.replace(/\.[^./]+$/, '') || 'profile-picture'
        return new File([blob], `${baseName}.jpg`, { type: 'image/jpeg' })
    } finally {
        bitmap.close()
    }
}
