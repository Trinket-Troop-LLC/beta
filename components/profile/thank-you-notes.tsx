export type ProfileThankYouNote = {
    id: string
    note: string
    reviewerUsername: string
    createdAt: string | null
}

export function ThankYouNotes({ notes }: { notes: ProfileThankYouNote[] }) {
    return (
        <section className="border-t border-border pt-4">
            <h2 className="text-sm font-medium text-muted-foreground">Thank you notes</h2>

            {notes.length > 0 ? (
                <ul className="mt-3 space-y-3">
                    {notes.map((note) => (
                        <li
                            key={note.id}
                            className="rounded-xl bg-secondary/60 p-4"
                        >
                            <p className="whitespace-pre-wrap break-words text-foreground">{note.note}</p>
                            <p className="mt-2 text-sm text-muted-foreground">@{note.reviewerUsername}</p>
                        </li>
                    ))}
                </ul>
            ) : (
                <p className="mt-2 text-sm text-muted-foreground">No thank you notes yet.</p>
            )}
        </section>
    )
}
