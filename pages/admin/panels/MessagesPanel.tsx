import React, { memo } from 'react';
import { useAdminContext } from '../context';
import { MessageInputForm } from '../AdminComponents';
import { FORMS } from '../../../constants';
import { Search, MessageCircle, Phone, FileText, CreditCard, Send } from 'lucide-react';

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
        subject: 'Clinic Update',
        body: msgText,
        read: false,
        createdAt: new Date().toISOString()
      });
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  return (
    <div className="animate-fade-up h-[calc(100vh-9rem)] flex flex-col gap-4">
      <div className="flex justify-between items-center">
        <div>
          <p className="page-eyebrow">Inbox</p>
          <h2 className="page-title">Conversations</h2>
        </div>
        {user?.role === 'admin' && (
          <button
            onClick={() => setShowOnlyAssigned(!showOnlyAssigned)}
            className={`btn btn-sm ${showOnlyAssigned ? 'btn-primary' : 'btn-ghost'}`}
          >
            {showOnlyAssigned ? 'My assignments' : 'All conversations'}
          </button>
        )}
      </div>

      <div className="flex-grow grid grid-cols-1 md:grid-cols-12 gap-8 min-h-0">
         <div className="md:col-span-4 bg-white rounded-[3rem] border border-black/5 shadow-2xl shadow-black/5 flex flex-col min-h-0 overflow-hidden">
            <div className="p-8 border-b border-black/5 bg-cream/30">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search conversations..."
                  value={threadSearch}
                  onChange={(e) => setThreadSearch(e.target.value)}
                  className="w-full bg-white border border-black/5 rounded-2xl px-12 py-4 text-xs font-bold shadow-sm focus:ring-4 focus:ring-primary/10 transition-all"
                />
                <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-primary" />
              </div>
            </div>
            <div className="flex-grow overflow-y-auto no-scrollbar divide-y divide-black/5">
              {Object.entries(messageThreads)
                .filter(([clientId]) => {
                  const client = clients.find(c => c.id === clientId);
                  return client?.name?.toLowerCase().includes(threadSearch.toLowerCase()) || clientId.toLowerCase().includes(threadSearch.toLowerCase());
                })
                .sort((a, b) => {
                  const lastA = a[1].length > 0 ? new Date(a[1][a[1].length - 1].createdAt).getTime() : 0;
                  const lastB = b[1].length > 0 ? new Date(b[1][b[1].length - 1].createdAt).getTime() : 0;
                  return lastB - lastA;
                })
                .map(([clientId, thread]) => {
                const client = clients.find(c => c.id === clientId);
                const lastMsg = thread[thread.length - 1];
                const unreadCount = thread.filter(m => !m.read && m.recipientId === 'admin').length;

                return (
                  <button
                    key={clientId}
                    onClick={() => {
                      setSelectedThreadId(clientId);
                      // Mark all as read
                      thread.forEach(m => {
                        if (!m.read && m.recipientId === 'admin') onMarkMessageRead(m.id);
                      });
                    }}
                    className={`w-full p-8 text-left transition-all hover:bg-cream flex items-center gap-5 border-l-4 ${selectedThreadId === clientId ? 'bg-primary/5 border-primary' : 'border-transparent'}`}
                  >
                    <div className="relative shrink-0">
                      <div className="w-16 h-16 rounded-[1.25rem] bg-obsidian flex items-center justify-center text-white font-medium text-sm shadow-lg shadow-clinical-dark/20 group-hover:scale-105 transition-transform">
                        {getInitials(client?.name)}
                      </div>
                      {unreadCount > 0 && (
                        <div className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-primary border-4 border-white flex items-center justify-center text-[10px] font-medium text-clinical-dark shadow-sm">
                          {unreadCount}
                        </div>
                      )}
                    </div>
                    <div className="flex-grow min-w-0">
                      <div className="flex justify-between items-center mb-2">
                        <h4 className="text-sm font-medium text-obsidian truncate">{client?.name || 'Unknown Client'}</h4>
                        <span className="text-[9px] font-bold text-muted shrink-0 uppercase">{new Date(lastMsg.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}</span>
                      </div>
                      <p className={`text-[11px] leading-relaxed line-clamp-2 ${unreadCount > 0 ? 'font-bold text-obsidian' : 'text-muted'}`}>{lastMsg.body}</p>
                    </div>
                  </button>
                );
              })}
              {Object.keys(messageThreads).length === 0 && (
                <div className="p-20 text-center">
                  <MessageCircle size={48} className="text-primary/20 mb-4" />
                  <p className="text-2xs font-medium text-hint text-muted">No messages yet</p>
                </div>
              )}
            </div>
         </div>
         <div className="md:col-span-8 bg-white rounded-[3rem] border border-black/5 shadow-2xl shadow-black/5 flex flex-col overflow-hidden relative">
            {selectedThreadId ? (
              <>
                <div className="p-8 border-b border-black/5 flex justify-between items-center bg-white/80 backdrop-blur-md sticky top-0 z-10">
                  <div className="flex items-center gap-4">
                     <div className="w-14 h-14 rounded-2xl bg-obsidian flex items-center justify-center text-white font-medium text-lg shadow-lg shadow-clinical-dark/20">
                       {getInitials(clients.find(c => c.id === selectedThreadId)?.name)}
                     </div>
                     <div>
                       <h3 className="text-lg font-medium text-obsidian">
                         {clients.find(c => c.id === selectedThreadId)?.name}
                       </h3>
                       {(() => {
                         const client = clients.find(c => c.id === selectedThreadId);
                         return (
                           <p className="text-[10px] font-bold uppercase text-muted mt-1">
                             {client?.email || client?.phone || 'No contact details'}
                           </p>
                         );
                       })()}
                     </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {(() => {
                      const client = clients.find(c => c.id === selectedThreadId);
                      return client?.phone ? (
                        <a
                          href={`tel:${client.phone}`}
                          title={`Call ${client.phone}`}
                          className="w-12 h-12 rounded-2xl bg-cream text-muted hover:text-primary transition-all flex items-center justify-center"
                        >
                          <Phone size={18} />
                        </a>
                      ) : null;
                    })()}
                    <button
                      onClick={() => {
                        setSelectedClientId(selectedThreadId);
                        setActiveTab('clients');
                        setClientRecordTab('communications');
                      }}
                      className="bg-obsidian text-white px-8 py-3.5 rounded-2xl text-2xs font-medium text-hint hover:bg-black transition-all shadow-lg shadow-black/10"
                    >
                      View Full Profile
                    </button>
                  </div>
                </div>
                <div className="flex-grow overflow-y-auto p-10 space-y-6 no-scrollbar bg-cream/20">
                  {messageThreads[selectedThreadId]?.map((msg) => (
                    <div key={msg.id} className={`flex items-end gap-3 ${msg.senderId === 'admin' ? 'flex-row-reverse' : 'flex-row'}`}>
                      {msg.senderId !== 'admin' && (
                        <div className="w-10 h-10 rounded-xl bg-white border border-black/5 flex items-center justify-center text-primary font-medium text-[10px] shrink-0 shadow-sm">
                          {getInitials(clients.find(c => c.id === selectedThreadId)?.name)}
                        </div>
                      )}
                      <div className={`max-w-[65%] p-6 shadow-xl shadow-black/5 ${
                        msg.senderId === 'admin'
                          ? 'bg-obsidian text-white rounded-[2rem] rounded-br-sm'
                          : 'bg-white border border-black/5 text-obsidian rounded-[2rem] rounded-bl-sm'
                      }`}>
                        {msg.type === 'form' ? (
                          <div className="space-y-4">
                            <div className="flex items-center gap-3 text-primary">
                              <FileText size={20} />
                              <span className="text-2xs font-medium text-hint">Clinical Form Attachment</span>
                            </div>
                            <p className="text-sm font-bold leading-relaxed">{FORMS.find(f => f.id === msg.formId)?.title || msg.subject}</p>
                            <button
                              onClick={() => setViewingForm(msg)}
                              className="block w-full bg-primary text-clinical-dark text-center py-3.5 rounded-2xl text-2xs font-medium text-hint hover:scale-[1.02] transition-transform shadow-lg shadow-primary/20"
                            >
                              {msg.isSigned ? 'View Signed Form' : 'View Sent Form'}
                            </button>
                          </div>
                        ) : msg.type === 'payment' ? (
                          <div className="space-y-4">
                            <div className="flex items-center gap-3 text-primary">
                              <CreditCard size={20} />
                              <span className="text-2xs font-medium text-hint">Secure Payment Link</span>
                            </div>
                            <p className="text-sm font-bold leading-relaxed">{msg.body?.split(': ')[0] || msg.body}</p>
                            <a
                              href={msg.paymentUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block w-full bg-primary text-clinical-dark text-center py-3.5 rounded-2xl text-2xs font-medium text-hint hover:scale-[1.02] transition-transform shadow-lg shadow-primary/20"
                            >
                              Pay via Stripe
                            </a>
                          </div>
                        ) : (
                          <>
                            <p className="text-sm leading-relaxed mb-3">{msg.body}</p>
                          </>
                        )}
                        <div className={`text-[8px] font-bold uppercase ${
                          msg.senderId === 'admin' ? 'text-white/40 text-right' : 'text-muted'
                        } mt-2`}>
                          {msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : 'Recently'}
                          {msg.senderId === 'admin' && msg.read && <span className="ml-1 text-primary">Read</span>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="p-6 bg-white border-t border-black/5 relative">
                  {showQuickActions && (
                    <div className="absolute bottom-full left-6 mb-2 w-64 bg-white rounded-2xl border border-black/5 shadow-2xl p-2 z-20 animate-fade-up">
                      <p className="text-2xs font-medium text-hint text-muted p-2 border-b border-black/5 mb-1">Quick Clinical Actions</p>
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
                              createdAt: new Date().toISOString()
                            });
                            setShowQuickActions(false);
                          }}
                          className="w-full flex items-center gap-3 p-3 hover:bg-cream rounded-xl transition-all text-left group"
                        >
                          <FileText size={16} className="text-primary group-hover:scale-110 transition-transform" />
                          <span className="text-[10px] font-bold text-obsidian truncate">{form.title}</span>
                        </button>
                      ))}
                      <button
                        onClick={async () => {
                          const amount = '150'; // Default amount to avoid prompt in iframe
                          await onSendMessage({
                            senderId: 'admin',
                            recipientId: selectedThreadId,
                            subject: 'Payment Request',
                            body: `Payment Request: £${amount} for treatment session`,
                            type: 'payment',
                            paymentUrl: 'https://buy.stripe.com/test_6oE7v9gX8',
                            read: false,
                            createdAt: new Date().toISOString()
                          });
                          setShowQuickActions(false);
                        }}
                        className="w-full flex items-center gap-3 p-3 hover:bg-cream rounded-xl transition-all text-left group border-t border-black/5 mt-1"
                      >
                        <CreditCard size={16} className="text-primary group-hover:scale-110 transition-transform" />
                        <span className="text-[10px] font-bold text-obsidian">Request Payment</span>
                      </button>
                    </div>
                  )}
                  <MessageInputForm
                    placeholder="Type clinical update..."
                    onSend={(msg) => handleSendMessage(msg, selectedThreadId || '')}
                    showQuickActionsBtn={true}
                    showQuickActions={showQuickActions}
                    onToggleQuickActions={() => setShowQuickActions(!showQuickActions)}
                  />
                </div>
              </>
            ) : (
              <div className="flex-grow flex flex-col items-center justify-center p-12 text-center">
                <div className="w-24 h-24 bg-cream rounded-[2.5rem] flex items-center justify-center text-primary/20 mb-6">
                  <MessageCircle size={60} />
                </div>
                <h3 className="text-lg font-medium text-obsidian mb-2">Select a Conversation</h3>
                <p className="text-xs text-muted font-medium max-w-xs">Choose a client from the registry to view their communication history and send clinical updates.</p>
              </div>
            )}
         </div>
      </div>
    </div>
  );
};

export default memo(MessagesPanel);
