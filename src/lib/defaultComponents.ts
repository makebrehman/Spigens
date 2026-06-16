export const DEFAULT_TOPAPPBAR_SOURCE = `
function Component() {
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
    React.createElement('button', {
      key: 'menu',
      onClick: typeof onMenuTap === 'function' ? onMenuTap : () => {},
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
    }, React.createElement(Icon, { name: 'menu', size: 20, color: '#E8E8E8' })),
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
    ])
  ]);
}
`;

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
          React.createElement(OnlineStatus, { isOnline: isOnline, lastSeen: lastSeen })
        )
      ),
      React.createElement(ProfileImage, { avatarUrl: avatarUrl, contactInitials: contactInitials, contactAvatarColor: contactAvatarColor })
    ),
    React.createElement('div', {
      className: 'chat-scrollbar-hide',
      style: { flex: 1, overflowY: 'auto', padding: '8px 0 12px', display: 'flex', flexDirection: 'column', gap: '6px', scrollbarWidth: 'none', msOverflowStyle: 'none' }
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
            var bubble = React.createElement(MessageBubble, { key: msg.id, id: msg.id, contactId: msg.contactId, content: msg.content, timestamp: msg.timestamp, isSent: msg.isSent, isRead: msg.isRead, status: msg.status });
            return separator ? React.createElement(React.Fragment, { key: 'frag-' + msg.id }, separator, bubble) : bubble;
          }),
      React.createElement('div', { ref: bottomRef })
    ),
    React.createElement(ComposerBar, { sendMessage: sendMessage, onAttach: onAttach })
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
    style: { display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '10px', padding: '12px 16px', paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 12px)', background: '#141414', borderTop: '1px solid #1F1F1F', flexShrink: 0 }
  },
    React.createElement(AttachButton, { onAttach: onAttach }),
    React.createElement('input', {
      type: 'text', value: inputText, onChange: function(e) { setInputText(e.target.value); },
      onKeyDown: function(e) {
        if (e.key === 'Enter') {
          onSend();
        }
      },
      placeholder: 'message...',
      style: { flex: 1, background: '#1E1E1E', borderRadius: '24px', padding: '10px 16px', fontSize: '15px', color: '#E8E8E8', border: 'none', outline: 'none', minWidth: 0 }
    }),
    React.createElement(SendButton, { onSend: onSend })
  );
}`;

export const DEFAULT_BACKBUTTON_SOURCE = `function Component() {
  return React.createElement('button', {
    onClick: function() { onBack && onBack(); },
    style: { background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', marginLeft: '-8px' }
  }, React.createElement(Icon, { name: 'chevron-left', size: 24, color: '#E8E8E8' }));
}`;

export const DEFAULT_PROFILEIMAGE_SOURCE = `function Component() {
  return avatarUrl
    ? React.createElement('img', { src: avatarUrl, style: { width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 } })
    : React.createElement('div', {
        style: { display: 'flex', alignItems: 'center', justifyContent: 'center', width: '40px', height: '40px', borderRadius: '50%', backgroundColor: contactAvatarColor, flexShrink: 0 }
      }, React.createElement('span', { style: { fontSize: '16px', fontWeight: '600', color: '#F3F4F6' } }, contactInitials));
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

export const DEFAULT_MESSAGEBUBBLE_SOURCE = `function Component() {
  return React.createElement('div', {
    style: {
      width: '100%', display: 'flex', flexDirection: 'row',
      padding: '4px 16px',
      justifyContent: isSent ? 'flex-end' : 'flex-start',
    }
  },
    React.createElement('div', {
      style: {
        display: 'flex', flexDirection: 'column', maxWidth: '72%',
        padding: '10px 14px',
        borderRadius: '18px',
        borderBottomRightRadius: isSent ? '4px' : '18px',
        borderBottomLeftRadius: isSent ? '18px' : '4px',
        background: isSent ? '#2563EB' : '#1E1E1E',
      }
    },
      React.createElement('div', {
        style: {
          fontSize: '15px', lineHeight: '1.4', wordBreak: 'break-word',
          color: isSent ? '#F0F0F0' : '#E8E8E8',
        }
      }, content),
      React.createElement('div', {
        style: { display: 'flex', flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', marginTop: '2px', gap: '4px' }
      },
        React.createElement('div', {
          style: { fontSize: '10px', color: isSent ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.35)' }
        }, timestamp),
        isSent ? React.createElement('div', {
          style: { fontSize: '10px', color: status === 'read' ? '#34B7F1' : 'rgba(255,255,255,0.5)' }
        }, status === 'sent' || status === 'sending' ? String.fromCharCode(10003) : String.fromCharCode(10003) + String.fromCharCode(10003)) : null
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
    (renderedContacts || []).map(function(contact, index) {
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
          style: { position: 'relative', flexShrink: 0, width: '48px', height: '48px', marginRight: '12px' }
        },
          contact.avatarUrl
            ? React.createElement('img', {
                src: contact.avatarUrl,
                style: {
                  width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover',
                  boxShadow: contact.isOnline ? '0 0 0 2px #22C55E' : 'none',
                }
              })
            : React.createElement('div', {
                style: {
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: '100%', height: '100%', borderRadius: '50%',
                  backgroundColor: contact.avatarColor,
                  boxShadow: contact.isOnline ? '0 0 0 2px #22C55E' : 'none',
                }
              }, React.createElement('span', {
                style: { fontSize: '16px', fontWeight: '600', color: '#F3F4F6' }
              }, contact.avatarInitials)),
          contact.isOnline ? React.createElement('div', {
            style: { position: 'absolute', bottom: 0, right: 0, width: '10px', height: '10px', borderRadius: '50%', background: '#22C55E' }
          }) : null
        ),
        React.createElement('div', {
          style: { display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0, marginRight: '12px', gap: '3px' }
        },
          React.createElement('div', {
            style: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '15px', fontWeight: '600', color: '#E8E8E8' }
          }, contact.name),
          React.createElement('div', {
            style: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '13px', color: '#8A8A8A' }
          }, contact.lastMessage)
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
