import { fail, redirect } from '@sveltejs/kit';
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';
import { db } from '#lib/server/db';
import { user } from '#lib/server/db/schema';
import { getUserProfile } from '#lib/server/queries';
import { deleteUpload, MAX_BANNER_SIZE, saveUpload } from '#lib/server/files';
import { copyrightReferences, copyrightStrikes } from '#lib/server/db/schema';
import { activeStrikes, hashBytes } from '#lib/server/copyright';
import {
	NAME_COOLDOWN_DAYS,
	USERNAME_COOLDOWN_DAYS,
	cleanText,
	daysLeft,
	validateNickname,
	validateUserText,
	validateUsername
} from '#lib/utils/validation';

const text = (input: FormDataEntryValue | null): string =>
	input instanceof File ? '' : (input ?? '').trim();

const validAvatar = (value: string) =>
	!value || (value.startsWith('data:image/') && value.length < 3_000_000);

// Existing banners may still be stored as data URLs from the old editor.
const validBanner = (value: string) =>
	!value ||
	(value.startsWith('data:image/') && value.length < 28_000_000) ||
	/^\/media\/banners\/[a-zA-Z0-9._-]+$/.test(value);

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) throw redirect(302, '/login');
	const profile = await getUserProfile(locals.user.id);
	if (!profile) throw redirect(302, '/login');

	const references = await db
		.select({ id: copyrightReferences.id, title: copyrightReferences.title, createdAt: copyrightReferences.createdAt })
		.from(copyrightReferences)
		.where(eq(copyrightReferences.ownerId, locals.user.id));

	return {
		copyright: {
			strikes: await activeStrikes(locals.user.id),
			references: references.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }))
		},
		profile: {
			id: profile.id,
			name: profile.name,
			username: profile.username ?? '',
			bio: profile.bio ?? '',
			image: profile.image ?? '',
			banner: profile.banner ?? '',
			nameCooldown: daysLeft(profile.nameChangedAt, NAME_COOLDOWN_DAYS),
			usernameCooldown: daysLeft(profile.usernameChangedAt, USERNAME_COOLDOWN_DAYS),
			nameChanged: Boolean(profile.nameChangedAt),
			usernameChanged: Boolean(profile.usernameChangedAt)
		}
	};
};

export const actions: Actions = {
	save: async ({ request, locals }) => {
		if (!locals.user) throw redirect(302, '/login');
		const profile = await getUserProfile(locals.user.id);
		if (!profile) throw redirect(302, '/login');

		const form = await request.formData();
		const name = text(form.get('name'));
		const username = text(form.get('username')).replace(/^@/, '').toLowerCase();
		const bio = cleanText(text(form.get('bio')));
		const image = text(form.get('image'));
		const banner = text(form.get('banner'));
		const bannerFile = form.get('bannerFile');

		const update: Record<string, unknown> = {};

		if (name !== profile.name) {
			const left = daysLeft(profile.nameChangedAt, NAME_COOLDOWN_DAYS);
			if (left > 0) return fail(400, { message: `Никнейм можно менять ещё ${left} дн.` });
			const problem = validateNickname(name);
			if (problem) return fail(400, { message: problem });
			update.name = name;
			update.nameChangedAt = new Date();
		}

		if (username !== (profile.username ?? '')) {
			const left = daysLeft(profile.usernameChangedAt, USERNAME_COOLDOWN_DAYS);
			if (left > 0) return fail(400, { message: `Юзернейм можно менять ещё ${left} дн.` });
			const problem = validateUsername(username);
			if (problem) return fail(400, { message: problem });
			const taken = await db.select({ id: user.id }).from(user).where(eq(user.username, username)).limit(1);
			if (taken.length && taken[0].id !== locals.user.id) return fail(400, { message: 'Этот юзернейм занят' });
			update.username = username;
			update.usernameChangedAt = new Date();
		}

		const textProblem = validateUserText(bio);
		if (textProblem) return fail(400, { message: `Описание: ${textProblem}` });
		if (bio.length > 500) return fail(400, { message: 'Описание слишком длинное' });
		update.bio = bio || null;

		if (!validAvatar(image) || !validBanner(banner)) return fail(400, { message: 'Не удалось сохранить изображение' });
		if (bannerFile instanceof File && bannerFile.size > 0) {
			if (!['image/jpeg', 'image/png', 'image/webp', 'image/avif'].includes(bannerFile.type)) {
				return fail(400, { message: 'Баннер: JPEG, PNG, WebP или AVIF' });
			}
			if (bannerFile.size > MAX_BANNER_SIZE) return fail(400, { message: 'Баннер больше 20 МБ' });
		}

		const bannerValue =
			bannerFile instanceof File && bannerFile.size > 0 ? await saveUpload(bannerFile, 'banners') : banner || null;
		update.image = image || null;
		update.banner = bannerValue;

		if (Object.keys(update).length) {
			await db.update(user).set(update).where(eq(user.id, locals.user.id));
		}

		if (bannerValue !== (profile.banner ?? null)) await deleteUpload(profile.banner);

		return { success: true, banner: bannerValue ?? '' };
	},
	registerCopyright: async ({ request, locals }) => {
		if (!locals.user) throw redirect(302, '/login');
		const form = await request.formData();
		const file = form.get('reference');
		const title = text(form.get('title')).slice(0, 120);
		if (!(file instanceof File) || file.size === 0) return fail(400, { message: 'Выберите файл' });
		if (file.size > 50 * 1024 * 1024) return fail(400, { message: 'Файл больше 50 МБ' });
		const hash = await hashBytes(new Uint8Array(await file.arrayBuffer()));
		await db.insert(copyrightReferences).values({
			id: randomUUID(),
			ownerId: locals.user.id,
			title: title || file.name,
			hash
		});
		return { success: true };
	}
};
