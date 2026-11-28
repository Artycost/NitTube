import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { auth, googleEnabled } from '#lib/server/auth';
import { APIError } from 'better-auth/api';
import { cleanText } from '#lib/utils/validation';

const parseEntry = (input: FormDataEntryValue | null): string =>
	input instanceof File ? input.name : (input ?? '').trim();

const safeName = (email: string) =>
	cleanText(email.split('@')[0]).replace(/[^\p{L}\p{N} -]/gu, '').slice(0, 24) || 'Пользователь';

export const load: PageServerLoad = () => ({ googleEnabled });

export const actions: Actions = {
	signInEmail: async (event) => {
		const formData = await event.request.formData();
		const email = parseEntry(formData.get('email'));
		const password = parseEntry(formData.get('password'));

		try {
			await auth.api.signInEmail({
				body: { email, password, callbackURL: '/' },
				asResponse: true
			});
		} catch (error) {
			if (error instanceof APIError) return fail(400, { message: error.message || 'Неверный email или пароль' });
			return fail(500, { message: 'Неожиданная ошибка' });
		}

		throw redirect(302, '/');
	},
	signUpEmail: async (event) => {
		const formData = await event.request.formData();
		const email = parseEntry(formData.get('email'));
		const password = parseEntry(formData.get('password'));

		try {
			await auth.api.signUpEmail({
				body: { email, password, name: safeName(email), callbackURL: '/' },
				asResponse: true
			});
		} catch (error) {
			if (error instanceof APIError) return fail(400, { message: error.message || 'Ошибка регистрации' });
			return fail(500, { message: 'Неожиданная ошибка' });
		}

		throw redirect(302, '/');
	}
};
