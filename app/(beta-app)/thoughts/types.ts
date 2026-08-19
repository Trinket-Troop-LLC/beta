export type BulletinAuthor = {
    id: string
    username: string
    profilePictureUrl: string | null
}

export type BulletinReply = {
    id: string
    postId: string
    author: BulletinAuthor
    content: string
    createdAt: string
    photoUrls: string[]
    parentReplyId: string | null
    parentAuthorUsername: string | null
}

export type BulletinPost = {
    id: string
    author: BulletinAuthor
    content: string
    createdAt: string
    photoUrls: string[]
    replies: BulletinReply[]
    visibility: 'global' | 'troop'
    isTroopAuthor: boolean
}
