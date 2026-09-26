"""Add user operational scope, application scope, and audit hash columns

Revision ID: 4b8g2d93e671
Revises: 3a7f1c82d560
Create Date: 2026-09-26 21:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB

# revision identifiers, used by Alembic.
revision: str = '4b8g2d93e671'
down_revision: Union[str, None] = '3a7f1c82d560'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add APPLICANT to user_role enum if PG
    op.execute("ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'APPLICANT'")

    # User scope columns
    op.add_column('users', sa.Column('institution_id', sa.String(255), nullable=True))
    op.add_column('users', sa.Column('state_scope', sa.String(100), nullable=True))
    op.add_column('users', sa.Column('district_scope', sa.String(100), nullable=True))
    op.add_column('users', sa.Column('assigned_scheme_ids', JSONB, nullable=True))
    op.add_column('users', sa.Column('department_scope', sa.String(255), nullable=True))
    op.add_column('users', sa.Column('active_assignment', sa.String(255), nullable=True))

    # Application scope columns
    op.add_column('applications', sa.Column('assigned_scrutiny_officer_id', UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True))
    op.add_column('applications', sa.Column('institution_id', sa.String(255), nullable=True))
    op.add_column('applications', sa.Column('state', sa.String(100), nullable=True))
    op.add_column('applications', sa.Column('district', sa.String(100), nullable=True))
    op.add_column('applications', sa.Column('current_responsible_role', sa.String(50), nullable=True, server_default='SCRUTINY_OFFICER'))
    op.add_column('applications', sa.Column('current_responsible_user_id', UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True))
    op.add_column('applications', sa.Column('stage_entry_time', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True))

    # AuditLog tamper-evident columns
    op.add_column('audit_logs', sa.Column('previous_hash', sa.String(64), nullable=True))
    op.add_column('audit_logs', sa.Column('current_hash', sa.String(64), nullable=True))


def downgrade() -> None:
    op.drop_column('audit_logs', 'current_hash')
    op.drop_column('audit_logs', 'previous_hash')

    op.drop_column('applications', 'stage_entry_time')
    op.drop_column('applications', 'current_responsible_user_id')
    op.drop_column('applications', 'current_responsible_role')
    op.drop_column('applications', 'district')
    op.drop_column('applications', 'state')
    op.drop_column('applications', 'institution_id')
    op.drop_column('applications', 'assigned_scrutiny_officer_id')

    op.drop_column('users', 'active_assignment')
    op.drop_column('users', 'department_scope')
    op.drop_column('users', 'assigned_scheme_ids')
    op.drop_column('users', 'district_scope')
    op.drop_column('users', 'state_scope')
    op.drop_column('users', 'institution_id')
