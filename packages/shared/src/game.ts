import { MAX_TEAM_SIZE, STARTING_BUDGET } from './domain';
import type { Character, Team } from './index';

export function calculateBudgetUsed(team: Team, characters: Record<string, Character>) {
  return team.characterIds.reduce((total, id) => {
    const character = characters[id];
    return total + (character?.cost ?? 0);
  }, 0);
}

export function canAddCharacter(team: Team, character: Character) {
  return team.characterIds.length < MAX_TEAM_SIZE && !team.characterIds.includes(character.id);
}

export function calculateTeamScore(team: Team, characters: Record<string, Character>) {
  const baseScore = team.characterIds.reduce((total, id) => {
    const character = characters[id];
    return total + (character?.dramaScore ?? 0);
  }, 0);

  if (!team.captainId) {
    return baseScore;
  }

  const captain = characters[team.captainId];
  if (!captain) {
    return baseScore;
  }

  return baseScore + Math.floor(captain.dramaScore * 0.2);
}

export function remainingBudget(team: Team, characters: Record<string, Character>) {
  return STARTING_BUDGET - calculateBudgetUsed(team, characters);
}
