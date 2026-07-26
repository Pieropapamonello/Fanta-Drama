import json
from pathlib import Path
from typing import Dict, Optional

from config import FAMILY_MEMBERS, EVENT_TYPES, MAX_TEAM_SIZE, DATA_FILE


class DataStore:
    def __init__(self, path: str = DATA_FILE) -> None:
        self.path = Path(path)
        self.data = {
            "teams": {},
            "character_points": {member: 0 for member in FAMILY_MEMBERS},
            "round": 0,
        }
        self.load()

    def load(self) -> None:
        if self.path.exists():
            try:
                with open(self.path, "r", encoding="utf-8") as f:
                    self.data = json.load(f)
            except Exception:
                pass

    def save(self) -> None:
        with open(self.path, "w", encoding="utf-8") as f:
            json.dump(self.data, f, ensure_ascii=False, indent=2)

    def get_team(self, user_id: int) -> Optional[Dict]:
        return self.data["teams"].get(str(user_id))

    def create_team(self, user_id: int, team_name: str) -> None:
        self.data["teams"][str(user_id)] = {"name": team_name, "members": [], "points": 0}
        self.save()

    def add_member_to_team(self, user_id: int, member: str) -> bool:
        owner = find_team_by_member(self.data, member)
        if owner is not None:
            return False
        team = self.get_team(user_id)
        if not team:
            return False
        if len(team["members"]) >= MAX_TEAM_SIZE:
            return False
        team["members"].append(member)
        self.save()
        return True

    def remove_member_from_team(self, user_id: int, member: str) -> bool:
        team = self.get_team(user_id)
        if not team:
            return False
        if member in team["members"]:
            team["members"].remove(member)
            self.save()
            return True
        return False

    def record_event(self, member: str, event_type: str) -> Optional[int]:
        points = EVENT_TYPES.get(event_type)
        if points is None:
            return None
        self.data["character_points"][member] = self.data["character_points"].get(member, 0) + points
        owner = find_team_by_member(self.data, member)
        if owner is not None:
            owner_team = self.data["teams"][owner]
            owner_team["points"] = owner_team.get("points", 0) + points
        self.save()
        return points


def find_team_by_member(data: dict, member: str) -> Optional[str]:
    for uid, team in data.get("teams", {}).items():
        if member in team.get("members", []):
            return uid
    return None


store = DataStore()
