export const DEFAULT_TOPAPPBAR_SOURCE = `function Component() {
  const displayTitle = typeof title !== 'undefined' ? title : "messages";
  return React.createElement('div', {
    style: {
      width: '100%',
      boxSizing: 'border-box',
      background: '#141414',
      display: 'flex',
      alignItems: 'center',
      padding: '12px 16px',
      gap: '8px'
    }
  }, [
    React.createElement('div', { key: 'menu', onClick: function() { if (typeof onOpenProfile === 'function') { onOpenProfile(); } }, style: { cursor: 'pointer', WebkitTapHighlightColor: 'transparent', userSelect: 'none', flexShrink: 0 } }, React.createElement(ProfileImage, { avatarUrl: myAvatarUrl, contactInitials: myAvatarInitials, contactAvatarColor: myAvatarColor, size: 36 })),
    React.createElement('div', {
      key: 'center',
      style: {
        flex: 1,
        minWidth: 0,
        overflow: 'hidden',
        whiteSpace: 'nowrap',
        textOverflow: 'ellipsis',
        fontSize: '20px',
        fontWeight: 700,
        color: '#fff'
      }
    }, displayTitle),
    React.createElement('div', {
      key: 'right',
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        flexShrink: 0
      }
    }, [
      React.createElement('button', {
        key: 'search',
        onClick: typeof onSearchTap === 'function' ? onSearchTap : () => {},
        style: {
          width: '40px',
          height: '40px',
          borderRadius: '50%',
          background: '#1E1E1E',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: 'none',
          flexShrink: 0,
          cursor: 'pointer'
        }
      }, React.createElement(Icon, { name: 'search', size: 20, color: '#E8E8E8' })),
      React.createElement('button', {
        key: 'newChat',
        onClick: typeof onNewChatTap === 'function' ? onNewChatTap : () => {},
        style: {
          width: '40px',
          height: '40px',
          borderRadius: '50%',
          background: '#1E1E1E',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: 'none',
          flexShrink: 0,
          cursor: 'pointer'
        }
      }, React.createElement(Icon, { name: 'edit', size: 20, color: '#E8E8E8' }))
      ,React.createElement('button', {
        key: 'communities',
        onClick: typeof onCommunityTap === 'function' ? onCommunityTap : () => {},
        style: {
          width: '40px',
          height: '40px',
          borderRadius: '50%',
          background: '#1E1E1E',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: 'none',
          flexShrink: 0,
          cursor: 'pointer'
        }
      }, React.createElement(Icon, { name: 'users', size: 20, color: '#E8E8E8' }))
    ])
  ]);
}`;

export const DEFAULT_SEARCHBAR_SOURCE = `function Component() {
  var s = useComponentState('searchQuery', '');
  var inputValue = s[0], setInputValue = s[1];
  return React.createElement('div', {
    style: { padding: '8px 16px', background: '#141414' }
  },
    React.createElement('div', {
      style: {
        display: 'flex', alignItems: 'center', background: '#1e1e1e',
        borderRadius: '12px', padding: '8px 12px', gap: '8px'
      }
    },
      React.createElement(Icon, { name: 'search', size: 18, color: '#666' }),
      React.createElement('input', {
        type: 'text',
        value: inputValue,
        onChange: function(e) { setInputValue(e.target.value); },
        placeholder: 'search conversations...',
        autoFocus: true,
        style: {
          flex: 1, background: 'none', border: 'none',
          outline: 'none', color: '#e8e8e8', fontSize: '15px'
        }
      }),
      inputValue ? React.createElement('button', {
        onClick: function() { setInputValue(''); },
        style: { background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }
      }, React.createElement(Icon, { name: 'x', size: 16, color: '#666' })) : null,
      React.createElement('button', {
        onClick: closeSearch,
        style: { background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }
      }, React.createElement('span', { style: { color: '#888', fontSize: '14px' } }, 'cancel'))
    )
  );
}`;

export const DEFAULT_CHATTILE_SOURCE = `function Component() {
  var _lp = React.useRef(null);
  var handleDown = function() {
    _lp.current = setTimeout(function() { onLongPress && onLongPress(); }, 500);
  };
  var handleUp = function() {
    if (_lp.current) { clearTimeout(_lp.current); _lp.current = null; }
  };
  var badge = contact.unreadCount > 99 ? '99+' : String(contact.unreadCount);
  return React.createElement('div', {
    onClick: function() { onTap && onTap(); },
    onPointerDown: handleDown,
    onPointerUp: handleUp,
    onPointerLeave: handleUp,
    onPointerCancel: handleUp,
    onContextMenu: function(e) { e.preventDefault(); onLongPress && onLongPress(); },
    style: {
      display: 'flex', flexDirection: 'row', alignItems: 'center',
      width: '100%', minHeight: '72px', padding: '12px 16px',
      background: '#141414', borderBottom: '1px solid #1F1F1F',
      cursor: 'pointer', boxSizing: 'border-box',
    }
  },
    React.createElement('div', {
      style: { position: 'relative', flexShrink: 0, width: '48px', height: '48px', marginRight: '12px' }
    },
      React.createElement('div', {
        style: {
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: '100%', height: '100%', borderRadius: '50%',
          backgroundColor: contact.avatarUrl ? 'transparent' : contact.avatarColor,
          backgroundImage: contact.avatarUrl ? 'url(' + contact.avatarUrl + ')' : undefined,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          boxShadow: contact.isOnline ? '0 0 0 2px #22C55E' : 'none',
        }
      }, contact.avatarUrl ? null : React.createElement('span', {
        style: { fontSize: '16px', fontWeight: '600', color: '#F3F4F6' }
      }, contact.avatarInitials)),
      contact.isOnline ? React.createElement('div', {
        style: {
          position: 'absolute', bottom: 0, right: 0,
          width: '10px', height: '10px', borderRadius: '50%', background: '#22C55E',
        }
      }) : null
    ),
    React.createElement('div', {
      style: { display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0, marginRight: '12px', gap: '3px' }
    },
      React.createElement('div', {
        style: {
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          fontSize: '15px', fontWeight: '600', color: '#E8E8E8',
        }
      }, contact.name),
      React.createElement('div', {
        style: {
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          fontSize: '13px', fontWeight: '400', color: '#8A8A8A',
        }
      }, contact.lastMessage)
    ),
    React.createElement('div', {
      style: { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }
    },
      React.createElement('div', {
        style: { fontSize: '11px', color: '#8A8A8A' }
      }, contact.lastMessageTime),
      contact.unreadCount > 0 ? React.createElement('div', {
        style: {
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          minWidth: '20px', height: '20px', borderRadius: '9999px',
          background: '#3B82F6', padding: '0 6px',
          color: '#fff', fontSize: '11px', fontWeight: '700',
        }
      }, badge) : null
    )
  );
}`;

export const DEFAULT_BOTTOMSHEET_SOURCE = `function Component() {
  return React.createElement(React.Fragment, null,
    React.createElement('div', {
      onClick: function() { onClose && onClose(); },
      style: { position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.6)' }
    }),
    React.createElement('div', {
      style: {
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 201,
        background: '#1A1A1A', borderRadius: '20px 20px 0 0',
        paddingTop: '12px',
        paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)',
        maxHeight: '80vh', overflowY: 'auto',
      }
    },
      React.createElement('div', { style: { display: 'flex', justifyContent: 'center', width: '100%' } },
        React.createElement('div', {
          style: { width: '36px', height: '4px', borderRadius: '9999px', background: '#3A3A3A', marginBottom: '16px' }
        })
      ),
      title ? React.createElement('div', {
        style: {
          fontSize: '15px', fontWeight: '600', color: '#8A8A8A',
          textAlign: 'center', paddingBottom: '8px',
          borderBottom: '1px solid #2A2A2A', marginBottom: '4px',
        }
      }, title) : null,
      React.createElement('div', { style: { display: 'flex', flexDirection: 'column' } },
        (options || []).map(function(option, index) {
          return React.createElement('div', {
            key: option.id,
            onClick: function(e) {
              e.stopPropagation();
              onOptionSelect && onOptionSelect(option);
              onClose && onClose();
            },
            style: {
              display: 'flex', flexDirection: 'row', alignItems: 'center',
              width: '100%', height: '52px', padding: '0 20px', gap: '14px',
              borderBottom: index < (options.length - 1) ? '1px solid #2A2A2A' : 'none',
              cursor: 'pointer', boxSizing: 'border-box',
            }
          },
            option.icon ? React.createElement('span', { style: { fontSize: '20px' } }, option.icon) : null,
            React.createElement('div', {
              style: { fontSize: '16px', fontWeight: '400', color: option.destructive ? '#EF4444' : '#E8E8E8' }
            }, option.label)
          );
        })
      )
    )
  );
}`;

export const DEFAULT_CHATSCREEN_SOURCE = `function Component() {
  var messagesState = useComponentState('chatMessages', messages || []);
  var renderedMessages = messagesState[0];
  var actionsState = useComponentState('activeMessageActions', null);
  var actions = actionsState[0]; var setActions = actionsState[1];
  var dmDeleteState = useComponentState('dmDeleteTarget', null);
  var dmDeleteTarget = dmDeleteState[0]; var setDmDeleteTarget = dmDeleteState[1];
  var reactionDetailState = useComponentState('reactionDetail', null); var reactionDetail = reactionDetailState[0]; var setReactionDetail = reactionDetailState[1];
  var openTrayAct = useComponentState('openReactionMessageId', null);
  var openTrayMsgId = openTrayAct[0]; var setOpenTrayAct = openTrayAct[1];
  var typingState = useComponentState('otherUserTyping', false);
  var isOtherTyping = typingState[0];
  var bottomRef = React.useRef(null);
  var initialScrollCount = React.useRef(0);
  React.useLayoutEffect(function() {
    if (bottomRef.current) {
      if (initialScrollCount.current < 2) {
        bottomRef.current.scrollIntoView({ behavior: 'auto' });
        if ((renderedMessages || []).length > 0) {
          initialScrollCount.current += 1;
        }
      } else {
        bottomRef.current.scrollIntoView({ behavior: 'smooth' });
      }
    }
  }, [(renderedMessages || []).length]);
  return React.createElement('div', {
    style: { display: 'flex', flexDirection: 'column', height: '100vh', width: '100%', background: '#0a0a0a' }
  },
    React.createElement('style', null, '.chat-scrollbar-hide::-webkit-scrollbar { display: none; }'),
    React.createElement('div', {
      style: {
        display: 'flex', flexDirection: 'row', alignItems: 'center',
        justifyContent: 'space-between', minHeight: '56px',
        background: '#141414', borderBottom: '1px solid #1F1F1F',
        flexShrink: 0, padding: '0 16px',
      }
    },
      React.createElement('div', { style: { display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '10px' } },
        React.createElement(BackButton, { onBack: onBack }),
        React.createElement('div', { style: { display: 'flex', flexDirection: 'column' } },
          React.createElement(ChatName, { contactName: contactName }),
          isOtherTyping ? React.createElement(TypingIndicator, {}) : React.createElement(OnlineStatus, { isOnline: isOnline, lastSeen: lastSeen })
        )
      ),
      React.createElement('div', { onClick: function(e) { if (e && typeof e.stopPropagation === 'function') e.stopPropagation(); if (typeof onViewContactProfile === 'function') onViewContactProfile(); }, style: { cursor: 'pointer', WebkitTapHighlightColor: 'transparent', userSelect: 'none', flexShrink: 0 } }, React.createElement(ProfileImage, { avatarUrl: avatarUrl, contactInitials: contactInitials, contactAvatarColor: contactAvatarColor }))
    ),
    React.createElement('div', {
      className: 'chat-scrollbar-hide',
      style: { flex: 1, overflowY: 'auto', padding: '8px 0 12px', display: 'flex', flexDirection: 'column', gap: '6px', scrollbarWidth: 'none', msOverflowStyle: 'none', position: 'relative', zIndex: 101 }
    },
      (renderedMessages || []).length === 0
        ? React.createElement('div', { style: { height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8A8A8A' } }, 'no messages yet')
        : (renderedMessages || []).map(function(msg, index, arr) {
            var separator = null;
            if (msg.createdAt) {
              var currentDt = new Date(msg.createdAt);
              if (!isNaN(currentDt)) {
                var prevDt = index > 0 && arr[index-1].createdAt ? new Date(arr[index-1].createdAt) : null;
                var dayChanged = true;
                if (prevDt && !isNaN(prevDt)) {
                  if (currentDt.getFullYear() === prevDt.getFullYear() && currentDt.getMonth() === prevDt.getMonth() && currentDt.getDate() === prevDt.getDate()) {
                    dayChanged = false;
                  }
                }
                if (dayChanged) {
                  var now = new Date();
                  var today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                  var dDay = new Date(currentDt.getFullYear(), currentDt.getMonth(), currentDt.getDate());
                  var diff = Math.round((today - dDay) / 86400000);
                  var label = '';
                  if (diff === 0) label = 'Today';
                  else if (diff === 1) label = 'Yesterday';
                  else label = currentDt.toLocaleDateString(undefined, { day: 'numeric', month: 'long' });
                  
                  separator = React.createElement(DateSeparator, {
                    key: 'sep-' + msg.id,
                    label: label
                  });
                }
              }
            }
            var bubble;
            if (msg.messageType === 'invite' && msg.metadata && msg.metadata.communityId) {
              var meta = msg.metadata;
              var isUsed = !!meta.usedAt;
              var invTypeLabel = meta.communityType === 'protected' ? 'Protected' : meta.communityType === 'private' ? 'Private' : 'Public';
              bubble = React.createElement('div', { key: msg.id, style: { display: 'flex', justifyContent: msg.isSent ? 'flex-end' : 'flex-start', padding: '4px 16px' } },
                React.createElement('div', {
                  onClick: function() { if (typeof onOpenCommunityInvite === 'function') onOpenCommunityInvite(meta, msg.id); },
                  style: { maxWidth: '72%', minWidth: '210px', background: '#161B2E', borderRadius: '16px', overflow: 'hidden', cursor: 'pointer', border: '1px solid rgba(255,255,255,0.08)', WebkitTapHighlightColor: 'transparent' }
                },
                  React.createElement('div', { style: { padding: '12px 14px', display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '10px' } },
                    React.createElement('div', { style: { width: '44px', height: '44px', borderRadius: '12px', background: '#1A1A1A', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 } },
                      meta.avatarUrl ? React.createElement('img', { src: meta.avatarUrl, style: { width: '100%', height: '100%', objectFit: 'cover' } }) : React.createElement('span', { style: { fontSize: '18px', fontWeight: '700', color: '#E8E8E8' } }, (meta.communityName || '?').charAt(0).toUpperCase())
                    ),
                    React.createElement('div', { style: { flex: 1, minWidth: 0 } },
                      React.createElement('div', { style: { fontSize: '14px', fontWeight: '600', color: '#F3F4F6', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, meta.communityName || 'Community'),
                      React.createElement('div', { style: { fontSize: '11px', color: 'rgba(255,255,255,0.35)', marginTop: '2px' } }, invTypeLabel + ' \u00B7 ' + (meta.memberCount || 0) + ' members')
                    )
                  ),
                  React.createElement('div', { style: { height: '1px', background: 'rgba(255,255,255,0.06)' } }),
                  React.createElement('div', { style: { padding: '10px 14px' } },
                    React.createElement('div', { style: { background: isUsed ? 'rgba(255,255,255,0.06)' : '#2563EB', borderRadius: '999px', padding: '9px 0', textAlign: 'center', fontSize: '13px', fontWeight: '600', color: isUsed ? 'rgba(255,255,255,0.3)' : '#FFF' } },
                      isUsed ? 'Already joined' : (msg.isSent ? 'View community' : 'Join community')
                    )
                  ),
                  React.createElement('div', { style: { padding: '0 14px 10px', textAlign: 'right', fontSize: '10px', color: 'rgba(255,255,255,0.2)' } }, msg.timestamp)
                )
              );
            } else {
              bubble = React.createElement(MessageBubble, { key: msg.id + '-' + msg.status + (msg.isDeleted ? '-deleted' : ''), id: msg.id, contactId: msg.contactId, content: msg.content, timestamp: msg.timestamp, isSent: msg.isSent, isRead: msg.isRead, status: msg.status, replyTo: msg.replyTo, isDeleted: !!msg.isDeleted, onReplyTo: onReplyTo, onJumpToReply: onJumpToReply, currentUserId: currentUserId, onToggleReaction: onToggleReaction, onShowReactors: onShowReactors });
            }
            return separator ? React.createElement(React.Fragment, { key: 'frag-' + msg.id }, separator, bubble) : bubble;
          }),
      React.createElement('div', { ref: bottomRef })
    ),
    React.createElement(ComposerBar, { sendMessage: sendMessage, onAttach: onAttach, onTyping: onTyping, replyingTo: replyingTo, onCancelReply: onCancelReply }),
  React.createElement('div', { onClick: function() { setActions(null); setOpenTrayAct(null); }, style: { position: 'fixed', inset: 0, zIndex: 100, display: actions ? 'block' : 'none', background: 'transparent' } }),
  React.createElement('div', {
    style: { position: 'fixed', bottom: 'calc(env(safe-area-inset-bottom, 0px) + 74px)', left: '50%', transform: actions ? 'translate(-50%, 0px)' : 'translate(-50%, 100px)', opacity: actions ? 1 : 0, pointerEvents: actions ? 'auto' : 'none', transition: 'transform 0.3s cubic-bezier(0.34,1.56,0.64,1), opacity 0.22s ease', zIndex: 101, background: '#1A1A1A', borderRadius: '26px', border: '1px solid rgba(255,255,255,0.1)', padding: '8px 10px', display: 'flex', flexDirection: 'row', gap: '2px', boxShadow: '0 8px 40px rgba(0,0,0,0.75)', userSelect: 'none' }
  },
    React.createElement('div', { onClick: function(e) { e.stopPropagation(); if (actions && typeof onReplyTo === 'function') { onReplyTo({ id: actions.id, content: actions.content, isSent: actions.isSent }); } setActions(null); setOpenTrayAct(null); }, style: { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '8px 14px', borderRadius: '16px', cursor: 'pointer', gap: '5px', WebkitTapHighlightColor: 'transparent' } },
      React.createElement(LucideReply, { size: 20, color: 'rgba(255,255,255,0.8)' }),
      React.createElement('span', { style: { fontSize: '10px', color: 'rgba(255,255,255,0.5)', fontWeight: '600' } }, 'Reply')
    ),
    React.createElement('div', { onClick: function(e) { e.stopPropagation(); if (actions && actions.content) { try { if (navigator && navigator.clipboard) navigator.clipboard.writeText(actions.content); } catch(err) {} } setActions(null); setOpenTrayAct(null); }, style: { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '8px 14px', borderRadius: '16px', cursor: 'pointer', gap: '5px', WebkitTapHighlightColor: 'transparent' } },
      React.createElement(LucideCopy, { size: 20, color: 'rgba(255,255,255,0.8)' }),
      React.createElement('span', { style: { fontSize: '10px', color: 'rgba(255,255,255,0.5)', fontWeight: '600' } }, 'Copy')
    ),
    actions && actions.isSent ? React.createElement('div', { onClick: function(e) { e.stopPropagation(); if (actions) { setDmDeleteTarget({ id: actions.id, preview: (actions.content || '').substring(0, 50) }); setActions(null); setOpenTrayAct(null); } }, style: { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '8px 14px', borderRadius: '16px', cursor: 'pointer', gap: '5px', WebkitTapHighlightColor: 'transparent' } },
      React.createElement(LucideTrash, { size: 20, color: '#EF4444' }),
      React.createElement('span', { style: { fontSize: '10px', color: '#EF4444', fontWeight: '600' } }, 'Delete')
    ) : null
  ),
  dmDeleteTarget ? React.createElement('div', { onClick: function() { setDmDeleteTarget(null); }, style: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.78)', display: 'flex', alignItems: 'flex-end', zIndex: 999 } },
    React.createElement('div', { onClick: function(e) { e.stopPropagation(); }, style: { width: '100%', background: '#141414', borderRadius: '24px 24px 0 0', padding: '24px 20px', paddingBottom: 'calc(env(safe-area-inset-bottom,0px) + 20px)' } },
      React.createElement('div', { style: { fontSize: '13px', color: 'rgba(255,255,255,0.4)', marginBottom: '16px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingLeft: '4px' } }, '"' + (dmDeleteTarget.preview || '') + (dmDeleteTarget.preview && dmDeleteTarget.preview.length >= 50 ? '...' : '') + '"'),
      React.createElement('div', { onClick: function() { if (typeof onDeleteMessage === 'function') onDeleteMessage(dmDeleteTarget.id); setDmDeleteTarget(null); }, style: { textAlign: 'center', padding: '13px', borderRadius: '999px', background: 'rgba(239,68,68,0.1)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.3)', fontSize: '14px', fontWeight: '600', cursor: 'pointer', marginBottom: '10px', userSelect: 'none', WebkitTapHighlightColor: 'transparent' } }, 'Delete message'),
      React.createElement('div', { onClick: function() { setDmDeleteTarget(null); }, style: { textAlign: 'center', padding: '13px', borderRadius: '999px', background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.55)', fontSize: '14px', fontWeight: '600', cursor: 'pointer', userSelect: 'none', WebkitTapHighlightColor: 'transparent' } }, 'Cancel')
    )
  ) : null,
  reactionDetail ? React.createElement('div', { onClick: function() { setReactionDetail(null); }, style: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'flex-end', zIndex: 999 } },
    React.createElement('div', { onClick: function(e) { e.stopPropagation(); }, style: { width: '100%', background: '#141414', borderRadius: '24px 24px 0 0', padding: '20px', paddingBottom: 'calc(env(safe-area-inset-bottom,0px) + 20px)', maxHeight: '65vh', overflowY: 'auto' } },
      React.createElement('div', { style: { width: '36px', height: '4px', background: 'rgba(255,255,255,0.12)', borderRadius: '2px', margin: '0 auto 18px' } }),
      React.createElement('div', { style: { fontSize: '15px', fontWeight: '700', color: '#F3F4F6', marginBottom: '16px' } }, 'Reactions'),
      (function() {
        var grp = {}; var ord = []; var rxns = (reactionDetail && reactionDetail.reactions) || [];
        for (var i = 0; i < rxns.length; i++) { var r = rxns[i]; if (!grp[r.emoji]) { grp[r.emoji] = []; ord.push(r.emoji); } grp[r.emoji].push(r); }
        return ord.map(function(emoji) {
          return React.createElement('div', { key: emoji, style: { marginBottom: '16px' } },
            React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' } },
              React.createElement('span', { style: { fontSize: '22px' } }, emoji),
              React.createElement('span', { style: { fontSize: '13px', fontWeight: '600', color: 'rgba(255,255,255,0.35)' } }, grp[emoji].length)
            ),
            grp[emoji].map(function(r, idx) {
              return React.createElement('div', { key: idx, style: { display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' } },
                React.createElement('div', { style: { width: '36px', height: '36px', borderRadius: '50%', background: '#1E3A8A', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: '700', color: '#93C5FD', flexShrink: 0 } }, (r.name || '?').charAt(0).toUpperCase()),
                React.createElement('span', { style: { fontSize: '14px', color: r.isMe ? '#60A5FA' : '#E8E8E8', fontWeight: r.isMe ? '600' : '400' } }, r.isMe ? (r.name || 'You') + ' (you)' : (r.name || 'Unknown'))
              );
            })
          );
        });
      })()
    )
  ) : null
  );
}`;

