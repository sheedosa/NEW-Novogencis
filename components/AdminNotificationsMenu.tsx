import React from 'react';
import { AppNotification } from '../types';
import {
  Bell, MessageSquare, CalendarCheck, Star, FileText,
  CreditCard, BadgeCheck, ClipboardList, Pill,
} from 'lucide-react';

/**
 * Admin notification dropdown. Shows recent alerts; clicking one deep-links
 * straight to the relevant patient record and marks it read for THIS admin
 * (per-doctor read via the notification's `readBy` array). Kept in sync with
 * the Inbox worklist (footer link), which stays the fuller "needs you" queue.
 */
interface AdminNotificationsMenuProps {
  notifications: AppNotification[];
  userId: string;
  /** Deep-link to the record + mark read (handled by AdminPage). */
  onOpenItem: (n: AppNotification) => void;
  onMarkAllRead: () => void;
  onOpenInbox: () => void;
  onClose: () => void;
}

const iconFor = (t: string) => {
  if (t.includes('assessment')) return <ClipboardList size={14} />;
  if (t.includes('message')) return <MessageSquare size={14} />;
  if (t.includes('appointment')) return <CalendarCheck size={14} />;
  if (t.includes('feedback')) return <Star size={14} />;
  if (t.includes('prescription')) return <Pill size={14} />;
  if (t.includes('form')) return <FileText size={14} />;
  if (t.includes('payment')) return <CreditCard size={14} />;
  if (t.includes('welcome')) return <BadgeCheck size={14} />;
  return <Bell size={14} />;
};

const timeAgoOf = (createdAt?: string): string => {
  if (!createdAt) return 'Recently';
  const diff = Date.now() - new Date(createdAt).getTime();
  if (Number.isNaN(diff)) return 'Recently';
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
};

const AdminNotificationsMenu: React.FC<AdminNotificationsMenuProps> = ({
  notifications, userId, onOpenItem, onMarkAllRead, onOpenInbox, onClose,
}) => {
  const isUnread = (n: AppNotification) => !(n.readBy ?? []).includes(userId);
  const sorted = [...notifications].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  const hasUnread = sorted.some(isUnread);

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className="fixed sm:absolute inset-x-3 sm:inset-x-auto sm:right-0 mt-2 w-auto sm:w-[340px] md:w-[380px] max-w-[calc(100vw-1.5rem)] bg-white rounded-lg shadow-modal border border-sand z-50 overflow-hidden animate-fade-up sm:origin-top-right">
        <div className="px-4 py-3 border-b border-sand flex justify-between items-center">
          <h3 className="text-sm font-medium text-obsidian">Notifications</h3>
          {hasUnread && (
            <button
              onClick={onMarkAllRead}
              className="text-xs text-muted hover:text-obsidian transition-colors"
            >
              Mark all read
            </button>
          )}
        </div>
        <div className="max-h-[380px] overflow-y-auto">
          {sorted.length > 0 ? (
            sorted.slice(0, 30).map((n) => {
              const unread = isUnread(n);
              return (
                <div
                  key={n.id}
                  onClick={() => onOpenItem(n)}
                  className={`px-4 py-3 border-b border-cream flex gap-3 hover:bg-cream/50 transition-colors cursor-pointer relative ${unread ? 'bg-primary/5' : ''}`}
                >
                  {unread && <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-primary" />}
                  <div className="w-7 h-7 rounded-md bg-cream flex items-center justify-center shrink-0 text-muted">
                    {iconFor(n.type)}
                  </div>
                  <div className="min-w-0 flex-grow">
                    <p className="text-sm font-medium text-obsidian">{n.title}</p>
                    <p className="text-xs text-muted leading-relaxed mt-0.5 line-clamp-2">{n.body}</p>
                    <p className="text-xs text-hint mt-1">{timeAgoOf(n.createdAt)}</p>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="px-4 py-10 text-center">
              <p className="text-sm text-muted">You&rsquo;re all caught up</p>
            </div>
          )}
        </div>
        <button
          onClick={onOpenInbox}
          className="w-full px-4 py-3 text-xs font-medium text-obsidian hover:bg-cream transition-colors border-t border-sand text-center"
        >
          Open Inbox &rarr;
        </button>
      </div>
    </>
  );
};

export default AdminNotificationsMenu;
