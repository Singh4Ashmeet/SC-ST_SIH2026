"""Add merit, conflict, grievance, notification, institute, simulation tables

Revision ID: 3a7f1c82d560
Revises: 1220bc14e9b3
Create Date: 2026-09-26 19:22:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB


# revision identifiers, used by Alembic.
revision: str = '3a7f1c82d560'
down_revision: Union[str, None] = '1220bc14e9b3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add new enum values for UserRole
    op.execute("ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'INSTITUTE_VERIFIER'")
    op.execute("ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'NODAL_OFFICER'")

    # ── Merit Evaluations ──
    op.create_table(
        'merit_evaluations',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('application_id', UUID(as_uuid=True), sa.ForeignKey('applications.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('scheme_id', UUID(as_uuid=True), sa.ForeignKey('schemes.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('total_score', sa.Float, nullable=False, server_default='0'),
        sa.Column('rank', sa.Integer, nullable=True),
        sa.Column('score_breakdown', JSONB, nullable=False, server_default='{}'),
        sa.Column('preference_factors', JSONB, nullable=True),
        sa.Column('scheme_config_version', sa.Integer, nullable=False, server_default='1'),
        sa.Column('evaluated_by', UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('evaluated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    # ── Conflict Type & Status Enums ──
    conflict_type = sa.Enum(
        'CONCURRENT_SCHOLARSHIP', 'DUPLICATE_APPLICATION', 'REPEATED_BENEFICIARY',
        'CROSS_SCHEME_INCOMPATIBILITY', 'IDENTITY_COLLISION',
        name='conflict_type', create_type=True
    )
    conflict_status = sa.Enum(
        'PENDING_REVIEW', 'CONFIRMED', 'CLEARED', 'FALSE_POSITIVE',
        name='conflict_status', create_type=True
    )
    conflict_type.create(op.get_bind(), checkfirst=True)
    conflict_status.create(op.get_bind(), checkfirst=True)

    # ── Conflicts ──
    op.create_table(
        'conflicts',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('application_id', UUID(as_uuid=True), sa.ForeignKey('applications.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('conflicting_application_id', UUID(as_uuid=True), sa.ForeignKey('applications.id', ondelete='SET NULL'), nullable=True),
        sa.Column('conflict_type', conflict_type, nullable=False),
        sa.Column('status', conflict_status, nullable=False, server_default='PENDING_REVIEW'),
        sa.Column('confidence', sa.Float, nullable=False, server_default='0'),
        sa.Column('matching_signals', JSONB, nullable=False, server_default='{}'),
        sa.Column('policy_description', sa.Text, nullable=True),
        sa.Column('explanation', sa.Text, nullable=True),
        sa.Column('resolved_by', UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('resolved_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('resolution_remarks', sa.Text, nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    # ── Grievance Enums ──
    grievance_status = sa.Enum(
        'OPEN', 'ASSIGNED', 'IN_PROGRESS', 'AWAITING_APPLICANT', 'RESOLVED', 'CLOSED', 'ESCALATED',
        name='grievance_status', create_type=True
    )
    grievance_priority = sa.Enum(
        'LOW', 'NORMAL', 'HIGH', 'CRITICAL',
        name='grievance_priority', create_type=True
    )
    grievance_status.create(op.get_bind(), checkfirst=True)
    grievance_priority.create(op.get_bind(), checkfirst=True)

    # ── Grievances ──
    op.create_table(
        'grievances',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('application_id', UUID(as_uuid=True), sa.ForeignKey('applications.id', ondelete='SET NULL'), nullable=True, index=True),
        sa.Column('applicant_name', sa.String(255), nullable=False),
        sa.Column('applicant_email', sa.String(255), nullable=False),
        sa.Column('category', sa.String(100), nullable=False, server_default='general'),
        sa.Column('description', sa.Text, nullable=False),
        sa.Column('priority', grievance_priority, nullable=False, server_default='NORMAL'),
        sa.Column('status', grievance_status, nullable=False, server_default='OPEN'),
        sa.Column('assigned_role', sa.String(50), nullable=True),
        sa.Column('assigned_user_id', UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('resolution', sa.Text, nullable=True),
        sa.Column('escalation_level', sa.Integer, nullable=False, server_default='0'),
        sa.Column('sla_hours', sa.Integer, nullable=False, server_default='48'),
        sa.Column('due_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('resolved_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    # ── Notification Enums ──
    notification_channel = sa.Enum(
        'PORTAL', 'EMAIL', 'SMS',
        name='notification_channel', create_type=True
    )
    delivery_status = sa.Enum(
        'PENDING', 'SENT', 'DELIVERED', 'FAILED', 'SIMULATED',
        name='delivery_status', create_type=True
    )
    notification_channel.create(op.get_bind(), checkfirst=True)
    delivery_status.create(op.get_bind(), checkfirst=True)

    # ── Notifications ──
    op.create_table(
        'notifications',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('application_id', UUID(as_uuid=True), sa.ForeignKey('applications.id', ondelete='SET NULL'), nullable=True, index=True),
        sa.Column('recipient_email', sa.String(255), nullable=False),
        sa.Column('recipient_name', sa.String(255), nullable=True),
        sa.Column('event', sa.String(100), nullable=False, index=True),
        sa.Column('channel', notification_channel, nullable=False, server_default='PORTAL'),
        sa.Column('subject', sa.String(500), nullable=True),
        sa.Column('message', sa.Text, nullable=False),
        sa.Column('delivery_status', delivery_status, nullable=False, server_default='SIMULATED'),
        sa.Column('metadata', JSONB, nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    # ── Institute Verification Enums ──
    iv_status = sa.Enum(
        'PENDING', 'VERIFIED', 'QUERY_RAISED', 'RETURNED', 'REJECTED',
        name='institute_verification_status', create_type=True
    )
    iv_status.create(op.get_bind(), checkfirst=True)

    # ── Institute Verifications ──
    op.create_table(
        'institute_verifications',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('application_id', UUID(as_uuid=True), sa.ForeignKey('applications.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('institution_name', sa.String(500), nullable=False),
        sa.Column('institution_code', sa.String(100), nullable=True),
        sa.Column('status', iv_status, nullable=False, server_default='PENDING'),
        sa.Column('verifier_user_id', UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('remarks', sa.Text, nullable=True),
        sa.Column('query_details', sa.Text, nullable=True),
        sa.Column('verification_data', JSONB, nullable=True),
        sa.Column('verified_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    # ── Policy Simulations ──
    op.create_table(
        'policy_simulations',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('scheme_id', UUID(as_uuid=True), sa.ForeignKey('schemes.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('simulation_name', sa.String(255), nullable=True),
        sa.Column('base_config_version', sa.Integer, nullable=False),
        sa.Column('base_config', JSONB, nullable=False),
        sa.Column('proposed_config', JSONB, nullable=False),
        sa.Column('results', JSONB, nullable=False, server_default='{}'),
        sa.Column('summary', sa.Text, nullable=True),
        sa.Column('run_by', UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table('policy_simulations')
    op.drop_table('institute_verifications')
    op.drop_table('notifications')
    op.drop_table('grievances')
    op.drop_table('conflicts')
    op.drop_table('merit_evaluations')

    # Drop custom enums
    op.execute("DROP TYPE IF EXISTS institute_verification_status")
    op.execute("DROP TYPE IF EXISTS delivery_status")
    op.execute("DROP TYPE IF EXISTS notification_channel")
    op.execute("DROP TYPE IF EXISTS grievance_priority")
    op.execute("DROP TYPE IF EXISTS grievance_status")
    op.execute("DROP TYPE IF EXISTS conflict_status")
    op.execute("DROP TYPE IF EXISTS conflict_type")
