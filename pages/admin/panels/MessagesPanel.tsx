import React, { memo } from 'react';
import { useAdminContext } from '../context';
import { MessageInputForm } from '../AdminComponents';
import { FORMS } from '../../../constants';
import {
  Search, MessageCircle, Phone, FileText, CreditCard,
  Users as UsersIcon, User as UserIcon, ExternalLink, ArrowLeft,
} from 'lucide-react';
import {
  PageHeader, Button, Card, EmptyState,
} from '../../../components/ui';

const MessagesPanel: React.FC = () => {
  const {
    user,
    showOnlyAssigned,
    setShowOnlyAssigned,
    threadSearch,
    setThreadSearch,
    messageThreads,
    clients,
    selectedThreadId,
    setSelectedThreadId,
    onMarkMessageRead,
    setSelectedClientId,
    setActiveTab,
    setClientRecordTab,
    getInitials,
    setViewingForm,
    onSendMessage,
    showQuickActions,
    setShowQuickActions,
  } = useAdminContext();

  const handleSendMessage = async (msgText: string, threadId: string) => {
    if (!msgText.trim() || !threadId) return;
    try {
      await onSendMessage({
        senderId: user?.id || 'admin',
        recipientId: threadId,
        subject: 'Clinic update',
        body: msgText,
        read: false,
        createdAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  const threads = Object.entries(messageThreads)
    .filter(([clientId]) => {
      const client = clients.find(c => c.id === clientId);
      return client?.name?.toLowerCase().includes(threadSearch.toLowerCase()) || clientId.toLowerCase().includes(threadSearch.toLowerCase());
    })
    .sort((a, b) => {
      const lastA = a[1].length > 0 ? new Date(a[1][a[1].length - 1].createdAt).getTime() : 0;
      const lastB = b[1].length > 0 ? new Date(b[1][b[1].length - 1].createdAt).getTime() : 0;
      return lastB - lastA;
    });

  return (
    <div className="animate-fade-up flex flex-col gap-4 h-auto lg:h-[calc(100dvh-9rem)] pb-20 lg:pb-0">
      <PageHeader
        title="Messages"
        subtitle="Patient conversations and clinical updates"
        actions={
          user?.role === 'admin' ? (
            <Button
              variant="ghost"
              size="sm"
              leadingIcon={showOnlyAssigned ? <UserIcon size={13} /> : <UsersIcon size={13} />}
              onClick={() => setShowOnlyAssigned(!showOnlyAssigned)}
            >
              {showOnlyAssigned ? 'My assignments' : 'All threads'}
            </Button>
          ) : undefined
        }
      />

      <div className="flex-grow grid grid-cols-1 md:grid-cols-12 gap-3 min-h-0">
        {/* Thread list — hidden on mobile when a thread is selected */}
        <Card padded={false} className={`md:col-span-4 flex-col min-h-0 overflow-hidden h-[calc(100dvh-12rem)] md:h-auto ${selectedThreadId ? 'hidden md:flex' : 'flex'}`}>
          <div className="search-wrap p-3 border-b border-sand shrink-0">
            <Search size={14} className="search-icon" />
            <input
              type="text"
              placeholder="Search conversations…"
              value={threadSearch}
              onChange={(e) => setThreadSearch(e.target.value)}
              className="search-input"
            />
          </div>
          <div className="flex-grow overflow-y-auto">
            {threads.length === 0 ? (
              <EmptyState
                icon={<MessageCircle size={16} />}
                title="No messages yet"
                description="Conversations with clients will appear here."
              />
            ) : (
              threads.map(([clientId, thread]) => {
                const client = clients.find(c => c.id === clientId);
                const lastMsg = thread[thread.length - 1];
                const unreadCount = thread.filter(m => !m.read && m.recipientId === 'admin').length;

                return (
                  <button
                    key={clientId}
                    onClick={() => {
                      setSelectedThreadId(clientId);
                      thread.forEach(m => {
                        if (!m.read && m.recipientId === 'admin') onMarkMessageRead(m.id);
                      });
                    }}
                    className={`w-full px-3 py-3 text-left flex items-center gap-3 border-b border-cream hover:bg-cream/60 transition-colors relative ${
                      selectedThreadId === clientId ? 'bg-primary/5' : ''
                    }`}
                  >
                    {selectedThreadId === clientId && (
                      <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-primary" />
                    )}
                    <div className="relative shrink-0">
                      <div className="avatar avatar-md">{getInitials(client?.name)}</div>
                      {unreadCount > 0 && (
                        <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-[16px] px-1 bg-primary rounded-full text-[10px] font-medium text-obsidian flex items-center justify-center border border-white">
                          {unreadCount}
                        </span>
                      )}
                    </div>
                    <div className="flex-grow min-w-0">
                      <div className="flex justify-between items-baseline mb-0.5">
                        <h4 className="text-sm font-medium text-obsidian truncate">{client?.name || 'Unknown client'}</h4>
                        <span className="text-xs text-hint shrink-0 ml-2">
                          {new Date(lastMsg.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                        </span>
                      </div>
                      <p className={`text-xs line-clamp-1 ${unreadCount > 0 ? 'text-obsidian font-medium' : 'text-muted'}`}>
                        {lastMsg.body}
                      </p>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </Card>

        {/* Thread view — hidden on mobile when no thread is selected */}
        <Card padded={false} className={`md:col-span-8 flex-col min-h-0 overflow-hidden h-[calc(100dvh-12rem)] md:h-auto ${selectedThreadId ? 'flex' : 'hidden md:flex'}`}>
          {selectedThreadId ? (
            <>
              <div className="px-4 py-3 border-b border-sand flex justify-between items-center shrink-0 bg-white">
                <div className="flex items-center gap-3 min-w-0">
                  <button
                    onClick={() => setSelectedThreadId(null)}
                    className="md:hidden btn-icon -ml-1"
                    aria-label="Back to threads"
                  >
                    <ArrowLeft size={16} />
                  </button>
                  <div className="avatar avatar-md">{getInitials(clients.find(c => c.id === selectedThreadId)?.name)}</div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-medium text-obsidian truncate">
                      {clients.find(c => c.id === selectedThreadId)?.name}
                    </h3>
                    {(() => {
                      const client = clients.find(c => c.id === selectedThreadId);
                      return (
                        <p className="text-xs text-muted truncate">
                          {client?.email || client?.phone || 'No contact details'}
                        </p>
                      );
                    })()}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {(() => {
                    const client = clients.find(c => c.id === selectedThreadId);
                    return client?.phone ? (
                      <a href={`tel:${client.phone}`} title={`Call ${client.phone}`} className="btn-icon">
                        <Phone size={14} />
                      </a>
                    ) : null;
                  })()}
                  <Button
                    variant="ghost"
                    size="sm"
                    leadingIcon={<ExternalLink size={13} />}
                    onClick={() => {
                      setSelectedClientId(selectedThreadId);
                      setActiveTab('clients');
                      setClientRecordTab('communications');
                    }}
                  >
                    Full profile
                  </Button>
                </div>
              </div>

              <div className="flex-grow overflow-y-auto px-4 py-4 flex flex-col gap-3 bg-cream/30">
                {messageThreads[selectedThreadId]?.map((msg) => (
                  <div key={msg.id} className={`flex items-end gap-2 ${msg.senderId === 'admin' ? 'flex-row-reverse' : 'flex-row'}`}>
                    {msg.senderId !== 'admin' && (
                      <div className="avatar avatar-sm shrink-0">{getInitials(clients.find(c => c.id === selectedThreadId)?.name)}</div>
                    )}
                    <div
                      className={`max-w-[70%] px-3.5 py-2.5 rounded-lg text-sm leading-relaxed ${
                        msg.senderId === 'admin'
                          ? 'bg-obsidian text-white'
                          : 'bg-white border border-sand text-obsidian'
                      }`}
                    >
                      {msg.type === 'form' ? (
                        <div className="flex flex-col gap-2">
                          <div className="flex items-center gap-1.5 text-primary text-xs font-medium">
                            <FileText size={13} /> Clinical form
                          </div>
                          <p className="text-sm font-medium">{FORMS.find(f => f.id === msg.formId)?.title || msg.subject}</p>
                          <Button variant="primary" size="sm" fullWidth onClick={() => setViewingForm(msg)}>
                            {msg.isSigned ? 'View signed form' : 'View sent form'}
                          </Button>
                        </div>
                      ) : msg.type === 'payment' ? (
                        <div className="flex flex-col gap-2">
                          <div className="flex items-center gap-1.5 text-primary text-xs font-medium">
                            <CreditCard size={13} /> Payment link
                          </div>
                          <p className="text-sm font-medium">{msg.body?.split(': ')[0] || msg.body}</p>
                          <a href={msg.paymentUrl} target="_blank" rel="noopener noreferrer" className="btn btn-primary btn-sm w-full">
                            Pay via Stripe
                          </a>
                        </div>
                      ) : (
                        <p>{msg.body}</p>
                      )}
                      <div className={`text-xs mt-1 ${msg.senderId === 'admin' ? 'text-white/40 text-right' : 'text-hint'}`}>
                        {msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : 'Recently'}
                        {msg.senderId === 'admin' && msg.read && <span className="ml-1 text-primary">· Read</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="px-3 py-3 border-t border-sand bg-white relative shrink-0">
                {showQuickActions && (
                  <div className="absolute bottom-full left-3 mb-2 w-64 bg-white rounded-lg border border-sand shadow-panel p-1 z-20 animate-fade-up">
                    <p className="text-xs text-muted px-2 py-1.5 border-b border-cream mb-1">Quick actions</p>
                    {FORMS.map(form => (
                      <button
                        key={form.id}
                        onClick={async () => {
                          await onSendMessage({
                            senderId: 'admin',
                            recipientId: selectedThreadId,
                            subject: form.title,
                            body: `Please complete the following form: ${form.title}`,
                            type: 'form',
                            formId: form.id,
                            read: false,
                            createdAt: new Date().toISOString(),
                          });
                          setShowQuickActions(false);
                        }}
                        className="w-full flex items-center gap-2 px-2 py-2 hover:bg-cream rounded-sm transition-colors text-left"
                      >
                        <FileText size={13} className="text-muted shrink-0" />
                        <span className="text-sm text-obsidian truncate">{form.title}</span>
                      </button>
                    ))}
                    <div className="my-1 border-t border-cream" />
                    <button
                      onClick={async () => {
                        await onSendMessage({
                          senderId: 'admin',
                          recipientId: selectedThreadId,
                          subject: 'Payment request',
                          body: `Payment Request: £150 for treatment session`,
                          type: 'payment',
                          paymentUrl: 'https://buy.stripe.com/test_6oE7v9gX8',
                          read: false,
                          createdAt: new Date().toISOString(),
                        });
                        setShowQuickActions(false);
                      }}
                      className="w-full flex items-center gap-2 px-2 py-2 hover:bg-cream rounded-sm transition-colors text-left"
                    >
                      <CreditCard size={13} className="text-muted shrink-0" />
                      <span className="text-sm text-obsidian">Request payment</span>
                    </button>
                  </div>
                )}
                <MessageInputForm
                  placeholder="Type a clinical update…"
                  onSend={(msg) => handleSendMessage(msg, selectedThreadId || '')}
                  showQuickActionsBtn={true}
                  showQuickActions={showQuickActions}
                  onToggleQuickActions={() => setShowQuickActions(!showQuickActions)}
                  aiDraftContext={selectedThreadId ? {
                    clientId: selectedThreadId,
                    threadMessages: (messageThreads[selectedThreadId] || []).map(m => ({
                      senderId: m.senderId,
                      body: m.body,
                      createdAt: m.createdAt,
                    })),
                  } : undefined}
                />
              </div>
            </>
          ) : (
            <EmptyState
              icon={<MessageCircle size={16} />}
              title="Select a conversation"
              description="Choose a client from the list to view their messages and send clinical updates."
            />
          )}
        </Card>
      </div>
    </div>
  );
};

export default memo(MessagesPanel);
