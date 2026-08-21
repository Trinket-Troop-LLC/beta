export function formatTimestamp(isoDate: string): string {
    return new Date(isoDate).toLocaleString(undefined, {
        hour: 'numeric',
        minute: '2-digit',
    })
}