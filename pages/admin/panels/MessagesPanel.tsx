import React, { memo } from 'react';
import { useAdminContext } from '../context';
import { MessageInputForm } from '../AdminComponents';
import { FORMS } from '../../../constants';

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
    <div className="animate-fade-up h-[calc(100vh-10rem)] flex flex-col gap-8">
      <div className="flex justify-between items-center">
         <div>
           <h2 className="text-2xl md:text-4xl lg:text-5xl font-black text-text-main tracking-tight">Message Center</h2>
           <p className="hidden lg:block text-[11px] font-black text-text-muted uppercase tracking-[0.2em] mt-3 flex items-center gap-2">
             <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
             Real-time communication with your clinical patients
           </p>
         </div>
         {user?.role === 'admin' && (
            <button
              onClick={() => setShowOnlyAssigned(!showOnlyAssigned)}
              className={`btn-clinical ${showOnlyAssigned ? 'btn-clinical-primary' : 'btn-clinical-secondary'}`}
            >
              <span className="material-symbols-outlined text-lg mr-2">{showOnlyAssigned ? 'person' : 'group'}</span>
              {showOnlyAssigned ? 'My Assignments' : 'All Messages'}
            </button>
          )}
      </div>

      <div className="flex-grow grid grid-cols-1 md:grid-cols-12 gap-8 min-h-0">
         <div className="md:col-span-4 bg-white rounded-[3rem] border border-black/5 shadow-2xl shadow-black/5 flex flex-col min-h-0 overflow-hidden">
            <div className="p-8 border-b border-black/5 bg-bg-soft/30">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search conversations..."
                  value={threadSearch}
                  onChange={(e) => setThreadSearch(e.target.value)}
                  className="w-full bg-white border border-black/5 rounded-2xl px-12 py-4 text-xs font-bold shadow-sm focus:ring-4 focus:ring-primary/10 transition-all"
                />
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-primary text-xl">search</span>
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
                    className={`w-full p-8 text-left transition-all hover:bg-bg-soft flex items-center gap-5 border-l-4 ${selectedThreadId === clientId ? 'bg-primary/5 border-primary' : 'border-transparent'}`}
                  >
                    <div className="relative shrink-0">
                      <div className="w-16 h-16 rounded-[1.25rem] bg-clinical-dark flex items-center justify-center text-white font-black text-sm shadow-lg shadow-clinical-dark/20 group-hover:scale-105 transition-transform">
                        {getInitials(client?.name)}
                      </div>
                      {unreadCount > 0 && (
                        <div className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-primary border-4 border-white flex items-center justify-center text-[10px] font-black text-clinical-dark shadow-sm">
                          {unreadCount}
                        </div>
                      )}
                    </div>
                    <div className="flex-grow min-w-0">
                      <div className="flex justify-between items-center mb-2">
                        <h4 className="text-sm font-black text-text-main truncate">{client?.name || 'Unknown Client'}</h4>
                        <span className="text-[9px] font-bold text-text-muted shrink-0 uppercase tracking-widest">{new Date(lastMsg.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}</span>
                      </div>
                      <p className={`text-[11px] leading-relaxed line-clamp-2 ${unreadCount > 0 ? 'font-bold text-text-main' : 'text-text-muted'}`}>{lastMsg.body}</p>
                    </div>
                  </button>
                );
              })}
              {Object.keys(messageThreads).length === 0 && (
                <div className="p-20 text-center">
                  <span className="material-symbols-outlined text-5xl text-primary/20 mb-4">forum</span>
                  <p className="text-[10px] font-black uppercase tracking-widest text-text-muted">No messages yet</p>
                </div>
              )}
            </div>
         </div>
         <div className="md:col-span-8 bg-white rounded-[3rem] border border-black/5 shadow-2xl shadow-black/5 flex flex-col overflow-hidden relative">
            {selectedThreadId ? (
              <>
                <div className="p-8 border-b border-black/5 flex justify-between items-center bg-white/80 backdrop-blur-md sticky top-0 z-10">
                  <div className="flex items-center gap-4">
                     <div className="w-14 h-14 rounded-2xl bg-clinical-dark flex items-center justify-center text-white font-black text-lg shadow-lg shadow-clinical-dark/20">
                       {getInitials(clients.find(c => c.id === selectedThreadId)?.name)}
                     </div>
                     <div>
                       <h3 className="text-lg font-black text-text-main">
                         {clients.find(c => c.id === selectedThreadId)?.name}
                       </h3>
                       {(() => {
                         const client = clients.find(c => c.id === selectedThreadId);
                         return (
                           <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted mt-1">
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
                          className="w-12 h-12 rounded-2xl bg-bg-soft text-text-muted hover:text-primary transition-all flex items-center justify-center"
                        >
                          <span className="material-symbols-outlined">call</span>
                        </a>
                      ) : null;
                    })()}
                    <button
                      onClick={() => {
                        setSelectedClientId(selectedThreadId);
                        setActiveTab('clients');
                        setClientRecordTab('communications');
                      }}
                      className="bg-clinical-dark text-white px-8 py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-black transition-all shadow-lg shadow-black/10"
                    >
                      View Full Profile
                    </button>
                  </div>
                </div>
                <div className="flex-grow overflow-y-auto p-10 space-y-6 no-scrollbar bg-bg-soft/20">
                  {messageThreads[selectedThreadId]?.map((msg) => (
                    <div key={msg.id} className={`flex items-end gap-3 ${msg.senderId === 'admin' ? 'flex-row-reverse' : 'flex-row'}`}>
                      {msg.senderId !== 'admin' && (
                        <div className="w-10 h-10 rounded-xl bg-white border border-black/5 flex items-center justify-center text-primary font-black text-[10px] shrink-0 shadow-sm">
                          {getInitials(clients.find(c => c.id === selectedThreadId)?.name)}
                        </div>
                      )}
                      <div className={`max-w-[65%] p-6 shadow-xl shadow-black/5 ${
                        msg.senderId === 'admin'
                          ? 'bg-clinical-dark text-white rounded-[2rem] rounded-br-sm'
                          : 'bg-white border border-black/5 text-text-main rounded-[2rem] rounded-bl-sm'
                      }`}>
                        {msg.type === 'form' ? (
                          <div className="space-y-4">
                            <div className="flex items-center gap-3 text-primary">
                              <span className="material-symbols-outlined text-xl">description</span>
                              <span className="text-[10px] font-black uppercase tracking-widest">Clinical Form Attachment</span>
                            </div>
                            <p className="text-sm font-bold leading-relaxed">{FORMS.find(f => f.id === msg.formId)?.title || msg.subject}</p>
                            <button
                              onClick={() => setViewingForm(msg)}
                              className="block w-full bg-primary text-clinical-dark text-center py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:scale-[1.02] transition-transform shadow-lg shadow-primary/20"
                            >
                              {msg.isSigned ? 'View Signed Form' : 'View Sent Form'}
                            </button>
                          </div>
                        ) : msg.type === 'payment' ? (
                          <div className="space-y-4">
                            <div className="flex items-center gap-3 text-primary">
                              <span className="material-symbols-outlined text-xl">payments</span>
                              <span className="text-[10px] font-black uppercase tracking-widest">Secure Payment Link</span>
                            </div>
                            <p className="text-sm font-bold leading-relaxed">{msg.body?.split(': ')[0] || msg.body}</p>
                            <a
                              href={msg.paymentUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block w-full bg-primary text-clinical-dark text-center py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:scale-[1.02] transition-transform shadow-lg shadow-primary/20"
                            >
                              Pay via Stripe
                            </a>
                          </div>
                        ) : (
                          <>
                            <p className="text-sm leading-relaxed mb-3">{msg.body}</p>
                          </>
                        )}
                        <div className={`text-[8px] font-bold uppercase tracking-widest ${
                          msg.senderId === 'admin' ? 'text-white/40 text-right' : 'text-text-muted'
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
                      <p className="text-[9px] font-black uppercase tracking-widest text-text-muted p-2 border-b border-black/5 mb-1">Quick Clinical Actions</p>
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
                          className="w-full flex items-center gap-3 p-3 hover:bg-bg-soft rounded-xl transition-all text-left group"
                        >
                          <span className="material-symbols-outlined text-primary text-sm group-hover:scale-110 transition-transform">description</span>
                          <span className="text-[10px] font-bold text-text-main truncate">{form.title}</span>
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
                        className="w-full flex items-center gap-3 p-3 hover:bg-bg-soft rounded-xl transition-all text-left group border-t border-black/5 mt-1"
                      >
                        <span className="material-symbols-outlined text-primary text-sm group-hover:scale-110 transition-transform">payments</span>
                        <span className="text-[10px] font-bold text-text-main">Request Payment</span>
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
                <div className="w-24 h-24 bg-bg-soft rounded-[2.5rem] flex items-center justify-center text-primary/20 mb-6">
                  <span className="material-symbols-outlined text-6xl">forum</span>
                </div>
                <h3 className="text-lg font-black text-text-main mb-2">Select a Conversation</h3>
                <p className="text-xs text-text-muted font-medium max-w-xs">Choose a client from the registry to view their communication history and send clinical updates.</p>
              </div>
            )}
         </div>
      </div>
    </div>
  );
};

export default memo(MessagesPanel);
