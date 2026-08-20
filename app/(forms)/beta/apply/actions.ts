'use server'

import { createClient } from '@/lib/supabase/server'
import { getVerifiedImageExtension } from '@/lib/validate-image'
import { z } from 'zod'

const profilePictureBucket = 'beta-profile-pictures'
const maxProfilePictureBytes = 8 * 1024 * 1024

type SubmitResult = {
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

const betaApplicationSchema = z
    .object({
        first_name: z.string().trim().min(1, 'First name is required').max(100),
        last_name: z.string().trim().min(1, 'Last name is required').max(100),
        preferred_name: z.string().trim().max(100),
        email: z.string().trim().email('Please enter a valid email').max(320),
        phone_number: z.string()
            .trim()
            .min(1, 'Phone number is required')
            .transform((val) => val.replace(/\D/g, ''))
            .refine((digits) => digits.length === 10 || (digits.length === 11 && digits.startsWith('1')), {
                message: 'Please enter a valid 10-digit phone number',
            })
            .transform((digits) => digits.length === 11 ? `+${digits}` : `+1${digits}`),
        username: z.string().trim().min(1, 'Username is required').max(100),
        neighborhood: z.string().trim().min(1, 'Neighborhoods are required').max(2000),
        emojis: z.string().trim().min(1, 'Emojis are required').max(100),
        categories: z
            .array(categorySchema)
            .min(1, 'Select at least one category')
            .max(7)
            .transform((categories) => [...new Set(categories)]),
        other_category: z.string().trim().max(200),
        pain_points: z.string().trim().max(3000),
        future_features: z.string().trim().max(3000),
        misc_thoughts: z.string().trim().max(3000),
        sms_consent: z.enum(['true', '']).transform((val) => val === 'true'),
        tos_consent: z.enum(['true', '']).transform((val) => val === 'true'),
        website: z.string().max(200),
    })
    .superRefine((application, context) => {
        if (application.categories.includes('other') && !application.other_category) {
            context.addIssue({
                code: 'custom',
                message: 'Please describe the other category',
                path: ['other_category'],
            })
        }
        if (!application.tos_consent) {
            context.addIssue({
                code: 'custom',
                message: 'Please agree to the Terms of Service and Privacy Policy to continue',
                path: ['tos_consent'],
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

export async function submitBetaApplication(formData: FormData): Promise<SubmitResult> {
    const validationFields = betaApplicationSchema.safeParse({
        first_name: getText(formData, 'first_name'),
        last_name: getText(formData, 'last_name'),
        preferred_name: getText(formData, 'preferred_name'),
        email: getText(formData, 'email'),
        phone_number: getText(formData, 'phone_number'),
        username: getText(formData, 'username'),
        neighborhood: getText(formData, 'neighborhood'),
        emojis: getText(formData, 'emojis'),
        categories: formData
            .getAll('categories')
            .filter((category): category is string => typeof category === 'string'),
        other_category: getText(formData, 'other_category'),
        pain_points: getText(formData, 'pain_points'),
        future_features: getText(formData, 'future_features'),
        misc_thoughts: getText(formData, 'misc_thoughts'),
        sms_consent: getText(formData, 'sms_consent'),
        tos_consent: getText(formData, 'tos_consent'),
        website: getText(formData, 'website'),
    })

    if (!validationFields.success) {
        return {
            success: false,
            fieldErrors: buildFieldErrors(validationFields.error),
        }
    }

    if (validationFields.data.website) {
        return { success: true }
    }

    const profilePicture = formData.get('profile_pic')
    let profilePicturePath: string | null = null
    const db = await createClient()

    if (!(profilePicture instanceof File) || profilePicture.size === 0) {
        return {
            success: false,
            fieldErrors: { profile_pic: 'A profile picture is required' },
        }
    }

    const verifiedImage = await getVerifiedImageExtension(profilePicture, maxProfilePictureBytes)

    if ('error' in verifiedImage) {
        return {
            success: false,
            fieldErrors: { profile_pic: verifiedImage.error } as Record<string, string>,
        }
    }

    profilePicturePath = `submissions/${crypto.randomUUID()}.${verifiedImage.extension}`

    const { error: uploadError } = await db.storage
        .from(profilePictureBucket)
        .upload(profilePicturePath, profilePicture, {
            cacheControl: '3600',
            contentType: verifiedImage.contentType,
            upsert: false,
        })

    if (uploadError) {
        console.error('Beta profile picture upload failed:', uploadError.statusCode)
        return {
            success: false,
            error: 'We could not upload the profile picture right now. Please try again.',
        }
    }

    const {
        first_name,
        last_name,
        preferred_name,
        email,
        phone_number,
        username,
        neighborhood,
        emojis,
        categories,
        other_category,
        pain_points,
        future_features,
        misc_thoughts,
        sms_consent,
        tos_consent,
    } = validationFields.data

    const { error } = await db.from('applicants').insert({
        first_name,
        last_name,
        preferred_name: preferred_name || null,
        email: email.toLowerCase(),
        phone_number,
        username,
        status: 'pending',
        responses: {
            neighborhood,
            emojis,
            categories,
            other_category: categories.includes('other') ? other_category : null,
            pain_points,
            future_features,
            misc_thoughts: misc_thoughts || null,
            profile_picture_path: profilePicturePath,
            sms_consent,
            tos_consent,
        },
    })

    if (error) {
        if (error.code === '23505') {
            return {
                success: false,
                error: 'An application with this email or username has already been submitted.',
            }
        }

        console.error('Beta application submission failed:', error.code)
        return {
            success: false,
            error: 'We could not submit the beta application right now. Please try again.',
        }
    }

    return { success: true }
}