export interface TelegramLoginPayload {
  id: string;
  first_name: string;
  last_name?: string;
  username?: string;
  auth_date: string;
  hash: string;
}

export interface TelegramAuthResult {
  userId: string;
  telegramUserId: string;
  chatId: string;
}
