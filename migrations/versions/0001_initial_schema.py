"""Initial Huawei Network Manager schema

Revision ID: 0001_initial_schema
Revises: 
Create Date: 2026-10-30 09:25:00
"""
from alembic import op
from backend.database import Base
import backend.models  # noqa: F401

revision = "0001_initial_schema"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    Base.metadata.create_all(bind=bind)


def downgrade() -> None:
    bind = op.get_bind()
    Base.metadata.drop_all(bind=bind)

