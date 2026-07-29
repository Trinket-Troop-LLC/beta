'use client'

import { useState } from 'react'
import { submitApplication } from './actions'

export default function ApplicationForm() {
    const [submitted, setSubmitted] = useState(false)
    const [error, setError] = useState<string | null>(null)

    async function handleSubmit(formData: FormData) {
        const result = await submitApplication(formData)
        if (result.success) {
            setSubmitted(true)
        } else {
            setError(result.error ?? 'Something went wrong')
        }
    }

    if (submitted) {
        return <p>Thank you for submitting your application form! Keep
            a look out for an email from us!
        </p>
    }

    return (
        <form action={handleSubmit}>
            <label>
                First Name
                <input type="text" name="first_name" required />
            </label>
            <label>
                Last Name
                <input type="text" name="last_name" required />
            </label>
            <label>
                Preferred Name
                <input type="text" name="preferred_name" />
            </label>
            <label>
                Email
                <input type="email" name="email" required />
            </label>
            <label>
                Phone Number
                <input type="tel" name="phone_number" required />
            </label>
            <label>
                Upload a profile picture
                <input
                    type="file"
                    name="profile_pic"
                    accept="image/png, image/jpeg"
                />
            </label>

            <label>
                What neighborhood do you frequent? (live, work, or where
                you're regularly around)
                <textarea name="neighborhood" required />
            </label>

            <label>
                Three emojis that describe you
                <input type="text" name="emojis" required />
            </label>

            <label>
                What are the typical things you like to buy/sell/trade
                secondhand?
                <textarea name="what_trading" required />
            </label>

            <fieldset>
                <legend>Trinket categories (select all that apply)</legend>
                <label>
                    <input type="checkbox" name="categories" value="wearable" />
                    Wearable
                </label>
                <label>
                    <input type="checkbox" name="categories" value="home" />
                    Home
                </label>
                <label>
                    <input type="checkbox" name="categories" value="kitchen" />
                    Kitchen
                </label>
                <label>
                    <input type="checkbox" name="categories" value="outdoorsy" />
                    Outdoorsy
                </label>
                <label>
                    <input type="checkbox" name="categories" value="hobby" />
                    Hobby
                </label>
                <label>
                    <input type="checkbox" name="categories" value="other" />
                    Other:
                    <input type="text" name="other_category" />
                </label>
            </fieldset>

            <label>
                What are the main pain points with NYC person-to-person
                secondhand exchange?
                <textarea name="pain_points" required />
            </label>

            <label>
                Features you wanna see?
                <textarea name="future_features" required />
            </label>

            <label>
                Anyone you think might benefit from this platform? (if yes,
                enter their email)
                <input type="email" name="referral_email" />
            </label>

            <label>
                Anything else you wanna say?
                <textarea name="misc_thoughts" />
            </label>

            <button type="submit">Submit</button>
            {error && <p>{error}</p>}

            <footer>
                <p>Questions? Reach us at hello@yoursite.com</p>
                <a href="https://buymeacoffee.com/yourpage" target="_blank" rel="noreferrer">
                    Buy us a coffee ☕
                </a>
            </footer>
        </form>
    )
}