export const DEFAULT_ATTACHBUTTON_SOURCE = `function Component() {
  return React.createElement('button', {
    onClick: function() { onAttach && onAttach(); },
    style: { width: '44px', height: '44px', borderRadius: '50%', background: '#1E1E1E', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px', flexShrink: 0 }
  }, '+');
}`;

export const DEFAULT_SENDBUTTON_SOURCE = `function Component() {
  return React.createElement('button', {
    onClick: function() { onSend && onSend(); },
    style: { width: '44px', height: '44px', borderRadius: '50%', background: '#2563EB', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }
  }, React.createElement(Icon, { name: 'arrow-right', size: 20, color: '#fff' }));
}`;

export const DEFAULT_EMPTYSTATE_SOURCE = `function Component() {
  return React.createElement('div', { style: { display: 'flex', flex: 1, flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '16px' } },
    React.createElement('div', { style: { color: 'rgba(255, 255, 255, 0.6)', fontSize: '18px', fontWeight: '500', marginBottom: '4px' } }, 'No chats yet'),
    React.createElement('div', { style: { color: 'rgba(255, 255, 255, 0.4)', fontSize: '14px' } }, 'Search for friends and start chatting')
  );
}`;

export const DEFAULT_REPLYPREVIEW_SOURCE = `function Component() {
  var replyingToState = useComponentState('replyingTo', null);
  var replyingTo = replyingToState[0];
  if (!replyingTo) {
    return null;
  }
  return React.createElement('div', {
    style: { display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '8px', padding: '8px 16px', borderLeft: '3px solid #2563EB', background: '#1A1A1A' }
  },
    React.createElement('div', {
      style: { flex: 1, minWidth: 0 }
    },
      React.createElement('div', {
        style: { fontSize: '12px', fontWeight: '600', color: '#2563EB' }
      }, 'Replying to ' + replyingTo.senderLabel),
      React.createElement('div', {
        style: { fontSize: '12px', color: 'rgba(255,255,255,0.6)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }
      }, replyingTo.content)
    ),
    React.createElement('div', {
      onClick: function() { if (typeof onCancelReply === 'function') { onCancelReply(); } },
      style: { fontSize: '16px', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', padding: '4px', userSelect: 'none', WebkitTapHighlightColor: 'transparent' }
    }, String.fromCharCode(10005))
  );
}`;

export const DEFAULT_REPLYQUOTE_SOURCE = `function Component() {
  if (!replyTo) {
    return null;
  }
  return React.createElement('div', {
    onClick: function(e) {
      if (e && typeof e.stopPropagation === 'function') { e.stopPropagation(); }
      if (typeof onJumpToReply === 'function' && replyTo.id) {
        onJumpToReply(replyTo.id);
      }
    },
    style: {
      borderLeft: '3px solid rgba(255,255,255,0.4)',
      paddingLeft: '8px',
      marginBottom: '6px',
      opacity: 0.85,
      cursor: 'pointer',
      userSelect: 'none',
      WebkitUserSelect: 'none',
      WebkitTapHighlightColor: 'transparent',
    }
  },
    React.createElement('div', {
      style: { fontSize: '12px', fontWeight: '600', color: isSent ? '#F0F0F0' : '#E8E8E8' }
    }, replyTo.senderLabel),
    React.createElement('div', {
      style: { fontSize: '12px', color: isSent ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.55)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }
    }, replyTo.content)
  );
}`;

export const DEFAULT_MESSAGEREACTIONS_SOURCE = `function Component() {
  var reactionsState = useComponentState('reactions:' + messageId, []);
  var reactions = reactionsState[0];
  var liveUidState = useComponentState('currentUserId', null);
  var liveUid = liveUidState[0] || currentUserId;
  var openTrayState = useComponentState('openReactionMessageId', null);
  var trayOpen = openTrayState[0] === messageId;
  var setOpenTray = openTrayState[1];
  var actionsState = useComponentState('activeMessageActions', null);
  var setActions = actionsState[1];
  var emojiList = ['👍', '❤️', '😂', '😮', '😢', '🙏'];
  var grouped = {}; var reactionsList = reactions || [];
  for (var i = 0; i < reactionsList.length; i++) {
    var r = reactionsList[i];
    if (!grouped[r.emoji]) grouped[r.emoji] = { count: 0, mine: false };
    grouped[r.emoji].count++;
    if (r.user_id === liveUid) grouped[r.emoji].mine = true;
  }
  if (trayOpen) {
    return React.createElement('div', { style: { marginTop: '5px', display: 'flex', alignItems: 'center', gap: '3px', background: 'rgba(0,0,0,0.5)', borderRadius: '16px', padding: '4px 6px', border: '1px solid rgba(255,255,255,0.12)', overflowX: 'auto', WebkitOverflowScrolling: 'touch', maxWidth: '100%', alignSelf: 'flex-start', scrollbarWidth: 'none', msOverflowStyle: 'none' } },
      emojiList.map(function(emoji) {
        var g = grouped[emoji]; var isSel = g && g.mine; var cnt = g ? g.count : 0;
        return React.createElement('div', { key: emoji, onClick: function(e) { e.stopPropagation(); if (typeof onToggleReaction === 'function') onToggleReaction(messageId, emoji); setOpenTray(null); setActions(null); }, style: { display: 'inline-flex', alignItems: 'center', gap: '3px', padding: '4px 7px', borderRadius: '11px', cursor: 'pointer', userSelect: 'none', WebkitTapHighlightColor: 'transparent', background: isSel ? 'rgba(37,99,235,0.4)' : 'transparent', border: isSel ? '1px solid rgba(37,99,235,0.8)' : '1px solid transparent', flexShrink: 0 } },
          React.createElement('span', { style: { fontSize: '18px', lineHeight: '1' } }, emoji),
          cnt > 0 ? React.createElement('span', { style: { fontSize: '11px', fontWeight: '700', color: isSel ? '#93C5FD' : 'rgba(255,255,255,0.6)' } }, cnt) : null
        );
      })
    );
  }
  if (reactionsList.length === 0) return null;
  var emojiSet = []; var hasMine = false;
  for (var j = 0; j < reactionsList.length; j++) { if (emojiSet.indexOf(reactionsList[j].emoji) === -1) emojiSet.push(reactionsList[j].emoji); if (reactionsList[j].user_id === liveUid) hasMine = true; }
  return React.createElement('div', {
    onClick: function(e) { e.stopPropagation(); if (typeof onShowReactors === 'function') onShowReactors(messageId); },
    style: { display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '3px 9px 3px 7px', borderRadius: '12px', marginTop: '5px', alignSelf: 'flex-start', cursor: 'pointer', userSelect: 'none', WebkitTapHighlightColor: 'transparent', background: hasMine ? 'rgba(37,99,235,0.25)' : 'rgba(0,0,0,0.5)', border: hasMine ? '1px solid rgba(37,99,235,0.6)' : '1px solid rgba(255,255,255,0.1)' }
  },
    React.createElement('div', { style: { display: 'inline-flex', alignItems: 'center', gap: '1px' } },
      emojiSet.map(function(emoji) { return React.createElement('span', { key: emoji, style: { fontSize: '14px', lineHeight: '1.2' } }, emoji); })
    ),
    React.createElement('span', { style: { fontSize: '12px', fontWeight: '700', color: hasMine ? '#93C5FD' : 'rgba(255,255,255,0.6)' } }, reactionsList.length)
  );
}`;

export const DEFAULT_REACTIONPICKER_SOURCE = `function Component() {
  var openTrayState = useComponentState('openReactionMessageId', null);
  var trayOpen = openTrayState[0] === messageId;
  var setOpenTray = openTrayState[1];
  var setActionsState = useComponentState('activeMessageActions', null);
  var setActions = setActionsState[1];
  var emojiList = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

  var buttons = emojiList.map(function(emoji) {
    return React.createElement('div', {
      key: emoji,
      onClick: function(e) {
        if (e && typeof e.stopPropagation === 'function') { e.stopPropagation(); }
        if (typeof onToggleReaction === 'function') {
          onToggleReaction(messageId, emoji);
        }
        setOpenTray(null); setActions(null);
      },
      style: { fontSize: '17px', cursor: 'pointer', padding: '2px 3px', userSelect: 'none', WebkitUserSelect: 'none', WebkitTapHighlightColor: 'transparent' }
    }, emoji);
  });

  buttons.push(React.createElement('div', {
    key: 'close',
    onClick: function(e) {
      if (e && typeof e.stopPropagation === 'function') { e.stopPropagation(); }
      setOpenTray(null); setActions(null);
    },
    style: { fontSize: '12px', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', padding: '2px 4px', userSelect: 'none', WebkitUserSelect: 'none', WebkitTapHighlightColor: 'transparent' }
  }, String.fromCharCode(10005)));

  return React.createElement('div', {
    style: {
      maxWidth: trayOpen ? '230px' : '0px',
      opacity: trayOpen ? 1 : 0,
      overflow: 'hidden',
      transition: 'max-width 0.25s ease, opacity 0.2s ease',
      position: 'relative',
      zIndex: trayOpen ? 200 : 'auto',
    }
  },
    React.createElement('div', {
      style: {
        display: 'flex', alignItems: 'center', gap: '4px',
        background: '#1A1A1A', borderRadius: '14px', padding: '3px 6px',
        border: '1px solid rgba(255,255,255,0.15)',
        whiteSpace: 'nowrap',
      }
    }, buttons)
  );
}`;

export const DEFAULT_COMPOSERBAR_SOURCE = `function Component() {
  var inp = React.useState('');
  var inputText = inp[0], setInputText = inp[1];
  
  var onSend = function() {
    if (inputText && inputText.trim() && sendMessage) {
      sendMessage(inputText.trim());
      setInputText('');
    }
  };
  
  return React.createElement('div', {
    style: { display: 'flex', flexDirection: 'column', background: '#141414', borderTop: '1px solid #1F1F1F', flexShrink: 0 }
  },
    React.createElement(ReplyPreview, { onCancelReply: onCancelReply }),
    React.createElement('div', {
      style: { display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '10px', padding: '12px 16px', paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 12px)' }
    },
      React.createElement(AttachButton, { onAttach: onAttach }),
      React.createElement('input', {
        type: 'text', value: inputText, onChange: function(e) { setInputText(e.target.value); if (typeof onTyping === 'function') { onTyping(); } },
        onKeyDown: function(e) {
          if (e.key === 'Enter') {
            onSend();
          }
        },
        placeholder: 'message...',
        style: { flex: 1, background: '#1E1E1E', borderRadius: '24px', padding: '10px 16px', fontSize: '15px', color: '#E8E8E8', border: 'none', outline: 'none', minWidth: 0 }
      }),
      React.createElement(SendButton, { onSend: onSend })
    )
  );
}`;

export const DEFAULT_BACKBUTTON_SOURCE = `function Component() {
  return React.createElement('button', {
    onClick: function() { onBack && onBack(); },
    style: { background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', marginLeft: '-8px' }
  }, React.createElement(Icon, { name: 'chevron-left', size: 24, color: '#E8E8E8' }));
}`;

export const DEFAULT_PROFILEIMAGE_SOURCE = `function Component() {
  var s = (typeof size === 'number' && size > 0) ? size : 40;
  var fontSize = Math.round(s * 0.4);
  return avatarUrl
    ? React.createElement('img', { src: avatarUrl, style: { width: s + 'px', height: s + 'px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 } })
    : React.createElement('div', {
        style: { display: 'flex', alignItems: 'center', justifyContent: 'center', width: s + 'px', height: s + 'px', borderRadius: '50%', backgroundColor: contactAvatarColor, flexShrink: 0 }
      }, React.createElement('span', { style: { fontSize: fontSize + 'px', fontWeight: '600', color: '#F3F4F6' } }, contactInitials));
}`;

