from sqlalchemy.orm import Session
from backend.models.entities import AuditLog, User


def log_audit_event(
    db: Session,
    user: User | None,
    action: str,
    resource_type: str,
    resource_id: str | None = None,
    device_name: str | None = None,
    pop_name: str | None = None,
    status: str = "SUCCESS",
    details: str | None = None,
    ip_address: str | None = "127.0.0.1",
    is_simulated: bool = False,
) -> AuditLog:
    entry = AuditLog(
        user_id=user.id if user else None,
        username=user.username if user else "system",
        action=action,
        resource_type=resource_type,
        resource_id=str(resource_id) if resource_id is not None else None,
        device_name=device_name,
        pop_name=pop_name,
        status=status,
        details=details,
        ip_address=ip_address,
        is_simulated=is_simulated,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry

