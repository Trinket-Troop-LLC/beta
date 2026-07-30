'use client'
import { useState } from 'react'
import { submitApplication } from './actions'
import { SiteHeader } from '@/components/layout/site-header'
import { ApplyHero } from '@/components/landing/apply-hero'

export default function ApplicationForm() {
    const [submitted, setSubmitted] = useState(false)
    const [error, setError] = useState<string | null>(null)

    async function handleSubmit(formData: FormData) {
        setError(null)
        const result = await submitApplication(formData)
        if (result.success) {
            setSubmitted(true)
        } else {
            setError(result.error ?? 'Something went wrong')
        }
    }

    const inputClass = "rounded-lg border border-[#d8d1c5] bg-white text-black px-4 py-3"
    const labelClass = "flex flex-col gap-2 text-[#2c2c2c]"
    const checkboxLabelClass = "flex items-center gap-2 text-[#2c2c2c]"

    return (
        <div className="min-h-screen bg-[#faf7f0]">
            <SiteHeader />
            <ApplyHero />
            <main className="mx-auto max-w-3xl px-4 py-12">
                {submitted ? (
                <p className="text-center text-lg text-[#455442]">
                    thank you for submitting your application! keep an eye out for an
                    email from us.
                </p>
                ) : (
                <form
                    action={handleSubmit}
                    className="flex flex-col gap-6 rounded-2xl border border-[#ded8cc] bg-[#fffdf9] p-8 shadow-sm"
                >
                    <label className={labelClass}>
                        <span>first name</span>
                        <input type="text" name="first_name" required className={inputClass} />
                    </label>

                    <label className={labelClass}>
                        <span>last name</span>
                        <input type="text" name="last_name" required className={inputClass} />
                    </label>

                    <label className={labelClass}>
                        <span>preferred name</span>
                        <input type="text" name="preferred_name" className={inputClass} />
                    </label>

                    <label className={labelClass}>
                        <span>email</span>
                        <input type="email" name="email" required className={inputClass} />
                    </label>

                    <label className={labelClass}>
                        <span>phone number</span>
                        <input type="tel" name="phone_number" required className={inputClass} />
                    </label>

                    <label className={labelClass}>
                        <span></span>username
                        <input type="text" name="username" className={inputClass} />
                    </label>

                    <label className={labelClass}>
                        <span>upload a profile picture</span>
                        <input
                            type="file"
                            name="profile_pic"
                            accept="image/png, image/jpeg"
                            className={`${inputClass} file:mr-4 file:rounded-md file:border-0 file:bg-[#7c9272] file:px-3 file:py-2 file:text-white`}
                        />
                    </label>

                    <label className={labelClass}>
                        <span>what neighborhood do you frequent? (live, work, or where you're regularly around)</span>
                        <textarea name="neighborhood" required rows={3} className={inputClass} />
                    </label>

                    <label className={labelClass}>
                        <span>three emojis that describe you</span>
                        <input type="text" name="emojis" required className={inputClass} />
                    </label>


                    <fieldset className="flex flex-col gap-2 text-[#2c2c2c]">
                        <legend className="mb-1 font-medium">trinket categories (select all that apply)</legend>
                        <label className={checkboxLabelClass}>
                            <input type="checkbox" name="categories" value="wearable" />
                            true trinkets
                        </label>
                        <label className={checkboxLabelClass}>
                            <input type="checkbox" name="categories" value="wearable" />
                            wearable trinkets
                        </label>
                        <label className={checkboxLabelClass}>
                            <input type="checkbox" name="categories" value="home" />
                            home trinkets
                        </label>
                        <label className={checkboxLabelClass}>
                            <input type="checkbox" name="categories" value="kitchen" />
                            kitchen trinkets
                        </label>
                        <label className={checkboxLabelClass}>
                            <input type="checkbox" name="categories" value="outdoorsy" />
                            outdoorsy trinkets
                        </label>
                        <label className={checkboxLabelClass}>
                            <input type="checkbox" name="categories" value="hobby" />
                            hooby trinkets
                        </label>
                        <label className={checkboxLabelClass}>
                            <input type="checkbox" name="categories" value="other" />
                            other:
                            <input type="text" name="other_category" className={`${inputClass} flex-1`} />
                        </label>
                    </fieldset>

                    <label className={labelClass}>
                        <span>what are the main pain points with NYC person-to-person secondhand exchange?</span>
                        <textarea name="pain_points" required rows={4} className={inputClass} />
                    </label>

                    <label className={labelClass}>
                        <span>features you wanna see?</span>
                        <textarea name="future_features" required rows={3} className={inputClass} />
                    </label>

                    <label className={labelClass}>
                        <span>anyone you think might benefit from this platform? (if yes, enter their email)</span>
                        <input type="email" name="referral_email" className={inputClass} />
                    </label>

                    <label className={labelClass}>
                        <span>anything else you wanna say?</span>
                        <textarea name="misc_thoughts" rows={3} className={inputClass} />
                    </label>

                    <button
                        type="submit"
                        className="rounded-lg bg-[#7c9272] px-4 py-3 font-medium text-white transition hover:bg-[#667b5f]"
                    >
                        submit
                    </button>
                    {error && <p className="text-sm text-red-600">{error}</p>}
                </form>
            )}

            <footer className="mt-10 text-center text-sm text-[#7c8072]">
                <p>Questions? Reach us at @trinkettroop on Instagram</p>
                <a href="https://buymeacoffee.com/trinkettroop" target="_blank" rel="noreferrer" className="underline">
                    Buy us a coffee {"\u2615"}
                </a>
            </footer>
        </main>
    </div>
    )
}
