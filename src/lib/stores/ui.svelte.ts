class UiStore {
	sidebarCollapsed = $state(false);
	mobileMenuOpen = $state(false);
	searchOpen = $state(false);

	toggleSidebar() {
		if (typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches) {
			this.sidebarCollapsed = !this.sidebarCollapsed;
		} else {
			this.mobileMenuOpen = !this.mobileMenuOpen;
		}
	}

	closeMobileMenu() {
		this.mobileMenuOpen = false;
	}
}

export const uiStore = new UiStore();
