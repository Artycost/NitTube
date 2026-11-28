type Theme = 'light' | 'dark' | 'system';

class ThemeStore {
	current = $state<Theme>('system');
	resolved = $state<'light' | 'dark'>('dark');
	initialized = $state(false);

	constructor() {
		if (typeof window !== 'undefined') {
			this.init();
		}
	}

	init() {
		if (this.initialized) return;

		const stored = localStorage.getItem('theme') as Theme | null;
		if (stored === 'light' || stored === 'dark' || stored === 'system') {
			this.current = stored;
		}

		this.resolveTheme();
		this.initialized = true;

		window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
			if (this.current === 'system') this.resolveTheme();
		});
	}

	resolveTheme() {
		this.resolved =
			this.current === 'system'
				? window.matchMedia('(prefers-color-scheme: dark)').matches
					? 'dark'
					: 'light'
				: this.current;
		this.applyTheme();
	}

	applyTheme() {
		document.documentElement.classList.remove('light', 'dark');
		document.documentElement.classList.add(this.resolved);
		document.documentElement.style.colorScheme = this.resolved;
		localStorage.setItem('theme', this.current);

		const meta = document.querySelector('meta[name="theme-color"]');
		if (meta) meta.setAttribute('content', this.resolved === 'dark' ? '#0a0a0b' : '#ffffff');
	}

	setTheme(theme: Theme) {
		this.current = theme;
		this.resolveTheme();
	}

	toggle() {
		const order: Theme[] = ['light', 'dark', 'system'];
		const next = order[(order.indexOf(this.current) + 1) % order.length];
		this.setTheme(next);
	}
}

export const themeStore = new ThemeStore();
