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
                Name
                <input type="text" name="name" required />
            </label>
            
            <label>
                Email
                <input type="email" name="email" required />
            </label>

            <label>
                Why are you interested?
                <textarea name="why_interested" required />
            </label>

            <label>
                How did you hear about us?
                <textarea name="how_heard" required />
            </label>

            <button type="submit">Submit</button>
            {error && <p>{error}</p>}
        </form>
    )
}

