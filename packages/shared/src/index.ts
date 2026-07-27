export type UserRole = 'player' | 'admin';

export interface UserProfile {
  uid: string;
  email: string;
  username: string;
  displayName: string;
  role: UserRole;
  leagueId?: string;
  teamId?: string;
  telegramId?: string;
  telegramChatId?: string;
  createdAt: string;
}

export interface Character {
  id: string;
  name: string;
  role: 'hero' | 'villain' | 'antihero' | 'support';
  cost: number;
  power: number;
  dramaScore: number;
  tags: string[];
  imageUrl?: string;
  status: 'active' | 'injured' | 'eliminated';
  meta: {
    title: string;
    arc: string;
    origin: string;
  };
}

export interface ScoreRule {
  id: string;
  title: string;
  category: string;
  value: number;
  isBonus: boolean;
  visible: boolean;
  createdAt: string;
}

export interface EventRecord {
  id: string;
  title: string;
  description: string;
  date: string;
  characterIds: string[];
  ruleId: string;
  points: number;
  leagueId: string;
  createdBy: string;
}

export interface Team {
  id: string;
  name: string;
  userId: string;
  leagueId: string;
  characterIds: string[];
  captainId?: string;
  budgetUsed: number;
  totalScore: number;
  createdAt: string;
}

export interface League {
  id: string;
  name: string;
  code: string;
  ownerId: string;
  memberIds: string[];
  createdAt: string;
}

export interface TelegramLink {
  id: string;
  userId: string;
  telegramUserId: string;
  chatId: string;
  linkedAt: string;
}

export interface TelegramSubscription {
  id: string;
  userId: string;
  chatId: string;
  subscribedAt: string;
  active: boolean;
}
