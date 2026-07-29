from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.services.account import get_user_plan

TIER_NAMES = {0: "Free", 1: "Básico", 2: "Pro", 3: "Premium"}


def require_tier(min_tier: int):
    def dependency(
        user: User = Depends(get_current_user),
        db: Session = Depends(get_db),
    ) -> User:
        plan = get_user_plan(db, user)
        if plan.tier_level < min_tier:
            raise HTTPException(
                status.HTTP_402_PAYMENT_REQUIRED,
                f"Esta función requiere el plan {TIER_NAMES.get(min_tier, min_tier)} o superior.",
            )
        return user

    return dependency