export const DEFAULT_PROFILESCREEN_SOURCE = `function Component() {
  var nameState = React.useState(displayName || '');
  var nameValue = nameState[0], setNameValue = nameState[1];
  var bioState = React.useState(bio || '');
  var bioValue = bioState[0], setBioValue = bioState[1];
  var usernameState = React.useState(username || '');
  var usernameValue = usernameState[0], setUsernameValue = usernameState[1];
  var savedState = React.useState(false);
  var justSaved = savedState[0], setJustSaved = savedState[1];
  var previewState = React.useState(null);
  var previewUrl = previewState[0], setPreviewUrl = previewState[1];
  var statusState = React.useState('idle');
  var usernameStatus = statusState[0], setUsernameStatus = statusState[1];
  var fileInputRef = React.useRef(null);
  var checkTimer = React.useRef(null);
  var errorState = useComponentState('profileSaveError', null);
  var saveError = errorState[0];

  React.useEffect(function() {
    if (checkTimer.current) clearTimeout(checkTimer.current);
    var trimmed = usernameValue.toLowerCase().trim();
    if (!trimmed) { setUsernameStatus('idle'); return; }
    if (trimmed === (username || '').toLowerCase().trim()) { setUsernameStatus('current'); return; }
    if (trimmed.length < 2) { setUsernameStatus('too_short'); return; }
    setUsernameStatus('checking');
    checkTimer.current = setTimeout(function() {
      if (typeof checkUsername === 'function') {
        checkUsername(trimmed).then(function(result) { setUsernameStatus(result); });
      }
    }, 500);
    return function() { if (checkTimer.current) clearTimeout(checkTimer.current); };
  }, [usernameValue]);

  var onPickFile = function(e) {
    var file = e.target.files && e.target.files[0];
    if (!file) return;
    setPreviewUrl(URL.createObjectURL(file));
    if (typeof onChangeAvatar === 'function') { onChangeAvatar(file); }
  };

  var onSaveClick = function() {
    if (usernameStatus === 'taken') return;
    if (typeof onSave === 'function') { onSave(nameValue.trim(), bioValue.trim(), usernameValue.trim()); }
    setJustSaved(true);
    setTimeout(function() { setJustSaved(false); }, 1500);
  };

  var pill = { width: '100%', padding: '12px 18px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '999px', color: '#e8e8e8', fontSize: '13px', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', letterSpacing: '0.2px' };
  var label = { fontSize: '12px', color: 'rgba(255,255,255,0.4)', marginBottom: '6px', display: 'block', paddingLeft: '4px' };

  var statusColor = usernameStatus === 'available' ? '#22C55E' : usernameStatus === 'taken' ? '#EF4444' : usernameStatus === 'checking' ? 'rgba(255,255,255,0.35)' : 'transparent';
  var statusText = usernameStatus === 'available' ? String.fromCharCode(10003) + ' available' : usernameStatus === 'taken' ? String.fromCharCode(10005) + ' already taken' : usernameStatus === 'checking' ? 'checking...' : usernameStatus === 'too_short' ? 'too short' : '';
  var hasChanges = nameValue.trim() !== (initialDisplayName || '').trim() || bioValue.trim() !== (initialBio || '').trim() || usernameValue.toLowerCase().trim() !== (initialUsername || '').toLowerCase().trim() || previewUrl !== null;
  var isSaveActive = hasChanges && usernameStatus !== 'taken';

  return React.createElement('div', { style: { display: 'flex', flexDirection: 'column', height: '100%', background: '#0A0A0A', overflowY: 'auto' } },
    isTab ? null : React.createElement('div', { style: { display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '12px', padding: '14px 16px', borderBottom: '1px solid #1F1F1F' } },
      React.createElement(BackButton, { onBack: onBack }),
      React.createElement('div', { style: { fontSize: '17px', fontWeight: '600', color: '#F3F4F6' } }, 'Profile')
    ),
    React.createElement('div', { style: { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '28px 16px 24px' } },
      React.createElement('input', { ref: fileInputRef, type: 'file', accept: 'image/*', style: { display: 'none' }, onChange: onPickFile }),
      React.createElement('div', {
        onClick: function() { if (!uploading && fileInputRef.current) fileInputRef.current.click(); },
        style: { position: 'relative', width: '96px', height: '96px', cursor: uploading ? 'default' : 'pointer', flexShrink: 0 }
      },
        React.createElement(ProfileImage, { avatarUrl: previewUrl || avatarUrl, contactInitials: avatarInitials, contactAvatarColor: avatarColor, size: 96 }),
        uploading ? React.createElement('div', { style: { position: 'absolute', inset: 0, borderRadius: '50%', background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center' } },
          React.createElement('div', { style: { width: '22px', height: '22px', borderRadius: '50%', border: '2px solid rgba(255,255,255,0.15)', borderTopColor: '#FFF', animation: 'spin 0.7s linear infinite' } })
        ) : React.createElement('div', { style: { position: 'absolute', bottom: '0px', right: '0px', width: '28px', height: '28px', borderRadius: '50%', background: '#2563EB', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '3px solid #0A0A0A' } },
          React.createElement('span', { style: { fontSize: '13px', color: '#FFF' } }, String.fromCharCode(9998))
        )
      ),
      uploading ? React.createElement('div', { style: { fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginTop: '8px' } }, 'Uploading...') : null
    ),
    React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: '14px', padding: '0 20px' } },
      React.createElement('div', null,
        React.createElement('label', { style: label }, 'Name'),
        React.createElement('input', { type: 'text', value: nameValue, onChange: function(e) { setNameValue(e.target.value); }, style: pill, placeholder: 'Your name' })
      ),
      React.createElement('div', null,
        React.createElement('label', { style: label }, 'Username'),
        React.createElement('div', { style: { position: 'relative' } },
          React.createElement('span', { style: { position: 'absolute', left: '18px', top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.35)', fontSize: '13px', pointerEvents: 'none' } }, '@'),
          React.createElement('input', { type: 'text', value: usernameValue, onChange: function(e) { setUsernameValue(e.target.value.replace(/[^a-z0-9_.]/gi,'').toLowerCase()); }, style: Object.assign({}, pill, { paddingLeft: '28px', borderColor: usernameStatus === 'available' ? 'rgba(34,197,94,0.4)' : usernameStatus === 'taken' ? 'rgba(239,68,68,0.4)' : 'rgba(255,255,255,0.08)' }), placeholder: 'username' })
        ),
        statusText ? React.createElement('div', { style: { fontSize: '11px', color: statusColor, marginTop: '6px', paddingLeft: '4px', transition: 'color 0.2s' } }, statusText) : null,
        saveError && !statusText ? React.createElement('div', { style: { fontSize: '11px', color: '#EF4444', marginTop: '6px', paddingLeft: '4px' } }, saveError) : null
      ),
      React.createElement('div', null,
        React.createElement('label', { style: label }, 'About'),
        React.createElement('textarea', { value: bioValue, onChange: function(e) { setBioValue(e.target.value); }, style: Object.assign({}, pill, { borderRadius: '16px', minHeight: '80px', resize: 'none', lineHeight: '1.5' }), placeholder: 'A few words about yourself' })
      ),
      React.createElement('div', { onClick: isSaveActive ? onSaveClick : null, style: { textAlign: 'center', padding: '13px', borderRadius: '999px', background: !isSaveActive ? 'rgba(255,255,255,0.06)' : justSaved ? '#16A34A' : '#2563EB', color: !isSaveActive ? 'rgba(255,255,255,0.2)' : '#FFF', fontSize: '14px', fontWeight: '600', cursor: isSaveActive ? 'pointer' : 'default', userSelect: 'none', WebkitTapHighlightColor: 'transparent', transition: 'background 0.25s ease, color 0.2s ease', marginTop: '4px', border: !isSaveActive ? '1px solid rgba(255,255,255,0.07)' : 'none' } },
        justSaved ? String.fromCharCode(10003) + ' Saved' : 'Save changes'
      )
    ),
    React.createElement('div', { onClick: function() { if (typeof onOpenSettings === 'function') onOpenSettings(); }, style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', marginTop: '32px', marginBottom: '24px', cursor: 'pointer', userSelect: 'none', WebkitTapHighlightColor: 'transparent', borderTop: '1px solid #1f1f1f', borderBottom: '1px solid #1f1f1f' } },
      React.createElement('span', { style: { fontSize: '15px', color: '#FFF', fontWeight: '500' } }, 'Settings'),
      React.createElement('span', { style: { fontSize: '20px', color: '#666', lineHeight: '1' } }, String.fromCharCode(8250))
    )
  );
}`;

export const DEFAULT_CONTACTPROFILESCREEN_SOURCE = `function Component() {
  var profileState = useComponentState('contactProfileData', null);
  var profileData = profileState[0];
  var mutualState = useComponentState('contactMutualCommunities', []);
  var mutualCommunities = mutualState[0];
  var nameToShow = (profileData && profileData.display_name) || displayName || 'Unknown';
  var usernameToShow = (profileData && profileData.username) || username || null;
  var bioToShow = (profileData && profileData.bio) || null;
  var isOnlineToShow = profileData ? (profileData.is_online || false) : (isOnline || false);
  var avatarToShow = (profileData && profileData.avatar_url) || avatarUrl || null;
  return React.createElement('div', { style: { display: 'flex', flexDirection: 'column', height: '100%', background: '#0A0A0A', overflowY: 'auto' } },
    React.createElement('div', { style: { display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '12px', padding: '14px 16px', borderBottom: '1px solid #1F1F1F' } },
      React.createElement(BackButton, { onBack: onBack }),
      React.createElement('div', { style: { fontSize: '17px', fontWeight: '600', color: '#F3F4F6' } }, 'Profile')
    ),
    React.createElement('div', { style: { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '36px 20px 20px', gap: '6px' } },
      React.createElement('div', { style: { position: 'relative', marginBottom: '8px' } },
        React.createElement(ProfileImage, { avatarUrl: avatarToShow, contactInitials: (nameToShow || '?').charAt(0).toUpperCase(), contactAvatarColor: '#2563EB', size: 96 }),
        isOnlineToShow ? React.createElement('div', { style: { position: 'absolute', bottom: '4px', right: '4px', width: '14px', height: '14px', borderRadius: '50%', background: '#22C55E', border: '2px solid #0A0A0A' } }) : null
      ),
      React.createElement('div', { style: { fontSize: '22px', fontWeight: '700', color: '#F3F4F6' } }, nameToShow),
      usernameToShow ? React.createElement('div', { style: { fontSize: '14px', color: 'rgba(255,255,255,0.4)' } }, '@' + usernameToShow) : null,
      isOnlineToShow ? React.createElement('div', { style: { fontSize: '12px', color: '#22C55E', fontWeight: '500', marginTop: '2px' } }, 'online') : null
    ),
    React.createElement('div', { style: { padding: '0 20px 16px', display: 'flex', gap: '10px' } },
      React.createElement('div', {
        onClick: function() { if (typeof onStartChat === 'function') onStartChat(); },
        style: { flex: 1, textAlign: 'center', padding: '11px', borderRadius: '999px', background: '#2563EB', color: '#FFF', fontSize: '14px', fontWeight: '600', cursor: 'pointer', userSelect: 'none', WebkitTapHighlightColor: 'transparent' }
      }, 'Message')
    ),
    React.createElement('div', { style: { padding: '0 20px 20px', display: 'flex', gap: '10px' } },
      React.createElement('div', {
        onClick: function() { if (typeof onBlockClick === 'function') onBlockClick(); },
        style: { flex: 1, textAlign: 'center', padding: '11px', borderRadius: '999px', background: 'transparent', border: '1px solid #3a1212', color: '#EF4444', fontSize: '14px', fontWeight: '600', cursor: 'pointer', userSelect: 'none', WebkitTapHighlightColor: 'transparent' }
      }, 'Block'),
      React.createElement('div', {
        onClick: function() { if (typeof onReportClick === 'function') onReportClick(); },
        style: { flex: 1, textAlign: 'center', padding: '11px', borderRadius: '999px', background: 'transparent', border: '1px solid #2a2a2a', color: '#9CA3AF', fontSize: '14px', fontWeight: '600', cursor: 'pointer', userSelect: 'none', WebkitTapHighlightColor: 'transparent' }
      }, 'Report')
    ),
    bioToShow ? React.createElement('div', { style: { margin: '0 20px 16px', padding: '16px 18px', background: 'rgba(255,255,255,0.03)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.06)' } },
      React.createElement('div', { style: { fontSize: '11px', color: 'rgba(255,255,255,0.35)', marginBottom: '6px', fontWeight: '600', letterSpacing: '0.6px' } }, 'ABOUT'),
      React.createElement('div', { style: { fontSize: '14px', color: 'rgba(255,255,255,0.75)', lineHeight: '1.6' } }, bioToShow)
    ) : null,
    mutualCommunities && mutualCommunities.length > 0 ? React.createElement('div', { style: { margin: '0 20px 24px', padding: '16px 18px', background: 'rgba(255,255,255,0.03)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.06)' } },
      React.createElement('div', { style: { fontSize: '11px', color: 'rgba(255,255,255,0.35)', marginBottom: '12px', fontWeight: '600', letterSpacing: '0.6px' } }, mutualCommunities.length + (mutualCommunities.length === 1 ? ' community in common' : ' communities in common')),
      mutualCommunities.map(function(comm) {
        if (!comm) return null;
        return React.createElement('div', { key: comm.id, onClick: function() { if (typeof onOpenCommunity === 'function') onOpenCommunity(comm.id, comm.name, comm.type || 'public', comm.member_count || 0, comm.avatar_url || null); }, style: { display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '10px', marginBottom: '8px', cursor: 'pointer', WebkitTapHighlightColor: 'transparent' } },
          React.createElement('div', { style: { width: '36px', height: '36px', borderRadius: '10px', background: '#1A1A1A', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 } },
            comm.avatar_url ? React.createElement('img', { src: comm.avatar_url, style: { width: '100%', height: '100%', objectFit: 'cover' } }) : React.createElement('span', { style: { fontSize: '14px', fontWeight: '700', color: '#E8E8E8' } }, (comm.name || '?').charAt(0).toUpperCase())
          ),
          React.createElement('div', { style: { fontSize: '14px', fontWeight: '500', color: '#E8E8E8' } }, comm.name)
        );
      })
    ) : null
  );
}`;

export const DEFAULT_COMMUNITYMESSAGEBUBBLE_SOURCE = `function Component() {
  var pressTimerRef = React.useRef(null);
  var hlState = useComponentState('highlightedMessageId', null);
  var isHighlighted = hlState[0] === id;
  var deleteTargetState = useComponentState('communityDeleteTarget', null);
  var setDeleteTarget = deleteTargetState[1];
  var activeActionsState = useComponentState('activeMessageActions', null);
  var setActiveActions = activeActionsState[1];
  var communityOpenTrayState = useComponentState('openReactionMessageId', null);
  var setCommunityOpenTray = communityOpenTrayState[1];
  if (isDeleted) {
    return React.createElement('div', { id: 'msg-' + id, style: { width: '100%', display: 'flex', flexDirection: 'row', padding: '2px 16px', justifyContent: isMine ? 'flex-end' : 'flex-start', alignItems: 'center', gap: '8px' } },
      !isMine ? React.createElement('div', { style: { width: '28px', flexShrink: 0 } }) : null,
      React.createElement('div', { style: { padding: '8px 12px', borderRadius: '14px', background: isMine ? 'rgba(37,99,235,0.18)' : 'rgba(255,255,255,0.04)', border: isMine ? '1px solid rgba(37,99,235,0.25)' : '1px solid rgba(255,255,255,0.07)' } },
        React.createElement('span', { style: { fontSize: '13px', color: isMine ? 'rgba(147,197,253,0.55)' : 'rgba(255,255,255,0.28)', fontStyle: 'italic' } }, 'This message was deleted')
      )
    );
  }
  return React.createElement('div', {
    id: 'msg-' + id,
    onPointerDown: function() { pressTimerRef.current = setTimeout(function() { if (typeof setActiveActions === 'function') setActiveActions({ id: id, isMine: isMine, content: content, senderName: senderName }); if (typeof setCommunityOpenTray === 'function') setCommunityOpenTray(id); }, 600); },
    onPointerUp: function() { if (pressTimerRef.current) { clearTimeout(pressTimerRef.current); pressTimerRef.current = null; } },
    onPointerLeave: function() { if (pressTimerRef.current) { clearTimeout(pressTimerRef.current); pressTimerRef.current = null; } },
    onPointerCancel: function() { if (pressTimerRef.current) { clearTimeout(pressTimerRef.current); pressTimerRef.current = null; } },
    style: { width: '100%', display: 'flex', flexDirection: 'row', padding: '2px 16px', justifyContent: isMine ? 'flex-end' : 'flex-start', alignItems: 'flex-end', gap: '8px', backgroundColor: isHighlighted ? 'rgba(255,255,255,0.07)' : 'transparent', transition: 'background-color 0.4s ease' }
  },
    !isMine ? React.createElement('div', { onClick: function() { if (typeof onSenderTap === 'function') onSenderTap(senderId, senderName, senderAvatar); }, style: { flexShrink: 0, cursor: 'pointer', WebkitTapHighlightColor: 'transparent' } }, React.createElement(ProfileImage, { avatarUrl: senderAvatar, contactInitials: senderInitials, contactAvatarColor: '#2563EB', size: 28 })) : null,
    React.createElement('div', { style: { display: 'flex', flexDirection: 'column', maxWidth: '72%' } },
      !isMine ? React.createElement('div', { onClick: function() { if (typeof onSenderTap === 'function') onSenderTap(senderId, senderName, senderAvatar); }, style: { fontSize: '11px', fontWeight: '600', color: '#60A5FA', marginBottom: '3px', paddingLeft: '2px', cursor: 'pointer', WebkitTapHighlightColor: 'transparent' } }, senderName) : null,
      React.createElement('div', { style: { padding: '8px 12px', borderRadius: '16px', borderBottomRightRadius: isMine ? '3px' : '16px', borderBottomLeftRadius: isMine ? '16px' : '3px', background: isMine ? '#2563EB' : '#1E1E1E' } },
        replyToData ? React.createElement('div', { onClick: function() { if (replyToData.id && typeof onJumpToReply === 'function') onJumpToReply(replyToData.id); }, style: { borderLeft: '3px solid ' + (isMine ? 'rgba(255,255,255,0.5)' : '#2563EB'), paddingLeft: '8px', marginBottom: '5px', cursor: replyToData.id ? 'pointer' : 'default', WebkitTapHighlightColor: 'transparent' } },
          React.createElement('div', { style: { fontSize: '11px', fontWeight: '600', color: isMine ? 'rgba(255,255,255,0.9)' : '#60A5FA', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, replyToData.senderName || ''),
          React.createElement('div', { style: { fontSize: '12px', color: isMine ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.45)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '200px' } }, replyToData.content || '')
        ) : null,
        React.createElement('div', { style: { fontSize: '14px', lineHeight: '1.45', color: isMine ? '#F0F0F0' : '#E8E8E8', wordBreak: 'break-word' } }, content),
        React.createElement(MessageReactions, { messageId: id, currentUserId: currentUserId, onToggleReaction: onToggleReaction, onShowReactors: onShowReactors }),
        React.createElement('div', { style: { display: 'flex', flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: '6px', marginTop: '2px' } },
          React.createElement('div', { style: { fontSize: '10px', color: isMine ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.35)' } }, timestamp)
        )
      )
    )
  );
}`;

