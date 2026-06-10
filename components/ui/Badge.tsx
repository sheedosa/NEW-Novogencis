import React from 'react';

type BadgeVariant =
  | 'active'
  | 'pending'
  | 'new'
  | 'review'
  | 'inactive'
  | 'danger'
  | 'ai';

interface BadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  variant = 'inactive',
  children,
  icon,
  className = '',
}) => (
  <span className={`badge badge-${variant} ${className}`}>
    {icon}
    {children}
  </span>
);

/**
 * Status string → Badge variant mapping for clinical statuses.
 * Use to render any client/appointment status consistently.
 */
export const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const map: Record<string, BadgeVariant> = {
    'New': 'new',
    'Assessment Submitted': 'new',
    'Reviewed': 'review',
    'Pending Review': 'pending',
    'Contacted': 'review',
    'Active': 'active',
    'Ongoing': 'active',
    'Confirmed': 'active',
    'Converted': 'active',
    'Completed': 'active',
    'Pending': 'pending',
    'Awaiting deposit': 'pending',
    'Cancelled': 'danger',
    'Not Suitable': 'danger',
    'No-Show': 'inactive',
    'Inactive': 'inactive',
  };
  return <Badge variant={map[status] || 'inactive'}>{status}</Badge>;
};

export default Badge;
