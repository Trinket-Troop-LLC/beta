export function formatLastActive(lastActiveAt: string | null): string {
    if (!lastActiveAt) return 'Never active'

    const diffMs = Date.now() - new Date(lastActiveAt).getTime()
    const diffMinutes = Math.floor(diffMs / 60000)

    if (diffMinutes < 1) return 'Active just now'
    if (diffMinutes < 60) return `Active ${diffMinutes}m ago`

    const diffHours = Math.floor(diffMinutes / 60)
    if (diffHours < 24) return `Active ${diffHours}h ago`

    const diffDays = Math.floor(diffHours / 24)
    return `Active ${diffDays}d ago`
}