export const DEFAULT_COMMUNITYLISTSCREEN_SOURCE = `function Component() {
  var listState = useComponentState('communityList', []);
  var communities = listState[0];
  var communityTypingMapState = useComponentState('communityTypingMap', {});
  var communityTypingMap = communityTypingMapState[0];
  var sqState = useComponentState('searchQuery', ''); var searchText = sqState[0];
  var communitiesWithTyping = (communities || []).map(function(c) { return Object.assign({}, c, { _typingText: communityTypingMap && communityTypingMap[c.id] ? communityTypingMap[c.id] : null }); });
  var filtered = searchText.trim() ? communitiesWithTyping.filter(function(c) { var q = searchText.toLowerCase(); return (c.name || '').toLowerCase().includes(q) || (c.description || '').toLowerCase().includes(q); }) : communitiesWithTyping;
  var typeBadge = function(t) {
    var color = t === 'public' ? '#22C55E' : t === 'protected' ? '#EAB308' : '#EF4444';
    var bg = t === 'public' ? 'rgba(34,197,94,0.1)' : t === 'protected' ? 'rgba(234,179,8,0.1)' : 'rgba(239,68,68,0.1)';
    var label = t === 'public' ? 'Public' : t === 'protected' ? 'Protected' : 'Private';
    return React.createElement('span', { style: { fontSize: '9px', fontWeight: '700', padding: '2px 5px', borderRadius: '4px', background: bg, color: color, letterSpacing: '0.3px', flexShrink: 0 } }, label);
  };
  var fmtTime = function(iso) {
    if (!iso) return '';
    var d = new Date(iso), now = new Date(), diff = now - d;
    if (diff < 86400000) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (diff < 604800000) { var days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']; return days[d.getDay()]; }
    return (d.getMonth()+1) + '/' + d.getDate();
  };
  return React.createElement('div', { style: { display: 'flex', flexDirection: 'column', height: '100%', background: '#0A0A0A' } },
    hideHeader ? null : React.createElement('div', { style: { display: 'flex', flexDirection: 'row', alignItems: 'center', padding: '14px 16px', borderBottom: '1px solid #1F1F1F', background: '#141414', flexShrink: 0, gap: '12px' } },
      React.createElement(BackButton, { onBack: onBack }),
      React.createElement('div', { style: { flex: 1, fontSize: '17px', fontWeight: '600', color: '#F3F4F6' } }, 'Communities'),
      React.createElement('div', { onClick: function() { if (typeof onCreateCommunity === 'function') onCreateCommunity(); }, style: { width: '36px', height: '36px', borderRadius: '50%', background: '#2563EB', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '20px', color: '#FFF', userSelect: 'none', WebkitTapHighlightColor: 'transparent', flexShrink: 0 } }, '+')
    ),
    filtered.length === 0 ? React.createElement('div', { style: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px', color: 'rgba(255,255,255,0.3)', padding: '32px', textAlign: 'center' } },
      React.createElement('div', { style: { fontSize: '40px' } }, String.fromCharCode(128101)),
      React.createElement('div', { style: { fontSize: '16px', fontWeight: '600' } }, searchText.trim() ? 'No results' : 'No communities yet'),
      React.createElement('div', { style: { fontSize: '13px' } }, searchText.trim() ? 'Try a different search' : 'Tap + to create or find one')
    ) : React.createElement('div', { style: { flex: 1, overflowY: 'auto' } },
      filtered.map(function(c) {
        var joinState = c.joinState || 'idle';
        var isLoading = joinState === 'loading';
        var isDone = joinState === 'joined' || joinState === 'requested';
        var showBtn = !c.isMember && c.type !== 'private';
        var btnLabel = isLoading ? '...' : joinState === 'joined' ? String.fromCharCode(10003) + ' Joined' : joinState === 'requested' ? 'Requested' : c.type === 'protected' ? 'Request' : 'Join';
        var hasLastMsg = c.isMember && c.last_message;
        return React.createElement('div', { key: c.id, onClick: function() { if (c.type === 'protected' && !c.isMember) { if (typeof onOpenCommunityProfile === 'function') onOpenCommunityProfile(c); } else { if (typeof onOpenCommunity === 'function') onOpenCommunity(c); } }, style: { display: 'flex', flexDirection: 'row', alignItems: 'center', padding: '12px 16px', gap: '12px', cursor: 'pointer', WebkitTapHighlightColor: 'transparent', borderBottom: '1px solid rgba(255,255,255,0.04)', minHeight: '72px' } },
          React.createElement('div', { onClick: function(e) { e.stopPropagation(); if (typeof onAvatarTap === 'function') onAvatarTap(c); }, style: { width: '50px', height: '50px', borderRadius: '14px', background: '#1A1A1A', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', fontWeight: '700', color: '#E8E8E8', overflow: 'hidden', cursor: 'pointer', WebkitTapHighlightColor: 'transparent' } },
            c.avatar_url ? React.createElement('img', { src: c.avatar_url, style: { width: '100%', height: '100%', objectFit: 'cover' } }) : (c.name || '?').charAt(0).toUpperCase()
          ),
          React.createElement('div', { style: { flex: 1, minWidth: 0 } },
            React.createElement('div', { style: { display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2px' } },
              React.createElement('div', { style: { display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '6px', flex: 1, minWidth: 0 } },
                React.createElement('div', { style: { fontSize: '15px', fontWeight: '600', color: '#F3F4F6', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 } }, c.name),
                typeBadge(c.type)
              ),
              hasLastMsg ? React.createElement('div', { style: { fontSize: '11px', color: 'rgba(255,255,255,0.35)', flexShrink: 0, marginLeft: '8px' } }, fmtTime(c.last_message.created_at)) : null
            ),
            c._typingText ? React.createElement('div', { style: { fontSize: '13px', color: '#60A5FA', fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, c._typingText) : hasLastMsg ? React.createElement('div', { style: { fontSize: '13px', color: 'rgba(255,255,255,0.45)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, (c.last_message.sender_name ? c.last_message.sender_name + ': ' : '') + (c.last_message.content || '')) : null,
            !hasLastMsg && !c._typingText ? (!c.isMember && c.description ? React.createElement('div', { style: { fontSize: '13px', color: 'rgba(255,255,255,0.4)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, c.description) : React.createElement('div', { style: { fontSize: '12px', color: 'rgba(255,255,255,0.28)' } }, (c.member_count || 0) + ' members')) : null
          ),
          showBtn ? React.createElement('div', { onClick: function(e) { if (e && e.stopPropagation) e.stopPropagation(); if (isLoading || isDone) return; if (c.type === 'protected') { if (typeof onRequestCommunity === 'function') onRequestCommunity(c.id); } else { if (typeof onJoinCommunity === 'function') onJoinCommunity(c.id); } }, style: { padding: '6px 14px', borderRadius: '999px', fontSize: '12px', fontWeight: '600', cursor: isLoading ? 'default' : 'pointer', flexShrink: 0, background: joinState === 'joined' ? '#16A34A' : '#2563EB', color: '#FFF', border: 'none', userSelect: 'none', WebkitTapHighlightColor: 'transparent', opacity: isLoading ? 0.7 : 1, minWidth: '60px', textAlign: 'center', transition: 'background 0.2s ease' } }, btnLabel) : null,
          (c.unreadCount && c.unreadCount > 0) ? React.createElement('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: '20px', height: '20px', borderRadius: '9999px', background: '#3B82F6', padding: '0 6px', color: '#FFFFFF', fontSize: '11px', fontWeight: '700', flexShrink: 0 } }, c.unreadCount > 99 ? '99+' : String(c.unreadCount)) : null
        );
      })
    )
  );
}`;

export const DEFAULT_CREATECOMMUNITYSCREEN_SOURCE = `function Component() {
  var nameState = React.useState(''); var nameValue = nameState[0], setNameValue = nameState[1];
  var descState = React.useState(''); var descValue = descState[0], setDescValue = descState[1];
  var typeState = React.useState('public'); var typeValue = typeState[0], setTypeValue = typeState[1];
  var loadingState = React.useState(false); var isLoading = loadingState[0], setIsLoading = loadingState[1];
  var previewState = React.useState(null); var previewUrl = previewState[0], setPreviewUrl = previewState[1];
  var fileInputRef = React.useRef(null);
  var errorState = useComponentState('createCommunityError', null); var createError = errorState[0];
  var pill = { width: '100%', padding: '12px 18px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '999px', color: '#e8e8e8', fontSize: '13px', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', letterSpacing: '0.2px' };
  var label = { fontSize: '12px', color: 'rgba(255,255,255,0.4)', marginBottom: '6px', display: 'block', paddingLeft: '4px' };
  var types = [{ value: 'public', label: 'Public', desc: 'Anyone can find and join' }, { value: 'protected', label: 'Protected', desc: 'Anyone can find, join to see messages' }, { value: 'private', label: 'Private', desc: 'Invite only' }];
  var onPickFile = function(e) { var file = e.target.files && e.target.files[0]; if (!file) return; setPreviewUrl(URL.createObjectURL(file)); if (typeof onPickImage === 'function') onPickImage(file); };
  var onSubmit = function() { if (!nameValue.trim() || isLoading) return; setIsLoading(true); if (typeof onCreate === 'function') onCreate(nameValue.trim(), descValue.trim(), typeValue); };
  return React.createElement('div', { style: { display: 'flex', flexDirection: 'column', height: '100%', background: '#0A0A0A', overflowY: 'auto' } },
    React.createElement('div', { style: { display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '12px', padding: '14px 16px', borderBottom: '1px solid #1F1F1F', background: '#141414' } },
      React.createElement(BackButton, { onBack: onBack }),
      React.createElement('div', { style: { fontSize: '17px', fontWeight: '600', color: '#F3F4F6' } }, 'New Community')
    ),
    React.createElement('div', { style: { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '28px 16px 20px' } },
      React.createElement('input', { ref: fileInputRef, type: 'file', accept: 'image/*', style: { display: 'none' }, onChange: onPickFile }),
      React.createElement('div', { onClick: function() { if (fileInputRef.current) fileInputRef.current.click(); }, style: { width: '96px', height: '96px', borderRadius: '24px', background: previewUrl ? 'transparent' : '#1A1A1A', border: previewUrl ? 'none' : '2px dashed rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', overflow: 'hidden', position: 'relative', flexShrink: 0, WebkitTapHighlightColor: 'transparent' } },
        previewUrl ? React.createElement('img', { src: previewUrl, style: { width: '100%', height: '100%', objectFit: 'cover' } })
          : React.createElement('div', { style: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', color: 'rgba(255,255,255,0.3)' } },
              React.createElement('div', { style: { fontSize: '28px' } }, String.fromCharCode(128247)),
              React.createElement('div', { style: { fontSize: '10px' } }, 'Photo')
            ),
        previewUrl ? React.createElement('div', { style: { position: 'absolute', bottom: '4px', right: '4px', width: '22px', height: '22px', borderRadius: '50%', background: '#2563EB', display: 'flex', alignItems: 'center', justifyContent: 'center' } }, React.createElement('span', { style: { fontSize: '11px', color: '#FFF' } }, String.fromCharCode(9998))) : null
      ),
      React.createElement('div', { style: { fontSize: '12px', color: 'rgba(255,255,255,0.3)', marginTop: '8px' } }, 'Community photo')
    ),
    React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: '20px', padding: '0 20px 32px' } },
      React.createElement('div', null, React.createElement('label', { style: label }, 'Name'), React.createElement('input', { type: 'text', value: nameValue, onChange: function(e) { setNameValue(e.target.value); }, style: pill, placeholder: 'Community name', maxLength: 50 })),
      React.createElement('div', null, React.createElement('label', { style: label }, 'Description'), React.createElement('textarea', { value: descValue, onChange: function(e) { setDescValue(e.target.value); }, style: Object.assign({}, pill, { borderRadius: '16px', minHeight: '70px', resize: 'none', lineHeight: '1.5' }), placeholder: 'What is this community about?' })),
      React.createElement('div', null,
        React.createElement('label', { style: label }, 'Type'),
        React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: '8px' } },
          types.map(function(t) {
            var sel = typeValue === t.value;
            return React.createElement('div', { key: t.value, onClick: function() { setTypeValue(t.value); }, style: { display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '12px', padding: '12px 16px', borderRadius: '14px', border: sel ? '1px solid rgba(37,99,235,0.7)' : '1px solid rgba(255,255,255,0.07)', background: sel ? 'rgba(37,99,235,0.1)' : 'rgba(255,255,255,0.02)', cursor: 'pointer', userSelect: 'none', WebkitTapHighlightColor: 'transparent' } },
              React.createElement('div', { style: { width: '18px', height: '18px', borderRadius: '50%', border: sel ? '5px solid #2563EB' : '2px solid rgba(255,255,255,0.2)', flexShrink: 0 } }),
              React.createElement('div', null, React.createElement('div', { style: { fontSize: '14px', fontWeight: '600', color: '#F3F4F6' } }, t.label), React.createElement('div', { style: { fontSize: '12px', color: 'rgba(255,255,255,0.4)' } }, t.desc))
            );
          })
        )
      ),
      createError ? React.createElement('div', { style: { fontSize: '12px', color: '#EF4444', paddingLeft: '4px' } }, createError) : null,
      React.createElement('div', { onClick: onSubmit, style: { textAlign: 'center', padding: '13px', borderRadius: '999px', background: !nameValue.trim() || isLoading ? 'rgba(255,255,255,0.08)' : '#2563EB', color: !nameValue.trim() || isLoading ? 'rgba(255,255,255,0.3)' : '#FFF', fontSize: '14px', fontWeight: '600', cursor: !nameValue.trim() || isLoading ? 'not-allowed' : 'pointer', userSelect: 'none', WebkitTapHighlightColor: 'transparent', transition: 'background 0.2s ease' } }, isLoading ? 'Creating...' : 'Create Community')
    )
  );
}`;

