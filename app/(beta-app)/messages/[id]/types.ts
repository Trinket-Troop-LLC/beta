export type Message = {
    id: string
    conversation_id: string
    sender_id: string
    content: string | null
    image_path: string | null
    created_at: string
    read_at: string | null
}

export type OtherUser = {
    id: string
    username: string
    profilePictureUrl: string | null
    lastActiveAt: string | null
}
