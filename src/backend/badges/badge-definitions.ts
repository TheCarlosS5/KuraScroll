export type BadgeCategory = 'volume' | 'streak' | 'time' | 'explorer' | 'collector';
export type BadgeRarity = 'common' | 'rare' | 'epic' | 'legendary';

export interface BadgeDefinition {
  id: string;
  title: string;
  description: string;
  icon: string;
  category: BadgeCategory;
  targetValue: number;
  rarity: BadgeRarity;
}

export const BADGE_CATALOG: BadgeDefinition[] = [
  {
    id: 'first_step',
    title: 'Primer Paso',
    description: 'Comienza tu viaje leyendo tu primera página o capítulo en KuraScroll.',
    icon: 'footprints',
    category: 'volume',
    targetValue: 1,
    rarity: 'common',
  },
  {
    id: 'page_devourer_100',
    title: 'Devorador de Páginas I',
    description: 'Lee un total acumulado de 100 páginas.',
    icon: 'book-open',
    category: 'volume',
    targetValue: 100,
    rarity: 'common',
  },
  {
    id: 'page_devourer_500',
    title: 'Devorador de Páginas II',
    description: 'Lee un total acumulado de 500 páginas.',
    icon: 'books',
    category: 'volume',
    targetValue: 500,
    rarity: 'rare',
  },
  {
    id: 'page_devourer_1000',
    title: 'Devorador de Páginas III',
    description: 'Alcanza la marca épica de 1,000 páginas leídas en tu biblioteca.',
    icon: 'library',
    category: 'volume',
    targetValue: 1000,
    rarity: 'epic',
  },
  {
    id: 'streak_3',
    title: 'Constancia Inicial',
    description: 'Cumple tu meta diaria durante 3 días consecutivos.',
    icon: 'flame',
    category: 'streak',
    targetValue: 3,
    rarity: 'common',
  },
  {
    id: 'streak_7',
    title: 'Racha de Fuego',
    description: 'Mantén una racha de lectura ininterrumpida durante una semana completa (7 días).',
    icon: 'flame-kindling',
    category: 'streak',
    targetValue: 7,
    rarity: 'rare',
  },
  {
    id: 'streak_30',
    title: 'Hábito Inquebrantable',
    description: 'Consigue una racha legendaria de 30 días consecutivos cumpliendo tu objetivo diario.',
    icon: 'trophy',
    category: 'streak',
    targetValue: 30,
    rarity: 'legendary',
  },
  {
    id: 'night_owl',
    title: 'Búho Nocturno',
    description: 'Disfruta de una sesión de lectura nocturna entre las 23:00 y las 04:00.',
    icon: 'moon',
    category: 'time',
    targetValue: 1,
    rarity: 'rare',
  },
  {
    id: 'weekend_warrior',
    title: 'Guerrero del Fin de Semana',
    description: 'Lee activamente durante el fin de semana cumpliendo tus metas tanto sábado como domingo.',
    icon: 'sword',
    category: 'time',
    targetValue: 2,
    rarity: 'common',
  },
  {
    id: 'genre_explorer',
    title: 'Explorador de Géneros',
    description: 'Diversifica tus gustos leyendo obras de al menos 5 géneros o demografías distintas.',
    icon: 'compass',
    category: 'explorer',
    targetValue: 5,
    rarity: 'rare',
  },
  {
    id: 'volume_master',
    title: 'Maestro de Tomos',
    description: 'Lee y completa un tomo o volumen completo de principio a fin.',
    icon: 'crown',
    category: 'volume',
    targetValue: 1,
    rarity: 'rare',
  },
  {
    id: 'speed_reader',
    title: 'Lector Voraz',
    description: 'Lee 50 páginas en una sola sesión de lectura ininterrumpida.',
    icon: 'zap',
    category: 'collector',
    targetValue: 50,
    rarity: 'epic',
  },
];

export const BADGE_MAP: Map<string, BadgeDefinition> = new Map(
  BADGE_CATALOG.map((b) => [b.id, b])
);

export function getBadgeDefinition(id: string): BadgeDefinition | undefined {
  return BADGE_MAP.get(id);
}