export const DEFAULT_COMMUNITYCHATSCREEN_SOURCE = `function Component() {
  var msgsState = useComponentState('communityMessages', []);
  var messages = msgsState[0];
  var inputState = React.useState(''); var inputValue = inputState[0], setInputValue = inputState[1];
  var joinStatusState = useComponentState('communityJoinStatus', 'non-member');
  var joinStatus = joinStatusState[0];
  var typingUsersState = useComponentState('communityTypingUsers', []);
  var typingUsers = typingUsersState[0];
  var deleteTargetState = useComponentState('communityDeleteTarget', null); var deleteTarget = deleteTargetState[0]; var setDeleteTarget = deleteTargetState[1];
  var reactionDetailState = useComponentState('reactionDetail', null); var reactionDetail = reactionDetailState[0]; var setReactionDetail = reactionDetailState[1];
  var commActionsState = useComponentState('activeMessageActions', null); var commActions = commActionsState[0]; var setCommActions = commActionsState[1];
  var commOpenTrayState = useComponentState('openReactionMessageId', null); var commOpenTrayMsgId = commOpenTrayState[0]; var setCommOpenTray = commOpenTrayState[1];
  var commReplyState = useComponentState('communityReplyingTo', null); var commReplyingTo = commReplyState[0];
  var resolveReply = function(rid) { if (!rid) return null; for (var i = 0; i < messages.length; i++) { if (messages[i].id === rid) return { id: rid, senderName: messages[i].senderName || '', content: messages[i].content || '' }; } return null; };
  var canPost = joinStatus === 'member';
  var isJoining = joinStatus === 'loading' || joinStatus === 'requesting';
  var endRef = React.useRef(null);
  var initialScrollCount = React.useRef(0);
  React.useLayoutEffect(function() {
    if (endRef.current) {
      if (initialScrollCount.current < 2) {
        endRef.current.scrollIntoView({ behavior: 'auto' });
        if (messages.length > 0) { initialScrollCount.current += 1; }
      } else {
        endRef.current.scrollIntoView({ behavior: 'smooth' });
      }
    }
  }, [messages.length]);
  var onSend = function() { var txt = inputValue && inputValue.trim(); if (!txt) return; if (typeof sendMessage === 'function') sendMessage(txt); setInputValue(''); };
  var joinLabel = isJoining ? 'Joining...' : joinStatus === 'requested' ? 'Request sent' : communityType === 'protected' ? 'Request to join ' + communityName : 'Join ' + communityName;
  var typingText = typingUsers && typingUsers.length > 0 ? (typingUsers.length === 1 ? typingUsers[0].name + ' is typing...' : typingUsers.length + ' people are typing...') : null;
  return React.createElement('div', { style: { display: 'flex', flexDirection: 'column', height: '100%', background: '#0A0A0A' } },
    React.createElement('style', null, '.chat-scrollbar-hide::-webkit-scrollbar { display: none; }'),
    React.createElement('div', { style: { display: 'flex', flexDirection: 'row', alignItems: 'center', padding: '0 16px', borderBottom: '1px solid #1F1F1F', background: '#141414', flexShrink: 0, minHeight: '60px', gap: '10px' } },
      React.createElement(BackButton, { onBack: onBack }),
      React.createElement('div', { onClick: function() { if (typeof onViewCommunityProfile === 'function') onViewCommunityProfile(); }, style: { width: '36px', height: '36px', borderRadius: '10px', background: '#1A1A1A', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', cursor: 'pointer', WebkitTapHighlightColor: 'transparent' } },
        communityAvatarUrl ? React.createElement('img', { src: communityAvatarUrl, style: { width: '100%', height: '100%', objectFit: 'cover' } }) : React.createElement('span', { style: { fontSize: '16px', fontWeight: '700', color: '#E8E8E8' } }, (communityName || '?').charAt(0).toUpperCase())
      ),
      React.createElement('div', { onClick: function() { if (typeof onViewCommunityProfile === 'function') onViewCommunityProfile(); }, style: { flex: 1, minWidth: 0, cursor: 'pointer', WebkitTapHighlightColor: 'transparent' } },
        React.createElement('div', { style: { fontSize: '15px', fontWeight: '700', color: '#F3F4F6', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, communityName),
        typingText ? React.createElement('div', { style: { fontSize: '11px', color: '#60A5FA', fontStyle: 'italic' } }, typingText) : React.createElement('div', { style: { fontSize: '11px', color: 'rgba(255,255,255,0.35)' } }, (memberCount || 0) + ' members')
      )
    ),
    React.createElement('div', { className: 'chat-scrollbar-hide', style: { flex: 1, overflowY: 'auto', padding: '8px 0', display: 'flex', flexDirection: 'column', scrollbarWidth: 'none', msOverflowStyle: 'none', position: 'relative', zIndex: 101 } },
      messages.length === 0 ? React.createElement('div', { style: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.25)', gap: '10px', padding: '32px', textAlign: 'center' } },
        React.createElement('div', { style: { fontSize: '40px' } }, String.fromCharCode(128101)),
        React.createElement('div', { style: { fontSize: '14px', fontWeight: '600' } }, 'No messages yet'),
        React.createElement('div', { style: { fontSize: '12px' } }, canPost ? 'Be the first to say something!' : 'Join to start chatting')
      ) : messages.map(function(msg, index, arr) {
        var separator = null;
        if (msg.createdAt) {
          var currentDt = new Date(msg.createdAt);
          if (!isNaN(currentDt.getTime())) {
            var prevDt = index > 0 && arr[index-1].createdAt ? new Date(arr[index-1].createdAt) : null;
            var dayChanged = true;
            if (prevDt && !isNaN(prevDt.getTime())) {
              if (currentDt.getFullYear() === prevDt.getFullYear() && currentDt.getMonth() === prevDt.getMonth() && currentDt.getDate() === prevDt.getDate()) { dayChanged = false; }
            }
            if (dayChanged) {
              var now = new Date();
              var dDay = new Date(currentDt.getFullYear(), currentDt.getMonth(), currentDt.getDate());
              var today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
              var diff = Math.round((today - dDay) / 86400000);
              var label = diff === 0 ? 'Today' : diff === 1 ? 'Yesterday' : currentDt.toLocaleDateString(undefined, { day: 'numeric', month: 'long' });
              separator = React.createElement(DateSeparator, { key: 'sep-' + msg.id, label: label });
            }
          }
        }
        var el;
        if (msg.messageType === 'system') {
          el = React.createElement('div', { key: msg.id, style: { textAlign: 'center', padding: '6px 20px 2px', color: 'rgba(255,255,255,0.32)', fontSize: '12px', letterSpacing: '0.2px', userSelect: 'none' } }, msg.content);
        } else {
          el = React.createElement(CommunityMessageBubble, { key: msg.id + (msg.isDeleted ? '-deleted' : ''), id: msg.id, content: msg.content, timestamp: msg.timestamp, isMine: msg.isMine, senderName: msg.senderName, senderAvatar: msg.senderAvatar, senderInitials: msg.senderInitials, senderId: msg.senderId, isDeleted: !!msg.isDeleted, replyToData: resolveReply(msg.replyTo), onJumpToReply: onJumpToReply, onShowReactors: onShowReactors, onToggleReaction: typeof onToggleReaction !== 'undefined' ? onToggleReaction : undefined, onSenderTap: function(uid, name, avatar) { if (!msg.isMine && typeof onSenderTap === 'function') onSenderTap(uid, name, avatar); } });
        }
        return separator ? React.createElement(React.Fragment, { key: 'frag-' + msg.id }, separator, el) : el;
      }),
      React.createElement('div', { ref: endRef })
    ),
    commReplyingTo ? React.createElement('div', { style: { display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '10px', padding: '8px 16px', background: '#141414', borderTop: '1px solid #1F1F1F', flexShrink: 0 } },
      React.createElement('div', { style: { width: '3px', alignSelf: 'stretch', background: '#2563EB', borderRadius: '2px' } }),
      React.createElement('div', { style: { flex: 1, minWidth: 0 } },
        React.createElement('div', { style: { fontSize: '12px', fontWeight: '600', color: '#60A5FA' } }, 'Replying to ' + (commReplyingTo.senderName || '')),
        React.createElement('div', { style: { fontSize: '12px', color: 'rgba(255,255,255,0.5)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, commReplyingTo.content || '')
      ),
      React.createElement('div', { onClick: function() { if (typeof onCancelReply === 'function') onCancelReply(); }, style: { fontSize: '16px', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', padding: '4px 8px', userSelect: 'none', WebkitTapHighlightColor: 'transparent' } }, String.fromCharCode(10005))
    ) : null,
    canPost ? React.createElement('div', { style: { display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '10px', padding: '10px 16px', paddingBottom: 'calc(env(safe-area-inset-bottom,0px) + 10px)', borderTop: '1px solid #1F1F1F', background: '#141414', flexShrink: 0 } },
      React.createElement('input', { type: 'text', value: inputValue, onChange: function(e) { setInputValue(e.target.value); if (typeof onTyping === 'function') onTyping(); }, onKeyDown: function(e) { if (e.key === 'Enter') onSend(); }, placeholder: 'Message ' + communityName + '...', style: { flex: 1, background: '#1E1E1E', borderRadius: '24px', padding: '10px 16px', fontSize: '15px', color: '#E8E8E8', border: 'none', outline: 'none', minWidth: 0 } }),
      React.createElement('div', { onClick: onSend, style: { width: '38px', height: '38px', borderRadius: '50%', background: inputValue && inputValue.trim() ? '#2563EB' : 'rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, userSelect: 'none', WebkitTapHighlightColor: 'transparent', transition: 'background 0.2s' } }, React.createElement('span', { style: { fontSize: '16px', color: '#FFF' } }, String.fromCharCode(10148)))
    ) : React.createElement('div', { style: { padding: '12px 16px', paddingBottom: 'calc(env(safe-area-inset-bottom,0px) + 12px)', borderTop: '1px solid #1F1F1F', background: '#141414', flexShrink: 0 } },
      React.createElement('div', {
        onClick: function() { if (isJoining || joinStatus === 'requested') return; if (communityType === 'protected') { if (typeof onRequest === 'function') onRequest(); } else { if (typeof onJoin === 'function') onJoin(); } },
        style: { textAlign: 'center', padding: '13px', borderRadius: '999px', background: isJoining || joinStatus === 'requested' ? 'rgba(255,255,255,0.08)' : '#2563EB', color: isJoining || joinStatus === 'requested' ? 'rgba(255,255,255,0.4)' : '#FFF', fontSize: '15px', fontWeight: '600', cursor: isJoining || joinStatus === 'requested' ? 'default' : 'pointer', userSelect: 'none', WebkitTapHighlightColor: 'transparent', transition: 'background 0.25s ease, color 0.2s ease' }
      }, joinLabel)
    ),
    React.createElement('div', { onClick: function() { setCommActions(null); setCommOpenTray(null); }, style: { position: 'fixed', inset: 0, zIndex: 100, display: commActions ? 'block' : 'none', background: 'transparent' } }),
    React.createElement('div', {
      style: { position: 'fixed', bottom: 'calc(env(safe-area-inset-bottom, 0px) + 74px)', left: '50%', transform: commActions ? 'translate(-50%, 0px)' : 'translate(-50%, 100px)', opacity: commActions ? 1 : 0, pointerEvents: commActions ? 'auto' : 'none', transition: 'transform 0.3s cubic-bezier(0.34,1.56,0.64,1), opacity 0.22s ease', zIndex: 101, background: '#1A1A1A', borderRadius: '26px', border: '1px solid rgba(255,255,255,0.1)', padding: '8px 10px', display: 'flex', flexDirection: 'row', gap: '2px', boxShadow: '0 8px 40px rgba(0,0,0,0.75)', userSelect: 'none' }
    },
      React.createElement('div', { onClick: function(e) { e.stopPropagation(); if (commActions) { if (typeof onReplyTo === 'function') onReplyTo({ id: commActions.id, senderName: commActions.senderName || '', content: commActions.content || '' }); setCommActions(null); setCommOpenTray(null); } }, style: { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '8px 14px', borderRadius: '16px', cursor: 'pointer', gap: '5px', WebkitTapHighlightColor: 'transparent' } },
        React.createElement(LucideReply, { size: 20, color: 'rgba(255,255,255,0.8)' }),
        React.createElement('span', { style: { fontSize: '10px', color: 'rgba(255,255,255,0.5)', fontWeight: '600' } }, 'Reply')
      ),
      React.createElement('div', { onClick: function(e) { e.stopPropagation(); if (commActions && commActions.content) { try { if (navigator && navigator.clipboard) navigator.clipboard.writeText(commActions.content); } catch(err) {} } setCommActions(null); setCommOpenTray(null); }, style: { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '8px 14px', borderRadius: '16px', cursor: 'pointer', gap: '5px', WebkitTapHighlightColor: 'transparent' } },
        React.createElement(LucideCopy, { size: 20, color: 'rgba(255,255,255,0.8)' }),
        React.createElement('span', { style: { fontSize: '10px', color: 'rgba(255,255,255,0.5)', fontWeight: '600' } }, 'Copy')
      ),
      commActions && commActions.isMine ? React.createElement('div', { onClick: function(e) { e.stopPropagation(); if (commActions) { setDeleteTarget({ id: commActions.id, preview: (commActions.content || '').substring(0, 50) }); setCommActions(null); setCommOpenTray(null); } }, style: { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '8px 14px', borderRadius: '16px', cursor: 'pointer', gap: '5px', WebkitTapHighlightColor: 'transparent' } },
        React.createElement(LucideTrash, { size: 20, color: '#EF4444' }),
        React.createElement('span', { style: { fontSize: '10px', color: '#EF4444', fontWeight: '600' } }, 'Delete')
      ) : null
    ),
    deleteTarget ? React.createElement('div', { onClick: function() { setDeleteTarget(null); }, style: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.78)', display: 'flex', alignItems: 'flex-end', zIndex: 999 } },
      React.createElement('div', { onClick: function(e) { e.stopPropagation(); }, style: { width: '100%', background: '#141414', borderRadius: '24px 24px 0 0', padding: '24px 20px', paddingBottom: 'calc(env(safe-area-inset-bottom,0px) + 20px)' } },
        React.createElement('div', { style: { fontSize: '13px', color: 'rgba(255,255,255,0.4)', marginBottom: '16px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingLeft: '4px' } }, '"' + deleteTarget.preview + (deleteTarget.preview && deleteTarget.preview.length >= 50 ? '...' : '') + '"'),
        React.createElement('div', { onClick: function() { if (typeof onDeleteMessage === 'function') onDeleteMessage(deleteTarget.id); setDeleteTarget(null); }, style: { textAlign: 'center', padding: '13px', borderRadius: '999px', background: 'rgba(239,68,68,0.1)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.3)', fontSize: '14px', fontWeight: '600', cursor: 'pointer', marginBottom: '10px', userSelect: 'none', WebkitTapHighlightColor: 'transparent' } }, 'Delete message'),
        React.createElement('div', { onClick: function() { setDeleteTarget(null); }, style: { textAlign: 'center', padding: '13px', borderRadius: '999px', background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.55)', fontSize: '14px', fontWeight: '600', cursor: 'pointer', userSelect: 'none', WebkitTapHighlightColor: 'transparent' } }, 'Cancel')
      )
    ) : null,
    reactionDetail ? React.createElement('div', { onClick: function() { setReactionDetail(null); }, style: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'flex-end', zIndex: 999 } },
      React.createElement('div', { onClick: function(e) { e.stopPropagation(); }, style: { width: '100%', background: '#141414', borderRadius: '24px 24px 0 0', padding: '20px', paddingBottom: 'calc(env(safe-area-inset-bottom,0px) + 20px)', maxHeight: '65vh', overflowY: 'auto' } },
        React.createElement('div', { style: { width: '36px', height: '4px', background: 'rgba(255,255,255,0.12)', borderRadius: '2px', margin: '0 auto 18px' } }),
        React.createElement('div', { style: { fontSize: '15px', fontWeight: '700', color: '#F3F4F6', marginBottom: '16px' } }, 'Reactions'),
        (function() {
          var grp = {}; var ord = []; var rxns = (reactionDetail && reactionDetail.reactions) || [];
          for (var i = 0; i < rxns.length; i++) { var r = rxns[i]; if (!grp[r.emoji]) { grp[r.emoji] = []; ord.push(r.emoji); } grp[r.emoji].push(r); }
          return ord.map(function(emoji) {
            return React.createElement('div', { key: emoji, style: { marginBottom: '16px' } },
              React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' } },
                React.createElement('span', { style: { fontSize: '22px' } }, emoji),
                React.createElement('span', { style: { fontSize: '13px', fontWeight: '600', color: 'rgba(255,255,255,0.35)' } }, grp[emoji].length)
              ),
              grp[emoji].map(function(r, idx) {
                return React.createElement('div', { key: idx, style: { display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' } },
                  React.createElement('div', { style: { width: '36px', height: '36px', borderRadius: '50%', background: '#1E3A8A', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: '700', color: '#93C5FD', flexShrink: 0 } }, (r.name || '?').charAt(0).toUpperCase()),
                  React.createElement('span', { style: { fontSize: '14px', color: r.isMe ? '#60A5FA' : '#E8E8E8', fontWeight: r.isMe ? '600' : '400' } }, r.isMe ? (r.name || 'You') + ' (you)' : (r.name || 'Unknown'))
                );
              })
            );
          });
        })()
      )
    ) : null
  );
}`;

