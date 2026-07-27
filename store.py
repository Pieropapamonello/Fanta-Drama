import json
from pathlib import Path
from typing import Dict, Optional

from config import FAMILY_MEMBERS, EVENT_TYPES, MAX_TEAM_SIZE, DATA_FILE


class DataStore:
    def __init__(self, path: str = DATA_FILE) -> None:
        self.path = Path(path)
        self.data = {
            "users": {},
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

        self.data.setdefault("users", {})
        self.data.setdefault("teams", {})
        self.data.setdefault("character_points", {member: 0 for member in FAMILY_MEMBERS})
        self.data.setdefault("round", 0)

    def save(self) -> None:
        with open(self.path, "w", encoding="utf-8") as f:
            json.dump(self.data, f, ensure_ascii=False, indent=2)

    def get_team(self, user_id: int) -> Optional[Dict]:
        return self.data["teams"].get(str(user_id))

    def get_user(self, user_id: int) -> Optional[Dict]:
        return self.data["users"].get(str(user_id))

    def create_user(self, user_id: int, display_name: str) -> None:
        uid = str(user_id)
        team_id = uid if self.data["teams"].get(uid) else None
        self.data["users"][uid] = {"id": uid, "name": display_name, "team_id": team_id}
        self.save()

    def update_user_name(self, user_id: int, display_name: str) -> None:
        user = self.get_user(user_id)
        if user:
            user["name"] = display_name
            self.save()

    def get_user_team(self, user_id: int) -> Optional[Dict]:
        return self.data["teams"].get(str(user_id))

    def create_team(self, user_id: int, team_name: str) -> None:
        uid = str(user_id)
        self.data["teams"][uid] = {"name": team_name, "members": [], "points": 0, "owner": uid}
        user = self.get_user(user_id)
        if not user:
            self.data["users"][uid] = {"id": uid, "name": f"Giocatore {uid}", "team_id": uid}
        else:
            user["team_id"] = uid
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
