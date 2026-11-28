export type SessionUser = {
	id: string;
	name: string;
	email: string;
	image?: string | null;
	verified?: boolean;
	creator?: boolean;
	bannedUntil?: string | null;
};

export type Author = {
	id: string;
	name: string;
	image: string | null;
	verified: boolean;
	creator?: boolean;
};

export type VideoCardData = {
	id: string;
	title: string;
	description?: string | null;
	thumbnail: string | null;
	videoUrl: string;
	duration: number;
	viewCount: number;
	createdAt: Date | string;
	progress?: number;
	isShort?: boolean;
	hasMusic?: boolean;
	user: Author;
};

export type ChannelSummary = {
	id: string;
	name: string;
	image: string | null;
	verified: boolean;
	subscriberCount: number;
};

export type CommentData = {
	id: string;
	content: string;
	createdAt: Date | string;
	likeCount: number;
	likedByMe: boolean;
	pinned?: boolean;
	user: Author;
	replies: CommentData[];
};