export const DEFAULT_COMMUNITYPROFILESCREEN_SOURCE = `function Component() {
  var profileState = useComponentState('communityProfileData', null);
  var profileData = profileState[0];
  var membersState = useComponentState('communityProfileMembers', []);
  var members = membersState[0];
  var pendingPreviewState = useComponentState('communityPendingPreviewUrl', null);
  var pendingPreviewUrl = pendingPreviewState[0];
  var imgInputRef = React.useRef(null);
  var canEdit = userRole === 'owner' || userRole === 'admin';
  var transferModeState = React.useState(false);
  var transferMode = transferModeState[0], setTransferMode = transferModeState[1];
  var editModeState = React.useState(false);
  var editMode = editModeState[0], setEditMode = editModeState[1];
  var editNameState = React.useState('');
  var editName = editNameState[0], setEditName = editNameState[1];
  var editDescState = React.useState('');
  var editDesc = editDescState[0], setEditDesc = editDescState[1];
  var joinStatusState = React.useState('idle'); var joinStatus = joinStatusState[0], setJoinStatus = joinStatusState[1];
  var leaveStatusState = React.useState('idle'); var leaveStatus = leaveStatusState[0], setLeaveStatus = leaveStatusState[1];
  var deleteStatusState = React.useState('idle'); var deleteStatus = deleteStatusState[0], setDeleteStatus = deleteStatusState[1];
  var saveEditStatusState = React.useState('idle'); var saveEditStatus = saveEditStatusState[0], setSaveEditStatus = saveEditStatusState[1];
  var leavingState = React.useState(false); var isLeaving = leavingState[0], setIsLeaving = leavingState[1];
  var deletingState = React.useState(false); var isDeleting = deletingState[0], setIsDeleting = deletingState[1];
  var isMemberLiveState = useComponentState('communityProfileIsMember', isMember);
  var isMemberLive = isMemberLiveState[0];
  var inviteSearchResultsState = useComponentState('inviteSearchResults', []);
  var inviteResults = inviteSearchResultsState[0]; var setInviteResults = inviteSearchResultsState[1];
  var lastInvitedState = useComponentState('lastInvitedUserId', null);
  var lastInvitedId = lastInvitedState[0];
  var inviteQueryState = React.useState(''); var inviteQuery = inviteQueryState[0], setInviteQuery = inviteQueryState[1];
  var inviteOpenState = React.useState(false); var inviteOpen = inviteOpenState[0], setInviteOpen = inviteOpenState[1];
  var removeConfirmState = useComponentState('removeConfirmTarget', null); var removeConfirmTarget = removeConfirmState[0]; var setRemoveConfirmTarget = removeConfirmState[1];
  var pendingRequestsState = useComponentState('pendingRequests', []); var pendingRequests = pendingRequestsState[0];
  var community = profileData || { name: communityName || '', description: communityDescription || null, type: communityType || 'public', member_count: memberCount || 0, avatar_url: communityAvatarUrl || null };
  var roleLabel = function(r) { return r === 'owner' || r === 'admin' ? 'Admin' : null; };
  var typeBadge = function(t) {
    var color = t === 'public' ? '#22C55E' : t === 'protected' ? '#EAB308' : '#EF4444';
    var bg = t === 'public' ? 'rgba(34,197,94,0.1)' : t === 'protected' ? 'rgba(234,179,8,0.1)' : 'rgba(239,68,68,0.1)';
    var label = t === 'public' ? 'Public' : t === 'protected' ? 'Protected' : 'Private';
    return React.createElement('span', { style: { fontSize: '10px', fontWeight: '700', padding: '2px 7px', borderRadius: '5px', background: bg, color: color, letterSpacing: '0.3px' } }, label);
  };
  var pill = { width: '100%', padding: '12px 18px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '999px', color: '#e8e8e8', fontSize: '13px', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', letterSpacing: '0.2px' };
  var pillBtn = function(opts) {
    var st = opts.status || 'idle';
    var isDisabled = opts.disabled || false;
    var bg = isDisabled ? 'rgba(255,255,255,0.05)' : st === 'idle' ? (opts.danger ? 'transparent' : '#2563EB') : st === 'loading' ? 'rgba(255,255,255,0.08)' : st === 'success' ? '#16A34A' : 'rgba(239,68,68,0.12)';
    var clr = isDisabled ? 'rgba(255,255,255,0.2)' : st === 'idle' ? (opts.danger ? '#EF4444' : '#FFF') : st === 'loading' ? 'rgba(255,255,255,0.35)' : '#FFF';
    var bdr = st === 'idle' && opts.danger && !isDisabled ? '1px solid rgba(239,68,68,0.3)' : isDisabled ? '1px solid rgba(255,255,255,0.07)' : 'none';
    return React.createElement('div', { onClick: st === 'idle' && !isDisabled ? opts.onClick : undefined, style: { textAlign: 'center', padding: '13px 20px', borderRadius: '999px', background: bg, color: clr, border: bdr, fontSize: '14px', fontWeight: '600', cursor: st === 'idle' && !isDisabled ? 'pointer' : 'default', userSelect: 'none', WebkitTapHighlightColor: 'transparent', opacity: st === 'loading' ? 0.75 : 1, transition: 'background 0.25s ease, color 0.2s ease, opacity 0.2s ease', boxSizing: 'border-box', width: '100%' } }, st === 'loading' ? (opts.loadingLabel || '...') : opts.label);
  };
  React.useEffect(function() {
    if (profileData) { setEditName(profileData.name || ''); setEditDesc(profileData.description || ''); }
  }, [profileData]);
  var hasChanges = pendingPreviewUrl !== null || editName.trim() !== (community.name || '').trim() || editDesc.trim() !== (community.description || '');
  var avatarSrc = pendingPreviewUrl || community.avatar_url;
  return React.createElement('div', { style: { display: 'flex', flexDirection: 'column', height: '100%', background: '#0A0A0A', overflowY: 'auto' } },
    React.createElement('div', { style: { display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '12px', padding: '14px 16px', borderBottom: '1px solid #1F1F1F', background: '#141414', flexShrink: 0 } },
      React.createElement(BackButton, { onBack: onBack }),
      React.createElement('div', { style: { flex: 1, fontSize: '17px', fontWeight: '600', color: '#F3F4F6' } }, 'Community Info'),
      canEdit && !editMode && !transferMode ? React.createElement('div', { onClick: function() { setEditName(community.name || ''); setEditDesc(community.description || ''); setEditMode(true); }, style: { fontSize: '13px', color: '#60A5FA', cursor: 'pointer', padding: '4px 8px', userSelect: 'none', WebkitTapHighlightColor: 'transparent' } }, 'Edit') : null
    ),
    React.createElement('div', { style: { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '32px 20px 20px', gap: '12px' } },
      React.createElement('input', { ref: imgInputRef, type: 'file', accept: 'image/*', style: { display: 'none' }, onChange: function(e) { var file = e.target.files && e.target.files[0]; if (!file) return; if (typeof onPickPendingImage === 'function') onPickPendingImage(file); e.target.value = ''; } }),
      React.createElement('div', { style: { position: 'relative', width: '96px', height: '96px', flexShrink: 0 } },
        React.createElement('div', {
          onClick: editMode ? function() { if (!imageUploading && imgInputRef.current) imgInputRef.current.click(); } : undefined,
          style: { width: '96px', height: '96px', borderRadius: '24px', background: '#1A1A1A', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', cursor: editMode && !imageUploading ? 'pointer' : 'default', WebkitTapHighlightColor: 'transparent', opacity: imageUploading ? 0.5 : 1, transition: 'opacity 0.2s' }
        },
          avatarSrc ? React.createElement('img', { src: avatarSrc, style: { width: '100%', height: '100%', objectFit: 'cover' } }) : React.createElement('span', { style: { fontSize: '36px', fontWeight: '700', color: '#E8E8E8' } }, (community.name || '?').charAt(0).toUpperCase())
        ),
        imageUploading ? React.createElement('div', { style: { position: 'absolute', inset: 0, borderRadius: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' } },
          React.createElement('div', { style: { width: '22px', height: '22px', borderRadius: '50%', border: '2px solid rgba(255,255,255,0.15)', borderTopColor: '#FFF', animation: 'spin 0.7s linear infinite' } })
        ) : null
      ),
      editMode ? React.createElement('div', { style: { fontSize: '11px', color: 'rgba(255,255,255,0.35)' } }, pendingPreviewUrl ? 'New photo selected' : 'Tap photo to change') : null,
      !editMode ? React.createElement('div', { style: { textAlign: 'center' } },
        React.createElement('div', { style: { fontSize: '22px', fontWeight: '700', color: '#F3F4F6', marginBottom: '8px' } }, community.name),
        React.createElement('div', { style: { display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '8px' } },
          typeBadge(community.type),
          React.createElement('span', { style: { fontSize: '13px', color: 'rgba(255,255,255,0.4)' } }, (community.member_count || 0) + ' members')
        ),
        community.description ? React.createElement('div', { style: { fontSize: '14px', color: 'rgba(255,255,255,0.55)', lineHeight: '1.6', maxWidth: '260px' } }, community.description) : null
      ) : null
    ),
    editMode ? React.createElement('div', { style: { padding: '0 20px 20px', display: 'flex', flexDirection: 'column', gap: '14px' } },
      React.createElement('input', { type: 'text', value: editName, onChange: function(e) { setEditName(e.target.value); }, style: pill, placeholder: 'Community name' }),
      React.createElement('textarea', { value: editDesc, onChange: function(e) { setEditDesc(e.target.value); }, style: Object.assign({}, pill, { borderRadius: '16px', minHeight: '70px', resize: 'none', lineHeight: '1.5' }), placeholder: 'About this community' }),
      pillBtn({ label: 'Save changes', loadingLabel: 'Saving...', status: saveEditStatus, disabled: !hasChanges, onClick: function() { setSaveEditStatus('loading'); if (typeof onSaveEdit === 'function') { onSaveEdit(editName.trim(), editDesc.trim()); } setTimeout(function() { setSaveEditStatus('success'); setTimeout(function() { setSaveEditStatus('idle'); setEditMode(false); }, 700); }, 600); } }),
      React.createElement('div', { onClick: function() { setEditMode(false); if (typeof onCancelEdit === 'function') onCancelEdit(); }, style: { textAlign: 'center', padding: '10px', fontSize: '13px', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', userSelect: 'none', WebkitTapHighlightColor: 'transparent' } }, 'Cancel')
    ) : null,
    !editMode && isMemberLive && !transferMode ? React.createElement('div', {
      onClick: function() { setInviteOpen(true); setInviteQuery(''); setInviteResults([]); },
      style: { margin: '0 16px 12px', background: 'rgba(37,99,235,0.08)', borderRadius: '14px', border: '1px solid rgba(37,99,235,0.2)', padding: '14px 16px', display: 'flex', alignItems: 'center', cursor: 'pointer', WebkitTapHighlightColor: 'transparent', userSelect: 'none' }
    },
      React.createElement('div', { style: { flex: 1, fontSize: '14px', fontWeight: '600', color: '#60A5FA' } }, String.fromCharCode(10133) + ' Invite Members'),
      React.createElement('div', { style: { fontSize: '16px', color: 'rgba(255,255,255,0.3)' } }, String.fromCharCode(8250))
    ) : null,
    !editMode && !transferMode && (userRole === 'owner' || userRole === 'admin') && community.type === 'protected' && pendingRequests.length > 0 ? React.createElement('div', { style: { margin: '0 16px 16px' } },
      React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', paddingLeft: '2px' } },
        React.createElement('span', { style: { background: '#EAB308', color: '#000', borderRadius: '999px', padding: '1px 7px', fontSize: '10px', fontWeight: '800' } }, String(pendingRequests.length)),
        React.createElement('span', { style: { fontSize: '12px', color: '#EAB308', fontWeight: '600' } }, 'Join Requests')
      ),
      pendingRequests.map(function(req) {
        return React.createElement('div', { key: req.user_id, style: { display: 'flex', flexDirection: 'row', alignItems: 'center', padding: '10px 0', gap: '10px', borderBottom: '1px solid rgba(255,255,255,0.04)' } },
          React.createElement(ProfileImage, { avatarUrl: req.avatar_url || null, contactInitials: (req.display_name || req.username || '?').charAt(0).toUpperCase(), contactAvatarColor: '#EAB308', size: 38 }),
          React.createElement('div', { style: { flex: 1, minWidth: 0 } },
            React.createElement('div', { style: { fontSize: '14px', fontWeight: '500', color: '#E8E8E8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, req.display_name || req.username || 'Unknown'),
            req.username ? React.createElement('div', { style: { fontSize: '11px', color: 'rgba(255,255,255,0.35)' } }, '@' + req.username) : null
          ),
          React.createElement('div', { style: { display: 'flex', gap: '6px', flexShrink: 0 } },
            React.createElement('div', { onClick: function(e) { e.stopPropagation(); if (typeof onApproveRequest === 'function') onApproveRequest(req.user_id, req.display_name || req.username || 'Someone'); }, style: { padding: '5px 12px', borderRadius: '999px', background: '#16A34A', color: '#FFF', fontSize: '12px', fontWeight: '600', cursor: 'pointer', userSelect: 'none', WebkitTapHighlightColor: 'transparent' } }, 'Approve'),
            React.createElement('div', { onClick: function(e) { e.stopPropagation(); if (typeof onRejectRequest === 'function') onRejectRequest(req.user_id); }, style: { padding: '5px 10px', borderRadius: '999px', border: '1px solid rgba(239,68,68,0.3)', color: '#EF4444', fontSize: '12px', cursor: 'pointer', userSelect: 'none', WebkitTapHighlightColor: 'transparent' } }, 'Reject')
          )
        );
      })
    ) : null,
    !editMode && members.length > 0 ? React.createElement('div', { style: { margin: '0 16px 16px' } },
      React.createElement('div', { style: { fontSize: '12px', color: 'rgba(255,255,255,0.35)', fontWeight: '600', marginBottom: '10px', paddingLeft: '2px' } }, transferMode ? 'Select the new Admin:' : (members.length + ' Members')),
      members.map(function(m) {
        var rl = roleLabel(m.role);
        var canRemove = !transferMode && (userRole === 'owner' || userRole === 'admin') && m.user_id !== currentUserId && m.role !== 'owner';
        var canAppoint = transferMode && m.role !== 'owner' && m.user_id !== currentUserId;
        return React.createElement('div', { key: m.user_id, style: { display: 'flex', flexDirection: 'row', alignItems: 'center', padding: '10px 0', gap: '10px', borderBottom: '1px solid rgba(255,255,255,0.04)' } },
          React.createElement('div', { onClick: m.user_id !== currentUserId ? function(e) { e.stopPropagation(); if (typeof onViewMemberProfile === 'function') onViewMemberProfile(m.user_id, m.display_name, m.username, m.avatar_url); } : undefined, style: { flexShrink: 0, cursor: m.user_id !== currentUserId ? 'pointer' : 'default', WebkitTapHighlightColor: 'transparent' } },
            React.createElement(ProfileImage, { avatarUrl: m.avatar_url || null, contactInitials: (m.display_name || m.username || '?').charAt(0).toUpperCase(), contactAvatarColor: '#2563EB', size: 38 })
          ),
          React.createElement('div', { onClick: m.user_id !== currentUserId ? function() { if (typeof onStartDMWithUser === 'function') onStartDMWithUser(m.user_id, m.display_name, m.username, m.avatar_url); } : undefined, style: { flex: 1, minWidth: 0, cursor: m.user_id !== currentUserId ? 'pointer' : 'default', WebkitTapHighlightColor: 'transparent' } },
            React.createElement('div', { style: { fontSize: '14px', fontWeight: '500', color: '#E8E8E8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, m.display_name || m.username || 'Unknown'),
            m.username ? React.createElement('div', { style: { fontSize: '11px', color: 'rgba(255,255,255,0.35)' } }, '@' + m.username) : null
          ),
          canAppoint ? React.createElement('div', { onClick: function(e) { e.stopPropagation(); if (typeof onTransferOwnership === 'function') onTransferOwnership(m.user_id, m.display_name || m.username || 'this member'); }, style: { padding: '5px 12px', borderRadius: '999px', background: '#2563EB', color: '#FFF', fontSize: '12px', fontWeight: '600', cursor: 'pointer', flexShrink: 0, userSelect: 'none', WebkitTapHighlightColor: 'transparent', transition: 'opacity 0.2s' } }, 'Appoint') :
          canRemove ? React.createElement('div', { onClick: function(e) { e.stopPropagation(); setRemoveConfirmTarget({ id: m.user_id, name: m.display_name || m.username || 'this member' }); }, style: { padding: '4px 10px', borderRadius: '999px', border: '1px solid rgba(239,68,68,0.25)', color: '#EF4444', fontSize: '11px', cursor: 'pointer', flexShrink: 0, userSelect: 'none', WebkitTapHighlightColor: 'transparent' } }, 'Remove') :
          rl ? React.createElement('span', { style: { fontSize: '10px', fontWeight: '600', padding: '2px 6px', borderRadius: '4px', background: 'rgba(37,99,235,0.18)', color: '#60A5FA' } }, rl) : null
        );
      })
    ) : null,
    !editMode && !transferMode ? React.createElement('div', { style: { padding: '4px 16px 36px', display: 'flex', flexDirection: 'column', gap: '10px' } },
      !isMemberLive ? pillBtn({ label: community.type === 'protected' ? 'Request to join' : 'Join community', loadingLabel: community.type === 'protected' ? 'Requesting...' : 'Joining...', status: joinStatus, onClick: function() { setJoinStatus('loading'); if (community.type === 'protected') { if (typeof onRequest === 'function') onRequest(); setTimeout(function(){ setJoinStatus('idle'); }, 1200); } else { if (typeof onJoin === 'function') onJoin(); setTimeout(function(){ setJoinStatus('success'); }, 600); } } }) : null,
      isMemberLive && userRole === 'owner' ? React.createElement('div', { onClick: function() { setTransferMode(true); }, style: { textAlign: 'center', padding: '13px', borderRadius: '999px', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.5)', fontSize: '14px', fontWeight: '600', cursor: 'pointer', userSelect: 'none', WebkitTapHighlightColor: 'transparent', transition: 'opacity 0.2s' } }, 'Transfer Admin') : null,
      isMemberLive && userRole !== 'owner' ? React.createElement('div', { onClick: function() { setIsLeaving(true); }, style: { textAlign: 'center', padding: '13px', borderRadius: '999px', border: '1px solid rgba(239,68,68,0.25)', color: '#EF4444', fontSize: '14px', fontWeight: '600', cursor: 'pointer', userSelect: 'none', WebkitTapHighlightColor: 'transparent' } }, 'Leave community') : null,
      isMemberLive && userRole === 'owner' ? React.createElement('div', { onClick: function() { setIsDeleting(true); }, style: { textAlign: 'center', padding: '13px', borderRadius: '999px', border: '1px solid rgba(239,68,68,0.25)', color: '#EF4444', fontSize: '14px', fontWeight: '600', cursor: 'pointer', userSelect: 'none', WebkitTapHighlightColor: 'transparent' } }, 'Delete community') : null
    ) : (!editMode && transferMode ? React.createElement('div', { style: { padding: '4px 16px 36px' } },
      React.createElement('div', { onClick: function() { setTransferMode(false); }, style: { textAlign: 'center', padding: '11px', borderRadius: '999px', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.4)', fontSize: '13px', cursor: 'pointer', userSelect: 'none', WebkitTapHighlightColor: 'transparent' } }, 'Cancel')
    ) : null),
    isLeaving ? React.createElement('div', { style: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.78)', display: 'flex', alignItems: 'flex-end', zIndex: 999 } },
      React.createElement('div', { style: { width: '100%', background: '#141414', borderRadius: '24px 24px 0 0', padding: '28px 20px', paddingBottom: 'calc(env(safe-area-inset-bottom,0px) + 28px)' } },
        React.createElement('div', { style: { fontSize: '18px', fontWeight: '700', color: '#F3F4F6', marginBottom: '8px', textAlign: 'center' } }, 'Leave ' + (community.name || 'this community') + '?'),
        React.createElement('div', { style: { fontSize: '13px', color: 'rgba(255,255,255,0.5)', marginBottom: '24px', textAlign: 'center', lineHeight: '1.6' } },
          community.type === 'protected' ? "You'll need to request access again and be approved." :
          community.type === 'private' ? 'You may not be able to rejoin without a new invite.' :
          'You can rejoin at any time.'
        ),
        React.createElement('div', { onClick: function() { setIsLeaving(false); if (typeof onLeave === 'function') onLeave(); }, style: { textAlign: 'center', padding: '13px', borderRadius: '999px', background: 'rgba(239,68,68,0.1)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.3)', fontSize: '14px', fontWeight: '600', cursor: 'pointer', marginBottom: '10px', userSelect: 'none', WebkitTapHighlightColor: 'transparent' } }, 'Leave'),
        React.createElement('div', { onClick: function() { setIsLeaving(false); }, style: { textAlign: 'center', padding: '13px', borderRadius: '999px', background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.55)', fontSize: '14px', fontWeight: '600', cursor: 'pointer', userSelect: 'none', WebkitTapHighlightColor: 'transparent' } }, 'Cancel')
      )
    ) : null,
    isDeleting ? React.createElement('div', { style: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.78)', display: 'flex', alignItems: 'flex-end', zIndex: 999 } },
      React.createElement('div', { style: { width: '100%', background: '#141414', borderRadius: '24px 24px 0 0', padding: '28px 20px', paddingBottom: 'calc(env(safe-area-inset-bottom,0px) + 28px)' } },
        React.createElement('div', { style: { fontSize: '18px', fontWeight: '700', color: '#F3F4F6', marginBottom: '8px', textAlign: 'center' } }, 'Delete ' + (community.name || 'this community') + '?'),
        React.createElement('div', { style: { fontSize: '13px', color: 'rgba(255,255,255,0.5)', marginBottom: '24px', textAlign: 'center', lineHeight: '1.6' } }, 'This will permanently delete the community and all its messages. This cannot be undone.'),
        React.createElement('div', { onClick: function() { setIsDeleting(false); if (typeof onDeleteCommunity === 'function') onDeleteCommunity(); }, style: { textAlign: 'center', padding: '13px', borderRadius: '999px', background: 'rgba(239,68,68,0.1)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.3)', fontSize: '14px', fontWeight: '600', cursor: 'pointer', marginBottom: '10px', userSelect: 'none', WebkitTapHighlightColor: 'transparent' } }, 'Delete permanently'),
        React.createElement('div', { onClick: function() { setIsDeleting(false); }, style: { textAlign: 'center', padding: '13px', borderRadius: '999px', background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.55)', fontSize: '14px', fontWeight: '600', cursor: 'pointer', userSelect: 'none', WebkitTapHighlightColor: 'transparent' } }, 'Cancel')
      )
    ) : null,
    inviteOpen ? React.createElement('div', { style: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.78)', display: 'flex', alignItems: 'flex-end', zIndex: 1000 } },
      React.createElement('div', { style: { width: '100%', background: '#141414', borderRadius: '24px 24px 0 0', padding: '24px 20px 0 20px', paddingBottom: 'calc(env(safe-area-inset-bottom,0px) + 20px)', maxHeight: '75vh', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' } },
        React.createElement('div', { style: { display: 'flex', flexDirection: 'row', alignItems: 'center', marginBottom: '16px', flexShrink: 0 } },
          React.createElement('div', { style: { flex: 1, fontSize: '17px', fontWeight: '700', color: '#F3F4F6' } }, 'Invite Members'),
          React.createElement('div', { onClick: function() { setInviteOpen(false); setInviteQuery(''); setInviteResults([]); }, style: { width: '30px', height: '30px', borderRadius: '50%', background: 'rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '18px', color: 'rgba(255,255,255,0.6)', userSelect: 'none', WebkitTapHighlightColor: 'transparent' } }, '\u00D7')
        ),
        React.createElement('input', { type: 'text', value: inviteQuery, placeholder: 'Search by username...', onChange: function(e) { var q = e.target.value; setInviteQuery(q); if (typeof searchUsersToInvite === 'function') searchUsersToInvite(q); }, style: { width: '100%', background: 'rgba(255,255,255,0.05)', borderRadius: '999px', padding: '10px 16px', fontSize: '14px', color: '#E8E8E8', border: '1px solid rgba(255,255,255,0.08)', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', marginBottom: '12px', flexShrink: 0 } }),
        React.createElement('div', { style: { overflowY: 'auto', flex: 1 } },
          inviteResults.length > 0 ? inviteResults.map(function(u) {
            var justInvited = lastInvitedId === u.id;
            return React.createElement('div', { key: u.id, style: { display: 'flex', flexDirection: 'row', alignItems: 'center', padding: '10px 0', gap: '12px', borderBottom: '1px solid rgba(255,255,255,0.04)' } },
              React.createElement(ProfileImage, { avatarUrl: u.avatar_url || null, contactInitials: (u.display_name || u.username || '?').charAt(0).toUpperCase(), contactAvatarColor: '#2563EB', size: 40 }),
              React.createElement('div', { style: { flex: 1, minWidth: 0 } },
                React.createElement('div', { style: { fontSize: '14px', fontWeight: '500', color: '#E8E8E8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, u.display_name || u.username),
                u.username ? React.createElement('div', { style: { fontSize: '11px', color: 'rgba(255,255,255,0.35)', marginTop: '1px' } }, '@' + u.username) : null
              ),
              React.createElement('div', { onClick: function(e) { e.stopPropagation(); if (!justInvited && typeof onInviteUser === 'function') onInviteUser(u.id); }, style: { padding: '6px 14px', borderRadius: '999px', background: justInvited ? '#16A34A' : '#2563EB', color: '#FFF', fontSize: '13px', fontWeight: '600', cursor: justInvited ? 'default' : 'pointer', flexShrink: 0, userSelect: 'none', WebkitTapHighlightColor: 'transparent', transition: 'background 0.3s' } }, justInvited ? String.fromCharCode(10003) + ' Sent' : 'Invite')
            );
          }) : inviteQuery.length >= 2 ? React.createElement('div', { style: { padding: '20px 0', fontSize: '14px', color: 'rgba(255,255,255,0.35)', textAlign: 'center' } }, 'No users found') :
          React.createElement('div', { style: { padding: '20px 0', fontSize: '13px', color: 'rgba(255,255,255,0.3)', textAlign: 'center' } }, 'Type a username to search')
        )
      )
    ) : null,
    removeConfirmTarget ? React.createElement('div', { style: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.78)', display: 'flex', alignItems: 'flex-end', zIndex: 1000 } },
      React.createElement('div', { style: { width: '100%', background: '#141414', borderRadius: '24px 24px 0 0', padding: '28px 20px', paddingBottom: 'calc(env(safe-area-inset-bottom,0px) + 28px)' } },
        React.createElement('div', { style: { fontSize: '18px', fontWeight: '700', color: '#F3F4F6', marginBottom: '8px', textAlign: 'center' } }, 'Remove ' + removeConfirmTarget.name + '?'),
        React.createElement('div', { style: { fontSize: '13px', color: 'rgba(255,255,255,0.5)', marginBottom: '24px', textAlign: 'center', lineHeight: '1.6' } }, 'They will be removed from this community and will not be able to rejoin without an invite.'),
        React.createElement('div', { onClick: function() { if (typeof onRemoveMember === 'function') onRemoveMember(removeConfirmTarget.id, removeConfirmTarget.name); setRemoveConfirmTarget(null); }, style: { textAlign: 'center', padding: '13px', borderRadius: '999px', background: 'rgba(239,68,68,0.1)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.3)', fontSize: '14px', fontWeight: '600', cursor: 'pointer', marginBottom: '10px', userSelect: 'none', WebkitTapHighlightColor: 'transparent' } }, 'Remove'),
        React.createElement('div', { onClick: function() { setRemoveConfirmTarget(null); }, style: { textAlign: 'center', padding: '13px', borderRadius: '999px', background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.55)', fontSize: '14px', fontWeight: '600', cursor: 'pointer', userSelect: 'none', WebkitTapHighlightColor: 'transparent' } }, 'Cancel')
      )
    ) : null
  );
}`;

