import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { auth } from '#lib/server/auth';

export const POST: RequestHandler = async ({ request, cookies }) => {
	await auth.api.signOut({
		headers: request.headers
	});

	for (const name of cookies.getAll().map((cookie) => cookie.name)) {
		if (name.startsWith('better-auth')) cookies.delete(name);
	}

	throw redirect(303, '/login');
};

export const GET: RequestHandler = async () => {
	throw redirect(303, '/');
};
