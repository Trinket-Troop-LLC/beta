const dateFormatter = new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeZone: 'America/New_York',
})

export function formatDateLabel(value: string) {
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? '—' : dateFormatter.format(date)
}