export const DEFAULT_CHATNAME_SOURCE = `function Component() {
  return React.createElement('div', { style: { fontSize: '16px', fontWeight: '600', color: '#E8E8E8', lineHeight: '1.2' } }, contactName);
}`;

export const DEFAULT_ONLINESTATUS_SOURCE = `function Component() {
  var text = 'offline';
  if (isOnline) {
    text = 'online';
  } else if (typeof lastSeen === 'string' && lastSeen) {
    var d = new Date(lastSeen);
    if (!isNaN(d.getTime())) {
      var isToday = new Date().toDateString() === d.toDateString();
      if (isToday) {
        text = 'last seen today at ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      } else {
        text = 'last seen ' + d.toLocaleDateString([], { month: 'short', day: 'numeric' });
      }
    }
  }
  return React.createElement('div', { style: { fontSize: '11px', color: isOnline ? '#22C55E' : '#8A8A8A', marginTop: '2px' } }, text);
}`;

export const DEFAULT_MESSAGESTATUS_SOURCE = `function Component() {
  if (!isSent) {
    return null;
  }
  return React.createElement('div', {
    style: { fontSize: '10px', color: status === 'read' ? '#34B7F1' : 'rgba(255,255,255,0.5)' }
  }, status === 'sent' || status === 'sending' ? String.fromCharCode(10003) : String.fromCharCode(10003) + String.fromCharCode(10003));
}`;

export const DEFAULT_TYPINGINDICATOR_SOURCE = `function Component() {
  var typingState = useComponentState('otherUserTyping', false);
  var isTyping = typingState[0];
  if (!isTyping) {
    return null;
  }
  return React.createElement('div', { style: { fontSize: '11px', color: '#22C55E', marginTop: '2px' } }, 'typing...');
}`;

export const DEFAULT_MESSAGEBUBBLE_SOURCE = `function Component() {
  var hlState = useComponentState('highlightedMessageId', null);
  var isHighlighted = hlState[0] === id;
  var openTrayState = useComponentState('openReactionMessageId', null);
  var setOpenTray = openTrayState[1];
  var actionsState = useComponentState('activeMessageActions', null);
  var setActions = actionsState[1];

  var dragState = React.useState({ active: false, startX: 0, deltaX: 0 });
  var drag = dragState[0], setDrag = dragState[1];
  var pressTimer = React.useRef(null);

  var handlePointerDown = function(e) {
    setDrag({ active: true, startX: e.clientX, deltaX: 0 });
    pressTimer.current = setTimeout(function() {
      setOpenTray(id); setActions({ id: id, isSent: isSent, content: content });
      pressTimer.current = null;
    }, 450);
  };
  var handlePointerMove = function(e) {
    if (!drag.active) return;
    var dx = e.clientX - drag.startX;
    if (Math.abs(dx) > 10 && pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
    if (dx > 70) dx = 70;
    if (dx < -70) dx = -70;
    setDrag({ active: true, startX: drag.startX, deltaX: dx });
  };
  var handlePointerUp = function() {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
    if (Math.abs(drag.deltaX) > 45 && typeof onReplyTo === 'function') {
      onReplyTo({ id: id, content: content, isSent: isSent });
    }
    setDrag({ active: false, startX: 0, deltaX: 0 });
  };

  var dragProgress = Math.min(Math.abs(drag.deltaX) / 50, 1);

  if (isDeleted) {
    return React.createElement('div', { id: 'msg-' + id, style: { width: '100%', display: 'flex', padding: '4px 16px', justifyContent: isSent ? 'flex-end' : 'flex-start' } },
      React.createElement('div', { style: { padding: '8px 12px', borderRadius: '16px', background: isSent ? 'rgba(37,99,235,0.18)' : 'rgba(255,255,255,0.04)', border: isSent ? '1px solid rgba(37,99,235,0.25)' : '1px solid rgba(255,255,255,0.07)' } },
        React.createElement('span', { style: { fontSize: '13px', color: isSent ? 'rgba(147,197,253,0.55)' : 'rgba(255,255,255,0.28)', fontStyle: 'italic' } }, 'This message was deleted')
      )
    );
  }

  return React.createElement('div', {
    id: 'msg-' + id,
    style: {
      width: '100%', display: 'flex', flexDirection: 'row',
      padding: '4px 16px',
      justifyContent: isSent ? 'flex-end' : 'flex-start',
      backgroundColor: isHighlighted ? 'rgba(255,255,255,0.07)' : 'transparent',
      transition: 'background-color 0.4s ease',
    }
  },
    React.createElement('div', {
      onPointerDown: handlePointerDown,
      onPointerMove: handlePointerMove,
      onPointerUp: handlePointerUp,
      onPointerLeave: handlePointerUp,
      style: {
        display: 'flex', flexDirection: 'column', maxWidth: '72%',
        padding: '10px 14px',
        borderRadius: '18px',
        borderBottomRightRadius: isSent ? '4px' : '18px',
        borderBottomLeftRadius: isSent ? '18px' : '4px',
        background: isSent ? '#2563EB' : '#1E1E1E',
        cursor: 'pointer',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        WebkitTapHighlightColor: 'transparent',
        outline: 'none',
        overflow: 'hidden',
        transform: 'translateX(' + drag.deltaX + 'px) scale(' + (1 - dragProgress * 0.04) + ')',
        opacity: 1 - dragProgress * 0.15,
        transition: drag.active ? 'none' : 'transform 0.25s ease, opacity 0.25s ease',
        touchAction: 'pan-y',
      }
    },
      React.createElement(ReplyQuote, { replyTo: replyTo, isSent: isSent, onJumpToReply: onJumpToReply }),
      React.createElement('div', {
        style: {
          fontSize: '15px', lineHeight: '1.4', wordBreak: 'break-word',
          color: isSent ? '#F0F0F0' : '#E8E8E8',
        }
      }, content),
      React.createElement(MessageReactions, { messageId: id, currentUserId: currentUserId, onToggleReaction: onToggleReaction, onShowReactors: onShowReactors }),
      React.createElement('div', {
        style: { display: 'flex', flexDirection: 'row', flexWrap: 'nowrap', justifyContent: 'flex-end', alignItems: 'center', marginTop: '2px', gap: '6px' }
      },
        React.createElement('div', {
          style: { fontSize: '10px', color: isSent ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.35)', whiteSpace: 'nowrap' }
        }, timestamp),
        React.createElement(MessageStatus, { status: status, isSent: isSent })
      )
    )
  );
}`;

export const DEFAULT_DATESEPARATOR_SOURCE = `function Component() {
  return React.createElement('div', {
    style: { display: 'flex', justifyContent: 'center', margin: '12px 0 4px' }
  }, React.createElement('span', {
    style: { background: '#1E1E1E', color: '#8A8A8A', fontSize: '11px', padding: '4px 10px', borderRadius: '12px', fontWeight: '500' }
  }, label));
}`;

export const DEFAULT_CONTACTLIST_SOURCE = `function Component() {
  var contactsState = useComponentState('feedContacts', contacts || []);
  var renderedContacts = contactsState[0];
  var typingMapState = useComponentState('dmTypingMap', {});
  var dmTypingMap = typingMapState[0];
  var contactsWithTyping = (renderedContacts || []).map(function(c) { return Object.assign({}, c, { _typing: !!(dmTypingMap && dmTypingMap[c.id]) }); });
  var timers = React.useRef({});
  function startPress(id) {
    timers.current[id] = setTimeout(function() {
      var contact = (renderedContacts || []).find(function(c) { return c.id === id; });
      if (contact) { onTileLongPress && onTileLongPress(contact); }
    }, 500);
  }
  function cancelPress(id) {
    if (timers.current[id]) { clearTimeout(timers.current[id]); delete timers.current[id]; }
  }
  return React.createElement('div', {
    style: { height: '100%', width: '100%', overflowY: 'auto', background: '#0a0a0a' }
  },
      contactsWithTyping.map(function(contact, index) {
      var badge = contact.unreadCount > 99 ? '99+' : String(contact.unreadCount);
      return React.createElement('div', {
        key: contact.id,
        onClick: function() { onContactSelect && onContactSelect(contact); },
        onPointerDown: function() { startPress(contact.id); },
        onPointerUp: function() { cancelPress(contact.id); },
        onPointerLeave: function() { cancelPress(contact.id); },
        onPointerCancel: function() { cancelPress(contact.id); },
        onContextMenu: function(e) { e.preventDefault(); onTileLongPress && onTileLongPress(contact); },
        style: {
          display: 'flex', flexDirection: 'row', alignItems: 'center',
          width: '100%', minHeight: '72px', padding: '12px 16px',
          background: '#141414', borderBottom: '1px solid #1F1F1F',
          cursor: 'pointer', boxSizing: 'border-box',
        }
      },
        React.createElement('div', {
          onClick: function(e) { e.stopPropagation(); if (typeof onAvatarTap === 'function') onAvatarTap(contact); },
          style: { position: 'relative', flexShrink: 0, width: '48px', height: '48px', marginRight: '12px', cursor: 'pointer', WebkitTapHighlightColor: 'transparent' }
        },
          contact.avatarUrl
            ? React.createElement('img', {
                src: contact.avatarUrl,
                style: { width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover', boxShadow: contact.isOnline ? '0 0 0 2px #22C55E' : 'none' }
              })
            : React.createElement('div', {
                style: { display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', borderRadius: '50%', backgroundColor: contact.avatarColor, boxShadow: contact.isOnline ? '0 0 0 2px #22C55E' : 'none' }
              }, React.createElement('span', { style: { fontSize: '16px', fontWeight: '600', color: '#F3F4F6' } }, contact.avatarInitials)),
          contact.isOnline ? React.createElement('div', { style: { position: 'absolute', bottom: 0, right: 0, width: '10px', height: '10px', borderRadius: '50%', background: '#22C55E' } }) : null
        ),
        React.createElement('div', {
          style: { display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0, marginRight: '12px', gap: '3px' }
        },
          React.createElement('div', {
            style: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '15px', fontWeight: '600', color: '#E8E8E8' }
          }, contact.name),
          React.createElement('div', {
            style: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '13px', color: '#8A8A8A' }
          }, contact._typing ? React.createElement('span', { style: { color: '#60A5FA', fontStyle: 'italic' } }, 'typing...') : contact.lastMessage)
        ),
        React.createElement('div', {
          style: { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }
        },
          React.createElement('div', { style: { fontSize: '11px', color: '#8A8A8A' } }, contact.lastMessageTime),
          contact.unreadCount > 0 ? React.createElement('div', {
            style: {
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              minWidth: '20px', height: '20px', borderRadius: '9999px',
              background: '#3B82F6', padding: '0 6px', color: '#fff', fontSize: '11px', fontWeight: '700',
            }
          }, badge) : null
        )
      );
    })
  );
}`;

export const DEFAULT_HOMEHEADER_SOURCE = `function Component() {
  var tabState = useComponentState('activeTab', 'chats');
  var activeTab = tabState[0];
  var searchState = useComponentState('showSearch', false);
  var showSearch = searchState[0];
  var title = activeTab === 'chats' ? 'Chats' : (activeTab === 'communities' ? 'Communities' : 'Profile');
  var children = [
    React.createElement('img', { key: 'logo', src: '/spigens_logo.png', alt: 'Spigens', style: { width: 34, height: 34, borderRadius: 10, objectFit: 'cover', flexShrink: 0 } }),
    React.createElement('div', { key: 'title', style: { flex: 1, fontSize: 20, fontWeight: 700, color: '#F3F4F6' } }, title)
  ];
  if (activeTab !== 'profile') {
    children.push(React.createElement('button', {
      key: 'search',
      onClick: function() { if (typeof onSearchTap === 'function') onSearchTap(); },
      style: { background: 'none', border: 'none', width: 36, height: 36, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: showSearch ? '#2563EB' : 'rgba(255,255,255,0.6)', flexShrink: 0 }
    }, React.createElement(Icon, { name: 'search', size: 20, color: showSearch ? '#2563EB' : 'rgba(255,255,255,0.6)' })));
  }
  if (activeTab === 'communities') {
    children.push(React.createElement('button', {
      key: 'create',
      onClick: function() { if (typeof onCreateCommunity === 'function') onCreateCommunity(); },
      style: { width: 36, height: 36, borderRadius: '50%', background: '#2563EB', border: 'none', color: '#FFF', fontSize: 22, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }
    }, '+'));
  }
  return React.createElement('div', {
    style: { display: 'flex', flexDirection: 'row', alignItems: 'center', padding: '0 16px', minHeight: 60, borderBottom: '1px solid #1F1F1F', background: '#141414', flexShrink: 0, gap: 12 }
  }, children);
}`;

export const DEFAULT_HOMESEARCH_SOURCE = `function Component() {
  var tabState = useComponentState('activeTab', 'chats');
  var activeTab = tabState[0];
  var q = useComponentState('searchQuery', '');
  var value = q[0];
  var setValue = q[1];
  return React.createElement('div', {
    style: { padding: '10px 16px', borderBottom: '1px solid #1F1F1F', background: '#141414', flexShrink: 0 }
  }, React.createElement('input', {
    autoFocus: true,
    value: value,
    onChange: function(e) { setValue(e.target.value); },
    onKeyDown: function(e) { if (e.key === 'Escape' && typeof onClose === 'function') onClose(); },
    placeholder: activeTab === 'communities' ? 'Search communities...' : 'Search chats...',
    style: { width: '100%', background: 'rgba(255,255,255,0.05)', borderRadius: 999, padding: '9px 16px', fontSize: 14, color: '#E8E8E8', border: '1px solid rgba(255,255,255,0.08)', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }
  }));
}`;

export const DEFAULT_BOTTOMNAV_SOURCE = `function Component() {
  var tabState = useComponentState('activeTab', 'chats');
  var activeTab = tabState[0];
  var items = (typeof tabs !== 'undefined' && tabs) ? tabs : [];
  return React.createElement('div', {
    style: { flexShrink: 0, background: '#141414', borderTop: '1px solid #1F1F1F', display: 'flex', flexDirection: 'row', paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 8px)' }
  }, items.map(function(tab) {
    var isActive = activeTab === tab.id;
    var color = isActive ? '#2563EB' : 'rgba(255,255,255,0.4)';
    return React.createElement('button', {
      key: tab.id,
      onClick: function() { if (typeof onSelectTab === 'function') onSelectTab(tab.id); },
      style: { flex: 1, padding: '10px 0 6px', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, WebkitTapHighlightColor: 'transparent', userSelect: 'none' }
    }, [
      React.createElement('svg', { key: 'icon', width: 22, height: 22, viewBox: '0 0 24 24', fill: color }, React.createElement('path', { d: tab.path })),
      React.createElement('span', { key: 'label', style: { fontSize: 10, fontWeight: isActive ? 700 : 500, color: color, letterSpacing: 0.1 } }, tab.label)
    ]);
  }));
}`;

