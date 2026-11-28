export const ADMIN_EMAIL = 'geplstudio8@gmail.com';

const ADMIN_EMAILS = new Set([ADMIN_EMAIL, 'proooosdsd@gmail.com']);

export function isAdmin(email?: string | null): boolean {
	return ADMIN_EMAILS.has((email ?? '').trim().toLowerCase());
}
