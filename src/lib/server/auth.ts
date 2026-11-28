import { ORIGIN, BETTER_AUTH_SECRET, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET } from '$app/env/private';
import { betterAuth } from 'better-auth/minimal';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { sveltekitCookies } from 'better-auth/svelte-kit';
import { getRequestEvent } from '$app/server';
import { db } from '#lib/server/db/index.ts';
import * as schema from '#lib/server/db/schema.ts';

export const googleEnabled = Boolean(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET);

export const auth = betterAuth({
	baseURL: ORIGIN,
	secret: BETTER_AUTH_SECRET,
	database: drizzleAdapter(db, {
		provider: 'sqlite',
		schema: {
			user: schema.user,
			session: schema.session,
			account: schema.account,
			verification: schema.verification
		}
	}),
	emailAndPassword: {
		enabled: true,
		minPasswordLength: 6
	},
	socialProviders: googleEnabled
		? {
				google: {
					clientId: GOOGLE_CLIENT_ID,
					clientSecret: GOOGLE_CLIENT_SECRET
				}
			}
		: undefined,
	user: {
		additionalFields: {
			role: { type: 'string', required: false, defaultValue: 'user', input: false },
			bio: { type: 'string', required: false },
			banner: { type: 'string', required: false },
			verified: { type: 'boolean', required: false, defaultValue: false, input: false },
			creator: { type: 'boolean', required: false, defaultValue: false, input: false }
		}
	},
	account: {
		accountLinking: {
			enabled: true,
			trustedProviders: ['google'],
			requireLocalEmailVerified: false
		}
	},
	plugins: [
		sveltekitCookies(getRequestEvent) // make sure this is the last plugin in the array
	]
});
