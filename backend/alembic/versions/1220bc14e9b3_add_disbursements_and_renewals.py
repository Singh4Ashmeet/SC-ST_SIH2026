"""add_disbursements_and_renewals

Revision ID: 1220bc14e9b3
Revises: 0bfd9ce7e304
Create Date: 2026-09-19 14:25:55.595201
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '1220bc14e9b3'
down_revision: Union[str, None] = '0bfd9ce7e304'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'disbursements',
        sa.Column('id', sa.UUID(), server_default=sa.text('gen_random_uuid()'), nullable=False),
        sa.Column('application_id', sa.UUID(), nullable=False),
        sa.Column('amount', sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column('disbursed_date', sa.Date(), nullable=True),
        sa.Column('status', sa.Enum('PENDING', 'DISBURSED', 'FAILED', 'ON_HOLD', name='disbursement_status'), server_default='PENDING', nullable=False),
        sa.Column('installment_number', sa.Integer(), server_default='1', nullable=False),
        sa.Column('remarks', sa.Text(), nullable=True),
        sa.Column('created_by', sa.UUID(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['application_id'], ['applications.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_disbursements_application_id'), 'disbursements', ['application_id'], unique=False)

    op.create_table(
        'renewals',
        sa.Column('id', sa.UUID(), server_default=sa.text('gen_random_uuid()'), nullable=False),
        sa.Column('application_id', sa.UUID(), nullable=False),
        sa.Column('academic_year_or_cycle', sa.String(length=20), nullable=False),
        sa.Column('status', sa.Enum('PENDING_REVIEW', 'APPROVED', 'REJECTED', name='renewal_status'), server_default='PENDING_REVIEW', nullable=False),
        sa.Column('due_date', sa.Date(), nullable=False),
        sa.Column('reviewed_date', sa.Date(), nullable=True),
        sa.Column('reviewer_id', sa.UUID(), nullable=True),
        sa.Column('remarks', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['application_id'], ['applications.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['reviewer_id'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_renewals_application_id'), 'renewals', ['application_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_renewals_application_id'), table_name='renewals')
    op.drop_table('renewals')
    op.drop_index(op.f('ix_disbursements_application_id'), table_name='disbursements')
    op.drop_table('disbursements')
