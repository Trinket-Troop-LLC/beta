'use server'

import { createClient } from '@/lib/supabase/server'
import { getVerifiedImageExtension } from '@/lib/validate-image'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

const profilePictureBucket = 'beta-profile-pictures'
const maxProfilePictureBytes = 8 * 1024 * 1024

type UpdateResult = {
    success: boolean
    error?: string
    fieldErrors?: Record<string, string>
}

const categorySchema = z.enum([
    'true',
    'wearable',
    'home',
    'kitchen',
    'outdoorsy',
    'hobby',
    'other',
])

const updateProfileSchema = z
    .object({
        preferred_name: z.string().trim().max(100),
        username: z.string().trim().min(1, 'Username is required').max(100),
        neighborhood: z.string().trim().max(2000),
        emojis: z.string().trim().max(100),
        categories: z
            .array(categorySchema)
            .max(7)
            .transform((categories) => [...new Set(categories)]),
        other_category: z.string().trim().max(200),
    })
    .superRefine((profile, context) => {
        if (profile.categories.includes('other') && !profile.other_category) {
            context.addIssue({
                code: 'custom',
                message: 'Please describe the other category',
                path: ['other_category'],
            })
        }
    })

function getText(formData: FormData, name: string) {
    const value = formData.get(name)
    return typeof value === 'string' ? value : ''
}

function buildFieldErrors(error: z.ZodError): Record<string, string> {
    const fieldErrors: Record<string, string> = {}
    for (const issue of error.issues) {
        const field = issue.path[0]?.toString()
        if (field && !fieldErrors[field]) {
            fieldErrors[field] = issue.message
        }
    }
    return fieldErrors
}

export async function updateProfile(formData: FormData): Promise<UpdateResult> {
    const db = await createClient()
    const { data: { user } } = await db.auth.getUser()

    if (!user) {
        return { success: false, error: 'You must be logged in.' }
    }

    const validationFields = updateProfileSchema.safeParse({
        preferred_name: getText(formData, 'preferred_name'),
        username: getText(formData, 'username'),
        neighborhood: getText(formData, 'neighborhood'),
        emojis: getText(formData, 'emojis'),
        categories: formData
            .getAll('categories')
            .filter((category): category is string => typeof category === 'string'),
        other_category: getText(formData, 'other_category'),
    })

    if (!validationFields.success) {
        return { success: false, fieldErrors: buildFieldErrors(validationFields.error) }
    }

    const { data: currentProfile } = await db
        .from('users')
        .select('responses')
        .eq('id', user.id)
        .single()

    let profilePicturePath: string | null = currentProfile?.responses?.profile_picture_path ?? null

    const profilePicture = formData.get('profile_pic')
    if (profilePicture instanceof File && profilePicture.size > 0) {
        const verifiedImage = await getVerifiedImageExtension(profilePicture, maxProfilePictureBytes)

        if ('error' in verifiedImage) {
            return { success: false, fieldErrors: { profile_pic: verifiedImage.error } }
        }

        const newPath = `submissions/${crypto.randomUUID()}.${verifiedImage.extension}`

        const { error: uploadError } = await db.storage
            .from(profilePictureBucket)
            .upload(newPath, profilePicture, {
                cacheControl: '3600',
                contentType: verifiedImage.contentType,
                upsert: false,
            })

        if (uploadError) {
            console.error('Profile picture upload failed:', uploadError.statusCode)
            return {
                success: false,
                error: 'We could not upload the profile picture right now. Please try again.',
            }
        }

        profilePicturePath = newPath
    }

    const { preferred_name, username, neighborhood, emojis, categories, other_category } = validationFields.data

    const { error } = await db
        .from('users')
        .update({
            username,
            preferred_name: preferred_name || null,
            responses: {
                ...currentProfile?.responses,
                neighborhood: neighborhood || null,
                emojis: emojis || null,
                categories,
                other_category: categories.includes('other') ? other_category || null : null,
                profile_picture_path: profilePicturePath,
            },
        })
        .eq('id', user.id)

    if (error) {
        if (error.code === '23505') {
            return { success: false, fieldErrors: { username: 'That username is already taken.' } }
        }

        console.error('Profile update failed:', error.code)
        return {
            success: false,
            error: 'We could not update your profile right now. Please try again.',
        }
    }

    revalidatePath('/profile')
    return { success: true }
}