export const DEFAULT_SETTINGSSCREEN_SOURCE = `function Component() {
  var notifsState = useComponentState('settingsNotifsEnabled', true);
  var notifs = notifsState[0];
  var blockedState = useComponentState('settingsBlocked', []);
  var blocked = blockedState[0] || [];
  var loadingState = useComponentState('settingsBlockedLoading', false);
  var loadingBlocked = loadingState[0];
  var blockedErrState = useComponentState('settingsBlockedError', null);
  var blockedError = blockedErrState[0];
  var unblockOkState = useComponentState('settingsUnblockSuccess', null);
  var unblockSuccess = unblockOkState[0];

  var sheetState = React.useState(false); var showBlockedSheet = sheetState[0], setShowBlockedSheet = sheetState[1];
  var pwSheetState = React.useState(false); var showPasswordSheet = pwSheetState[0], setShowPasswordSheet = pwSheetState[1];
  var confirmState = React.useState(null); var confirm = confirmState[0], setConfirm = confirmState[1];
  var busyState = React.useState(false); var busy = busyState[0], setBusy = busyState[1];
  var actionErrState = React.useState(null); var actionError = actionErrState[0], setActionError = actionErrState[1];
  var newPwState = React.useState(''); var newPassword = newPwState[0], setNewPassword = newPwState[1];
  var confPwState = React.useState(''); var confirmPassword = confPwState[0], setConfirmPassword = confPwState[1];
  var pwErrState = React.useState(null); var passwordError = pwErrState[0], setPasswordError = pwErrState[1];
  var pwOkState = React.useState(false); var passwordSuccess = pwOkState[0], setPasswordSuccess = pwOkState[1];
  var pwBusyState = React.useState(false); var changingPassword = pwBusyState[0], setChangingPassword = pwBusyState[1];

  var handleOpenBlockedSheet = function() {
    setShowBlockedSheet(true);
    if (blocked.length === 0 && !loadingBlocked && typeof onLoadBlocked === 'function') onLoadBlocked();
  };
  var doUnblock = function(blockId, userId) { if (typeof onUnblock === 'function') onUnblock(blockId, userId); };
  var doLogout = function() { setBusy(true); if (typeof onLogout === 'function') onLogout(); };
  var doDelete = function() {
    setBusy(true); setActionError(null);
    if (typeof onDeleteAccount === 'function') {
      onDeleteAccount().then(function(res) {
        if (res && res.error) { setActionError(res.error); setBusy(false); }
      });
    }
  };
  var closePasswordSheet = function() {
    if (changingPassword) return;
    setShowPasswordSheet(false); setNewPassword(''); setConfirmPassword(''); setPasswordError(null); setPasswordSuccess(false);
  };
  var doChangePassword = function() {
    setPasswordError(null);
    if (!newPassword.trim()) { setPasswordError('Enter a new password.'); return; }
    if (newPassword.length < 6) { setPasswordError('Password must be at least 6 characters.'); return; }
    if (newPassword !== confirmPassword) { setPasswordError("Passwords don't match."); return; }
    setChangingPassword(true);
    if (typeof onChangePassword === 'function') {
      onChangePassword(newPassword).then(function(res) {
        setChangingPassword(false);
        if (res && res.error) { setPasswordError(res.error); return; }
        setPasswordSuccess(true); setNewPassword(''); setConfirmPassword('');
        setTimeout(function() { setPasswordSuccess(false); setShowPasswordSheet(false); }, 2000);
      });
    }
  };

  var wrap = { position: 'fixed', inset: 0, zIndex: 60, background: '#0a0a0a', display: 'flex', flexDirection: 'column', color: '#fff' };
  var header = { display: 'flex', alignItems: 'center', gap: 14, padding: 'calc(env(safe-area-inset-top) + 14px) 16px 14px', borderBottom: '1px solid #1a1a1a', flexShrink: 0 };
  var body = { flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch', padding: '0 0 40px' };
  var sectionLabel = { fontSize: 12, fontWeight: 600, color: '#4b5563', padding: '22px 20px 6px', letterSpacing: 0.2 };
  var row = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px' };
  var rowBtn = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '15px 20px', width: '100%', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' };
  var sheetOverlay = { position: 'fixed', inset: 0, zIndex: 90, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' };
  var sheetCard = { width: '100%', maxWidth: 480, background: '#161616', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: '22px 20px calc(22px + env(safe-area-inset-bottom))', boxSizing: 'border-box' };
  var chevron = String.fromCharCode(8250);

  return React.createElement('div', { style: wrap },
    React.createElement('div', { style: header },
      React.createElement('button', { onClick: onBack, 'aria-label': 'Back', style: { background: 'transparent', border: 'none', color: '#fff', fontSize: 28, lineHeight: 1, cursor: 'pointer', padding: 0, width: 26 } }, String.fromCharCode(8249)),
      React.createElement('span', { style: { fontSize: 19, fontWeight: 700 } }, 'Settings')
    ),
    React.createElement('div', { style: body },
      React.createElement('div', { style: sectionLabel }, 'Notifications'),
      React.createElement('div', { style: row },
        React.createElement('div', null,
          React.createElement('div', { style: { fontSize: 15, color: '#e5e7eb' } }, 'Push notifications'),
          React.createElement('div', { style: { fontSize: 12.5, color: '#6b7280', marginTop: 2 } }, 'New messages and mentions')
        ),
        React.createElement('button', { onClick: function() { if (typeof onToggleNotifs === 'function') onToggleNotifs(); }, 'aria-label': 'Toggle push notifications', style: { width: 50, height: 30, borderRadius: 999, border: 'none', cursor: 'pointer', padding: 3, background: notifs ? '#2563EB' : '#3a3a3a', display: 'flex', justifyContent: notifs ? 'flex-end' : 'flex-start', alignItems: 'center', flexShrink: 0 } },
          React.createElement('span', { style: { width: 24, height: 24, borderRadius: '50%', background: '#fff', display: 'block' } })
        )
      ),
      React.createElement('div', { style: sectionLabel }, 'Privacy'),
      React.createElement('button', { style: rowBtn, onClick: handleOpenBlockedSheet },
        React.createElement('div', null,
          React.createElement('div', { style: { fontSize: 15, color: '#e5e7eb' } }, 'Blocked users'),
          React.createElement('div', { style: { fontSize: 12.5, color: '#6b7280', marginTop: 2 } }, blocked.length > 0 ? (blocked.length + ' blocked') : 'No one blocked')
        ),
        React.createElement('span', { style: { fontSize: 20, color: '#555', lineHeight: 1 } }, chevron)
      ),
      React.createElement('div', { style: sectionLabel }, 'Account'),
      React.createElement('button', { style: rowBtn, onClick: function() { setShowPasswordSheet(true); } },
        React.createElement('span', { style: { fontSize: 15, color: '#e5e7eb' } }, 'Change password'),
        React.createElement('span', { style: { fontSize: 20, color: '#555', lineHeight: 1 } }, chevron)
      ),
      React.createElement('button', { style: rowBtn, onClick: function() { setConfirm('logout'); } },
        React.createElement('span', { style: { fontSize: 15, color: '#e5e7eb' } }, 'Log out'),
        React.createElement('span', { style: { fontSize: 20, color: '#555', lineHeight: 1 } }, chevron)
      ),
      React.createElement('button', { style: rowBtn, onClick: function() { setConfirm('delete'); } },
        React.createElement('span', { style: { fontSize: 15, color: '#EF4444' } }, 'Delete account'),
        React.createElement('span', { style: { fontSize: 20, color: '#555', lineHeight: 1 } }, chevron)
      )
    ),
    showBlockedSheet ? React.createElement('div', { style: sheetOverlay, onClick: function() { setShowBlockedSheet(false); } },
      React.createElement('div', { style: Object.assign({}, sheetCard, { maxHeight: '75vh', display: 'flex', flexDirection: 'column' }), onClick: function(e) { e.stopPropagation(); } },
        React.createElement('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexShrink: 0 } },
          React.createElement('span', { style: { fontSize: 18, fontWeight: 700, color: '#fff' } }, 'Blocked users'),
          React.createElement('button', { onClick: function() { setShowBlockedSheet(false); }, style: { background: 'none', border: 'none', color: '#6b7280', fontSize: 26, cursor: 'pointer', lineHeight: 1, padding: 0 } }, String.fromCharCode(215))
        ),
        React.createElement('div', { style: { overflowY: 'auto', flex: 1 } },
          loadingBlocked
            ? React.createElement('div', { style: { padding: '16px 0', color: '#6b7280', fontSize: 14 } }, String.fromCharCode(8230))
            : blockedError
            ? React.createElement('div', { style: { padding: '16px 0', color: '#EF4444', fontSize: 14 } }, blockedError)
            : blocked.length === 0
            ? React.createElement('div', { style: { padding: '16px 0', color: '#6b7280', fontSize: 14 } }, "You haven't blocked anyone.")
            : blocked.map(function(b) {
                return React.createElement('div', { key: b.blockId, style: { display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid #1a1a1a' } },
                  React.createElement('div', { style: { flexShrink: 0 } },
                    b.avatarUrl
                      ? React.createElement('img', { src: b.avatarUrl, alt: '', style: { width: 44, height: 44, borderRadius: '50%', objectFit: 'cover' } })
                      : React.createElement('div', { style: { width: 44, height: 44, borderRadius: '50%', background: '#2563EB', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 600, color: '#fff' } }, (b.name[0] || '?').toUpperCase())
                  ),
                  React.createElement('div', { style: { flex: 1, minWidth: 0 } },
                    React.createElement('div', { style: { fontSize: 15, color: '#e5e7eb', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, b.name),
                    b.username ? React.createElement('div', { style: { fontSize: 12.5, color: '#6b7280' } }, '@' + b.username) : null
                  ),
                  React.createElement('button', { onClick: function() { doUnblock(b.blockId, b.id); }, style: { background: unblockSuccess === b.id ? '#16a34a' : 'transparent', border: '1px solid ' + (unblockSuccess === b.id ? '#16a34a' : '#2a2a2a'), color: unblockSuccess === b.id ? '#fff' : '#e5e7eb', fontSize: 13, fontWeight: 600, padding: '7px 14px', borderRadius: 999, cursor: 'pointer', flexShrink: 0, marginLeft: 8, transition: 'background 0.2s, border-color 0.2s' } }, unblockSuccess === b.id ? String.fromCharCode(10003) : 'Unblock')
                );
              })
        )
      )
    ) : null,
    showPasswordSheet ? React.createElement('div', { style: sheetOverlay, onClick: closePasswordSheet },
      React.createElement('div', { style: sheetCard, onClick: function(e) { e.stopPropagation(); } },
        React.createElement('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 } },
          React.createElement('span', { style: { fontSize: 18, fontWeight: 700, color: '#fff' } }, 'Change password'),
          React.createElement('button', { onClick: closePasswordSheet, disabled: changingPassword, style: { background: 'none', border: 'none', color: '#6b7280', fontSize: 26, cursor: 'pointer', lineHeight: 1, padding: 0 } }, String.fromCharCode(215))
        ),
        passwordSuccess
          ? React.createElement('div', { style: { textAlign: 'center', padding: '24px 0' } },
              React.createElement('div', { style: { fontSize: 44, marginBottom: 12 } }, String.fromCodePoint(9989)),
              React.createElement('div', { style: { fontSize: 16, fontWeight: 600, color: '#4ade80' } }, 'Password changed!')
            )
          : React.createElement(React.Fragment, null,
              React.createElement('input', { type: 'password', placeholder: 'New password', value: newPassword, onChange: function(e) { setNewPassword(e.target.value); }, style: { width: '100%', background: '#1f1f1f', border: '1px solid #2a2a2a', borderRadius: 12, padding: '13px 16px', fontSize: 15, color: '#e5e7eb', outline: 'none', boxSizing: 'border-box', marginBottom: 12, fontFamily: 'inherit' } }),
              React.createElement('input', { type: 'password', placeholder: 'Confirm new password', value: confirmPassword, onChange: function(e) { setConfirmPassword(e.target.value); }, onKeyDown: function(e) { if (e.key === 'Enter') doChangePassword(); }, style: { width: '100%', background: '#1f1f1f', border: '1px solid #2a2a2a', borderRadius: 12, padding: '13px 16px', fontSize: 15, color: '#e5e7eb', outline: 'none', boxSizing: 'border-box', marginBottom: passwordError ? 10 : 16, fontFamily: 'inherit' } }),
              passwordError ? React.createElement('div', { style: { fontSize: 13, color: '#EF4444', marginBottom: 14 } }, passwordError) : null,
              React.createElement('button', { onClick: doChangePassword, disabled: changingPassword, style: { width: '100%', padding: 14, borderRadius: 999, background: '#2563EB', color: '#fff', fontSize: 15, fontWeight: 700, border: 'none', cursor: 'pointer', opacity: changingPassword ? 0.6 : 1 } }, changingPassword ? 'Changing' + String.fromCharCode(8230) : 'Change password')
            )
      )
    ) : null,
    confirm ? React.createElement('div', { onClick: function() { if (!busy) setConfirm(null); }, style: { position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' } },
      React.createElement('div', { onClick: function(e) { e.stopPropagation(); }, style: { width: '100%', maxWidth: 480, background: '#161616', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: '22px 20px calc(22px + env(safe-area-inset-bottom))', boxSizing: 'border-box' } },
        React.createElement('div', { style: { fontSize: 18, fontWeight: 700, marginBottom: 8 } }, confirm === 'logout' ? 'Log out?' : 'Delete account?'),
        React.createElement('div', { style: { fontSize: 14, color: '#9ca3af', lineHeight: 1.5, marginBottom: 20 } }, confirm === 'logout' ? 'You can log back in anytime.' : 'This permanently deletes your profile, your messages, and any communities you created. This cannot be undone.'),
        actionError ? React.createElement('div', { style: { fontSize: 13, color: '#EF4444', marginBottom: 12 } }, actionError) : null,
        React.createElement('div', { style: { display: 'flex', gap: 10 } },
          React.createElement('button', { onClick: function() { setConfirm(null); setActionError(null); }, disabled: busy, style: { flex: 1, padding: 12, borderRadius: 999, background: '#262626', color: '#e5e7eb', fontSize: 15, fontWeight: 600, border: 'none', cursor: 'pointer' } }, 'Cancel'),
          React.createElement('button', { onClick: confirm === 'logout' ? doLogout : doDelete, disabled: busy, style: { flex: 1, padding: 12, borderRadius: 999, background: '#dc2626', color: '#fff', fontSize: 15, fontWeight: 600, border: 'none', cursor: 'pointer' } }, busy ? String.fromCharCode(8230) : (confirm === 'logout' ? 'Log out' : 'Delete'))
        )
      )
    ) : null
  );
}`;

export const DEFAULT_CHATRECORDINGOVERLAY_SOURCE = `function Component() {
  var d = (useComponentState('chatRecordingDuration', 0)[0]) || 0;
  var mm = String(Math.floor(d / 60)); while (mm.length < 2) mm = '0' + mm;
  var ss = String(d % 60); while (ss.length < 2) ss = '0' + ss;
  return React.createElement('div', { style: { position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(10,10,10,0.97)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20 } },
    React.createElement('div', { style: { position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' } },
      React.createElement('div', { style: { position: 'absolute', width: 88, height: 88, borderRadius: '50%', background: 'rgba(239,68,68,0.25)', animation: 'pulse 1.4s ease-in-out infinite' } }),
      React.createElement('div', { style: { width: 68, height: 68, borderRadius: '50%', background: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center' } },
        React.createElement(LucideMic, { size: 30, color: '#fff' })
      )
    ),
    React.createElement('div', { style: { color: '#fff', fontSize: 36, fontWeight: 300, fontVariantNumeric: 'tabular-nums', letterSpacing: 2 } }, mm + ':' + ss),
    React.createElement('div', { style: { color: '#6b7280', fontSize: 13, letterSpacing: 0.5 } }, 'Recording voice message'),
    React.createElement('div', { style: { display: 'flex', gap: 12, marginTop: 8 } },
      React.createElement('button', { onClick: function() { if (typeof onCancel === 'function') onCancel(); }, style: { display: 'flex', alignItems: 'center', gap: 8, padding: '12px 24px', borderRadius: 999, background: '#262626', color: '#e5e7eb', fontSize: 15, fontWeight: 600, border: 'none', cursor: 'pointer' } },
        React.createElement(LucideX, { size: 18 }), 'Cancel'
      ),
      React.createElement('button', { onClick: function() { if (typeof onStop === 'function') onStop(); }, style: { display: 'flex', alignItems: 'center', gap: 8, padding: '12px 24px', borderRadius: 999, background: '#2563EB', color: '#fff', fontSize: 15, fontWeight: 600, border: 'none', cursor: 'pointer' } },
        React.createElement(LucideSquare, { size: 16, fill: '#fff' }), 'Send'
      )
    )
  );
}`;

export const DEFAULT_CHATFORWARDPICKER_SOURCE = `function Component() {
  var sState = React.useState(''); var q = sState[0], setQ = sState[1];
  var list = (contacts || []).filter(function(c) {
    if (!q.trim()) return true;
    var s = q.toLowerCase();
    return (c.name || '').toLowerCase().indexOf(s) !== -1 || (c.username || '').toLowerCase().indexOf(s) !== -1;
  });
  return React.createElement('div', { onClick: function() { if (typeof onClose === 'function') onClose(); }, style: { position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' } },
    React.createElement('div', { onClick: function(e) { e.stopPropagation(); }, style: { width: '100%', maxWidth: 480, background: '#161616', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '70vh', display: 'flex', flexDirection: 'column', paddingBottom: 'calc(16px + env(safe-area-inset-bottom))' } },
      React.createElement('div', { style: { padding: '20px 20px 12px', flexShrink: 0 } },
        React.createElement('div', { style: { fontSize: 16, fontWeight: 600, color: '#e5e7eb', marginBottom: 12 } }, 'Forward to' + String.fromCharCode(8230)),
        React.createElement('input', { autoFocus: true, value: q, onChange: function(e) { setQ(e.target.value); }, placeholder: 'Search contacts' + String.fromCharCode(8230), style: { width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '10px 14px', fontSize: 14, color: '#e8e8e8', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' } })
      ),
      React.createElement('div', { style: { flex: 1, overflowY: 'auto' } },
        list.map(function(c) {
          return React.createElement('div', { key: c.id, onClick: function() { if (typeof onSelect === 'function') onSelect(c.id); }, style: { display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px', cursor: 'pointer' } },
            c.avatarUrl
              ? React.createElement('img', { src: c.avatarUrl, alt: '', style: { width: 44, height: 44, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 } })
              : React.createElement('div', { style: { width: 44, height: 44, borderRadius: '50%', background: c.avatarColor || '#333', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700, color: '#fff', flexShrink: 0 } }, c.avatarInitials),
            React.createElement('div', { style: { minWidth: 0 } },
              React.createElement('div', { style: { fontSize: 15, color: '#e8e8e8', fontWeight: 500 } }, c.name),
              c.username ? React.createElement('div', { style: { fontSize: 12, color: '#6b7280' } }, '@' + c.username) : null
            )
          );
        })
      )
    )
  );
}`;

export const DEFAULT_CHATCONTACTPICKER_SOURCE = `function Component() {
  var sState = React.useState(''); var q = sState[0], setQ = sState[1];
  var list = (contacts || []).filter(function(c) {
    if (!q.trim()) return true;
    var s = q.toLowerCase();
    return (c.name || '').toLowerCase().indexOf(s) !== -1 || (c.username || '').toLowerCase().indexOf(s) !== -1;
  });
  return React.createElement('div', { onClick: function() { if (typeof onClose === 'function') onClose(); }, style: { position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' } },
    React.createElement('div', { onClick: function(e) { e.stopPropagation(); }, style: { width: '100%', maxWidth: 480, background: '#161616', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '70vh', display: 'flex', flexDirection: 'column', paddingBottom: 'calc(16px + env(safe-area-inset-bottom))' } },
      React.createElement('div', { style: { padding: '20px 20px 12px', flexShrink: 0 } },
        React.createElement('div', { style: { fontSize: 16, fontWeight: 600, color: '#e5e7eb', marginBottom: 12 } }, 'Share contact'),
        React.createElement('input', { autoFocus: true, value: q, onChange: function(e) { setQ(e.target.value); }, placeholder: 'Search by name or username' + String.fromCharCode(8230), style: { width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '10px 14px', fontSize: 14, color: '#e8e8e8', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' } })
      ),
      React.createElement('div', { style: { flex: 1, overflowY: 'auto' } },
        list.length === 0
          ? React.createElement('div', { style: { padding: '24px', textAlign: 'center', color: '#6b7280', fontSize: 14 } }, 'No contacts found')
          : list.map(function(c) {
              return React.createElement('div', { key: c.id, onClick: function() { if (typeof onSelect === 'function') onSelect(c.id); }, style: { display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px', cursor: 'pointer', transition: 'background 0.15s' } },
                c.avatarUrl
                  ? React.createElement('img', { src: c.avatarUrl, alt: '', style: { width: 44, height: 44, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 } })
                  : React.createElement('div', { style: { width: 44, height: 44, borderRadius: '50%', background: c.avatarColor || '#333', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700, color: '#fff', flexShrink: 0 } }, c.avatarInitials),
                React.createElement('div', { style: { minWidth: 0 } },
                  React.createElement('div', { style: { fontSize: 15, color: '#e8e8e8', fontWeight: 500 } }, c.name),
                  c.username ? React.createElement('div', { style: { fontSize: 12, color: '#6b7280' } }, '@' + c.username) : null
                )
              );
            })
      )
    )
  );
}`;

export const DEFAULT_CHATENCRYPTIONTOAST_SOURCE = `function Component() {
  return React.createElement('div', { style: { position: 'fixed', left: '50%', bottom: 'calc(80px + env(safe-area-inset-bottom))', transform: 'translateX(-50%)', zIndex: 210, background: '#92400e', color: '#fef3c7', padding: '10px 18px', borderRadius: 999, fontSize: 13, fontWeight: 500, boxShadow: '0 4px 16px rgba(0,0,0,0.4)', whiteSpace: 'nowrap', pointerEvents: 'none' } }, String.fromCodePoint(9888) + String.fromCodePoint(65039) + ' Message sent without encryption');
}`;

export const DEFAULT_CHATATTACHTOAST_SOURCE = `function Component() {
  var t = useComponentState('chatAttachToastText', null)[0];
  if (!t) return null;
  return React.createElement('div', { style: { position: 'fixed', left: '50%', bottom: 'calc(80px + env(safe-area-inset-bottom))', transform: 'translateX(-50%)', zIndex: 210, background: '#1f2937', color: '#fff', padding: '12px 18px', borderRadius: 999, fontSize: 14, fontWeight: 500, boxShadow: '0 8px 24px rgba(0,0,0,0.4)', pointerEvents: 'none', whiteSpace: 'nowrap' } }, t);
}`;
