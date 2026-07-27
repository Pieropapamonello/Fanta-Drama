export const EVENT_CATEGORIES = [
  'Bonus',
  'Malus',
  'Twist',
  'Reveal',
  'Elimination',
] as const;

export const ROLE_COSTS = {
  hero: 24,
  villain: 22,
  antihero: 20,
  support: 18,
} as const;

export const MAX_TEAM_SIZE = 6;
export const STARTING_BUDGET = 120;

export const DEMO_CHARACTERS = [
  {
    id: 'viktoria-vale',
    name: 'Viktoria Vale',
    role: 'antihero',
    cost: 24,
    power: 82,
    dramaScore: 86,
    tags: ['mystery', 'betrayal'],
    status: 'active',
    meta: {
      title: 'Regina della suspense',
      arc: 'scheming outsider',
      origin: 'palazzo della concentrazione',
    },
  },
  {
    id: 'leon-astor',
    name: 'Leon Astor',
    role: 'hero',
    cost: 28,
    power: 88,
    dramaScore: 79,
    tags: ['lead', 'redemption'],
    status: 'active',
    meta: {
      title: 'Protagonista tirato',
      arc: 'salvatore in declino',
      origin: 'città delle luci',
    },
  },
] as const;
