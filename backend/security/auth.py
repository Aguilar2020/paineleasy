from datetime import datetime, timedelta, timezone
from typing import Callable
import bcrypt
import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from backend.config import settings
from backend.database import get_db
from backend.models.entities import User, Device

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login", auto_error=False)


def hash_password(password: str) -> str:
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return bcrypt.checkpw(
            plain_password.encode("utf-8"), hashed_password.encode("utf-8")
        )
    except Exception:
        return False


def create_access_token(data: dict, expires_delta: timedelta | None = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (
        expires_delta
        or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    to_encode.update({"exp": expire})
    return jwt.encode(
        to_encode, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM
    )


def get_current_user(
    token: str | None = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Autenticação necessária. Faça login para continuar.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    try:
        payload = jwt.decode(
            token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM]
        )
        username: str | None = payload.get("sub")
        if username is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token de acesso inválido.",
            )
    except jwt.PyJWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Sessão expirada ou token inválido.",
        )

    user = db.query(User).filter(User.username == username).first()
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuário inativo ou não encontrado.",
        )
    return user


def require_roles(*allowed_roles: str) -> Callable:
    """Dependency factory enforcing RBAC (admin, engineer, readonly)."""
    def role_checker(current_user: User = Depends(get_current_user)) -> User:
        role_name = current_user.role.name if current_user.role else ""
        if role_name not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=(
                    f"Permissão negada. Seu perfil ({current_user.role.display_name if current_user.role else 'Sem perfil'}) "
                    f"não possui autorização para executar esta operação."
                ),
            )
        return current_user

    return role_checker


def verify_pop_access(user: User, pop_id: int) -> None:
    """Verifies whether the user is allowed to operate on a specific POP."""
    if user.role and user.role.name == "admin":
        return
    if user.all_pops_access:
        return
    allowed_ids = {p.id for p in user.allowed_pops}
    if pop_id not in allowed_ids:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acesso negado a este POP para o seu usuário.",
        )


def acquire_device_lock(db: Session, device: Device, user: User) -> None:
    """Prevents simultaneous conflicting changes on the same Huawei equipment."""
    now = datetime.now(timezone.utc)
    if device.locked_by_user_id and device.locked_by_user_id != user.id:
        locked_at = device.locked_at
        if locked_at and locked_at.tzinfo is None:
            locked_at = locked_at.replace(tzinfo=timezone.utc)
        # Lock expires after 5 minutes to avoid deadlocks
        if locked_at and (now - locked_at) < timedelta(minutes=5):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    f"O equipamento {device.name} está em processo de alteração por outro operador no momento. "
                    "Aguarde o término da operação atual."
                ),
            )
    device.locked_by_user_id = user.id
    device.locked_at = now
    db.commit()


def release_device_lock(db: Session, device: Device) -> None:
    device.locked_by_user_id = None
    device.locked_at = None
    db.commit()

