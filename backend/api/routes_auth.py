from datetime import datetime, timezone
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models.entities import User, Role, Pop
from backend.schemas.api_schemas import (
    LoginRequest,
    TokenResponse,
    UserOut,
    UserCreate,
    RoleSchema,
)
from backend.security.auth import (
    verify_password,
    hash_password,
    create_access_token,
    get_current_user,
    require_roles,
)
from backend.services.audit_service import log_audit_event

router = APIRouter(tags=["Autenticação e Usuários"])


def _serialize_user(user: User) -> UserOut:
    return UserOut(
        id=user.id,
        username=user.username,
        full_name=user.full_name,
        email=user.email,
        is_active=user.is_active,
        all_pops_access=user.all_pops_access,
        role=RoleSchema.model_validate(user.role),
        allowed_pop_ids=[p.id for p in user.allowed_pops],
        last_login_at=user.last_login_at,
    )


@router.post("/auth/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == payload.username.strip()).first()
    if not user or not verify_password(payload.password, user.password_hash):
        log_audit_event(
            db=db,
            user=None,
            action="LOGIN_FAILED",
            resource_type="AUTH",
            status="FAILED",
            details=f"Tentativa de login inválida para o usuário '{payload.username}'.",
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuário ou senha incorretos.",
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Conta de usuário desativada pelo administrador.",
        )

    user.last_login_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(user)

    token = create_access_token(
        data={"sub": user.username, "role": user.role.name if user.role else "readonly"}
    )
    log_audit_event(
        db=db,
        user=user,
        action="LOGIN_SUCCESS",
        resource_type="AUTH",
        status="SUCCESS",
        details=f"Sessão iniciada com perfil {user.role.display_name}.",
    )
    return TokenResponse(access_token=token, user=_serialize_user(user))


@router.get("/auth/me", response_model=UserOut)
def get_me(current_user: User = Depends(get_current_user)):
    return _serialize_user(current_user)


@router.get("/users", response_model=List[UserOut])
def list_users(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _ = current_user
    users = db.query(User).order_by(User.id).all()
    return [_serialize_user(u) for u in users]


@router.get("/roles", response_model=List[RoleSchema])
def list_roles(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _ = current_user
    return db.query(Role).order_by(Role.id).all()


@router.post("/users", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def create_user(
    payload: UserCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin")),
):
    if db.query(User).filter(User.username == payload.username).first():
        raise HTTPException(status_code=400, detail="Nome de usuário já cadastrado.")
    if db.query(User).filter(User.email == payload.email).first():
        raise HTTPException(status_code=400, detail="E-mail já cadastrado.")

    role = db.query(Role).filter(Role.name == payload.role_name).first()
    if not role:
        raise HTTPException(status_code=400, detail="Função/perfil inválido.")

    new_user = User(
        username=payload.username.strip(),
        full_name=payload.full_name.strip(),
        email=payload.email.strip(),
        password_hash=hash_password(payload.password),
        role_id=role.id,
        is_active=True,
        all_pops_access=payload.all_pops_access,
    )
    if not payload.all_pops_access and payload.allowed_pop_ids:
        pops = db.query(Pop).filter(Pop.id.in_(payload.allowed_pop_ids)).all()
        new_user.allowed_pops = pops

    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    log_audit_event(
        db=db,
        user=current_user,
        action="USER_CREATE",
        resource_type="USER",
        resource_id=str(new_user.id),
        details=f"Criado usuário {new_user.username} com perfil {role.display_name}.",
    )
    return _serialize_user(new_user)

