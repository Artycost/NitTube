export const CATEGORIES = [
	'Все',
	'Музыка',
	'Игры',
	'Технологии',
	'Дизайн',
	'Обучение',
	'Кино',
	'Авто',
	'Спорт',
	'Путешествия',
	'Еда',
	'Юмор',
	'Новости',
	'Другое'
] as const;

export const UPLOAD_CATEGORIES = CATEGORIES.filter((category) => category !== 'Все');

export const CATEGORY_ICONS: Record<string, string> = {
	Музыка: 'music',
	Игры: 'gamepad',
	Технологии: 'sparkles',
	Дизайн: 'image',
	Обучение: 'graduation',
	Кино: 'film',
	Авто: 'compass',
	Спорт: 'trophy',
	Путешествия: 'globe',
	Еда: 'heart',
	Юмор: 'smile',
	Новости: 'news',
	Другое: 'folder'
};
