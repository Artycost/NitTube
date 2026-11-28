export type ToastType = 'success' | 'error' | 'info';

export type ToastItem = {
	id: number;
	type: ToastType;
	message: string;
};

let counter = 0;

class ToastStore {
	items = $state<ToastItem[]>([]);

	show(message: string, type: ToastType = 'info') {
		const id = ++counter;
		this.items = [...this.items, { id, type, message }];
		setTimeout(() => this.dismiss(id), 3600);
		return id;
	}

	success(message: string) {
		return this.show(message, 'success');
	}

	error(message: string) {
		return this.show(message, 'error');
	}

	info(message: string) {
		return this.show(message, 'info');
	}

	dismiss(id: number) {
		this.items = this.items.filter((item) => item.id !== id);
	}
}

export const toasts = new ToastStore();
