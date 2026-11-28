import { sqliteTable, text, integer, uniqueIndex, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { user } from './auth.schema';

export type VideoVisibility = 'public' | 'unlisted' | 'private';

export const videos = sqliteTable(
	'videos',
	{
		id: text('id').primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		title: text('title').notNull(),
		description: text('description').default(''),
		thumbnail: text('thumbnail'),
		videoUrl: text('video_url').notNull(),
		quality: text('quality'),
		width: integer('width').notNull().default(0),
		height: integer('height').notNull().default(0),
		duration: integer('duration').notNull().default(0),
		visibility: text('visibility').$type<VideoVisibility>().notNull().default('public'),
	isShort: integer('is_short', { mode: 'boolean' }).notNull().default(false),
	hasMusic: integer('has_music', { mode: 'boolean' }).notNull().default(false),
	copyrightStatus: text('copyright_status').notNull().default('none'),
		viewCount: integer('view_count').notNull().default(0),
		likeCount: integer('like_count').notNull().default(0),
		dislikeCount: integer('dislike_count').notNull().default(0),
		commentCount: integer('comment_count').notNull().default(0),
		tags: text('tags', { mode: 'json' }).$type<string[]>().default([]),
		category: text('category').default('Другое'),
		createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
		publishedAt: integer('published_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`)
	},
	(table) => [
		index('videos_user_idx').on(table.userId),
		index('videos_created_idx').on(table.createdAt)
	]
);

export const videoReports = sqliteTable('video_reports', {
	id: text('id').primaryKey(),
	videoId: text('video_id').notNull().references(() => videos.id, { onDelete: 'cascade' }),
	userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
	reason: text('reason').notNull(),
	detail: text('detail'),
	status: text('status').notNull().default('pending'),
	createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`)
});

export const copyrightReferences = sqliteTable('copyright_references', {
	id: text('id').primaryKey(),
	ownerId: text('owner_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
	title: text('title').notNull(),
	hash: text('hash').notNull(),
	createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`)
});

export const copyrightClaims = sqliteTable('copyright_claims', {
	id: text('id').primaryKey(),
	videoId: text('video_id').notNull().references(() => videos.id, { onDelete: 'cascade' }),
	claimantId: text('claimant_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
	type: text('type').notNull().default('manual'),
	status: text('status').notNull().default('pending'),
	reason: text('reason').notNull().default(''),
	matchedHash: text('matched_hash'),
	createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
	resolvedAt: integer('resolved_at', { mode: 'timestamp' })
});

export const copyrightStrikes = sqliteTable('copyright_strikes', {
	id: text('id').primaryKey(),
	userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
	videoId: text('video_id').notNull().references(() => videos.id, { onDelete: 'cascade' }),
	reason: text('reason').notNull(),
	createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`)
});

export const streams = sqliteTable('streams', {
	id: text('id').primaryKey(),
	userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
	title: text('title').notNull().default(''),
	category: text('category').notNull().default('Другое'),
	isLive: integer('is_live', { mode: 'boolean' }).notNull().default(false),
	viewers: integer('viewers').notNull().default(0),
	startedAt: integer('started_at', { mode: 'timestamp' }),
	endedAt: integer('ended_at', { mode: 'timestamp' }),
	createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`)
});

export const streamMessages = sqliteTable('stream_messages', {
	id: text('id').primaryKey(),
	streamId: text('stream_id').notNull().references(() => streams.id, { onDelete: 'cascade' }),
	userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
	content: text('content').notNull(),
	createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`)
});

export const siteVisits = sqliteTable('site_visits', {
	id: text('id').primaryKey(),
	userId: text('user_id'),
	path: text('path').notNull(),
	createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`)
});

export const adminActions = sqliteTable('admin_actions', {
	id: text('id').primaryKey(),
	adminId: text('admin_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
	action: text('action').notNull(),
	targetId: text('target_id'),
	detail: text('detail').notNull().default(''),
	createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`)
});

export const commentReports = sqliteTable('comment_reports', {
	id: text('id').primaryKey(),
	commentId: text('comment_id').notNull().references(() => comments.id, { onDelete: 'cascade' }),
	userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
	reason: text('reason'),
	createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`)
});

export const blockedUsers = sqliteTable('blocked_users', {
	id: text('id').primaryKey(),
	userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
	blockedId: text('blocked_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
	createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`)
});

export const videoFiles = sqliteTable(
	'video_files',
	{
		id: text('id').primaryKey(),
		videoId: text('video_id').notNull().references(() => videos.id, { onDelete: 'cascade' }),
		quality: text('quality').notNull(),
		url: text('url').notNull(),
		width: integer('width').notNull().default(0),
		height: integer('height').notNull(),
		createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`)
	},
	(table) => [index('video_files_video_idx').on(table.videoId)]
);

export const comments = sqliteTable(
	'comments',
	{
		id: text('id').primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		videoId: text('video_id')
			.notNull()
			.references(() => videos.id, { onDelete: 'cascade' }),
		parentId: text('parent_id'),
		pinned: integer('pinned', { mode: 'boolean' }).notNull().default(false),
		content: text('content').notNull(),
		likeCount: integer('like_count').notNull().default(0),
		createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`)
	},
	(table) => [index('comments_video_idx').on(table.videoId)]
);

export const likes = sqliteTable(
	'likes',
	{
		id: text('id').primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		videoId: text('video_id')
			.notNull()
			.references(() => videos.id, { onDelete: 'cascade' }),
		type: integer('type').notNull(),
		createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`)
	},
	(table) => [uniqueIndex('user_video_unique').on(table.userId, table.videoId)]
);

export const commentLikes = sqliteTable(
	'comment_likes',
	{
		id: text('id').primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		commentId: text('comment_id')
			.notNull()
			.references(() => comments.id, { onDelete: 'cascade' }),
		type: integer('type').notNull(),
		createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`)
	},
	(table) => [uniqueIndex('user_comment_unique').on(table.userId, table.commentId)]
);

export const subscriptions = sqliteTable(
	'subscriptions',
	{
		id: text('id').primaryKey(),
		subscriberId: text('subscriber_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		channelId: text('channel_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`)
	},
	(table) => [uniqueIndex('subscriber_channel_unique').on(table.subscriberId, table.channelId)]
);

export const watchHistory = sqliteTable(
	'watch_history',
	{
		id: text('id').primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		videoId: text('video_id')
			.notNull()
			.references(() => videos.id, { onDelete: 'cascade' }),
		progress: integer('progress').notNull().default(0),
		completed: integer('completed', { mode: 'boolean' }).notNull().default(false),
		createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
		updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`)
	},
	(table) => [uniqueIndex('watch_history_user_video_unique').on(table.userId, table.videoId)]
);

export * from './auth.schema';
