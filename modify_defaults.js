import fs from 'fs';

let content = fs.readFileSync('src/lib/defaultComponents.ts', 'utf8');

const replacement1 = `export const DEFAULT_PROFILESCREEN_SOURCE = \`function Component() {
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
  var saveDisabled = usernameStatus === 'taken';

  return React.createElement('div', { style: { display: 'flex', flexDirection: 'column', height: '100%', background: '#0A0A0A', overflowY: 'auto' } },
    React.createElement('div', { style: { display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '12px', padding: '14px 16px', borderBottom: '1px solid #1F1F1F' } },
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
      React.createElement('div', { onClick: saveDisabled ? null : onSaveClick, style: { textAlign: 'center', padding: '13px', borderRadius: '999px', background: saveDisabled ? 'rgba(255,255,255,0.08)' : justSaved ? '#16A34A' : '#2563EB', color: saveDisabled ? 'rgba(255,255,255,0.3)' : '#FFF', fontSize: '14px', fontWeight: '600', cursor: saveDisabled ? 'not-allowed' : 'pointer', userSelect: 'none', WebkitTapHighlightColor: 'transparent', transition: 'background 0.2s ease, color 0.2s ease', marginTop: '4px' } },
        justSaved ? String.fromCharCode(10003) + ' Saved' : 'Save changes'
      )
    ),
    React.createElement('div', { onClick: function() { if (typeof window !== 'undefined' && !window.confirm('Log out?')) return; if (typeof onLogout === 'function') onLogout(); }, style: { textAlign: 'center', padding: '14px', fontSize: '14px', color: '#EF4444', cursor: 'pointer', userSelect: 'none', WebkitTapHighlightColor: 'transparent', marginTop: '32px', marginBottom: '24px' } }, 'Log out')
  );
}\`;`;

const replacement2 = `export const DEFAULT_COMMUNITYPROFILESCREEN_SOURCE = \`function Component() {
  var profileState = useComponentState('communityProfileData', null);
  var profileData = profileState[0];
  var membersState = useComponentState('communityProfileMembers', []);
  var members = membersState[0];
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
    var bg = st === 'idle' ? (opts.danger ? 'transparent' : '#2563EB') : st === 'loading' ? 'rgba(255,255,255,0.08)' : st === 'success' ? '#16A34A' : 'rgba(239,68,68,0.12)';
    var clr = st === 'idle' ? (opts.danger ? '#EF4444' : '#FFF') : st === 'loading' ? 'rgba(255,255,255,0.35)' : '#FFF';
    var bdr = st === 'idle' && opts.danger ? '1px solid rgba(239,68,68,0.3)' : 'none';
    return React.createElement('div', { onClick: st === 'idle' ? opts.onClick : undefined, style: { textAlign: 'center', padding: '13px 20px', borderRadius: '999px', background: bg, color: clr, border: bdr, fontSize: '14px', fontWeight: '600', cursor: st === 'idle' ? 'pointer' : 'default', userSelect: 'none', WebkitTapHighlightColor: 'transparent', opacity: st === 'loading' ? 0.75 : 1, transition: 'background 0.25s ease, color 0.2s ease, opacity 0.2s ease', boxSizing: 'border-box', width: '100%' } }, st === 'loading' ? (opts.loadingLabel || '...') : opts.label);
  };
  React.useEffect(function() {
    if (profileData) { setEditName(profileData.name || ''); setEditDesc(profileData.description || ''); }
  }, [profileData]);
  return React.createElement('div', { style: { display: 'flex', flexDirection: 'column', height: '100%', background: '#0A0A0A', overflowY: 'auto' } },
    React.createElement('div', { style: { display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '12px', padding: '14px 16px', borderBottom: '1px solid #1F1F1F', background: '#141414', flexShrink: 0 } },
      React.createElement(BackButton, { onBack: onBack }),
      React.createElement('div', { style: { flex: 1, fontSize: '17px', fontWeight: '600', color: '#F3F4F6' } }, 'Community Info'),
      canEdit && !editMode && !transferMode ? React.createElement('div', { onClick: function() { setEditName(community.name || ''); setEditDesc(community.description || ''); setEditMode(true); }, style: { fontSize: '13px', color: '#60A5FA', cursor: 'pointer', padding: '4px 8px', userSelect: 'none', WebkitTapHighlightColor: 'transparent' } }, 'Edit') : null
    ),
    React.createElement('div', { style: { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '32px 20px 20px', gap: '12px' } },
      React.createElement('input', { ref: imgInputRef, type: 'file', accept: 'image/*', style: { display: 'none' }, onChange: function(e) { var file = e.target.files && e.target.files[0]; if (!file) return; if (typeof onUpdateCommunityImage === 'function') onUpdateCommunityImage(file); e.target.value = ''; } }),
      React.createElement('div', { style: { position: 'relative', width: '96px', height: '96px', flexShrink: 0 } },
        React.createElement('div', { onClick: canEdit ? function() { if (!imageUploading && imgInputRef.current) imgInputRef.current.click(); } : undefined, style: { width: '96px', height: '96px', borderRadius: '24px', background: '#1A1A1A', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', cursor: canEdit && !imageUploading ? 'pointer' : 'default', WebkitTapHighlightColor: 'transparent', opacity: imageUploading ? 0.5 : 1, transition: 'opacity 0.2s' } },
          community.avatar_url ? React.createElement('img', { src: community.avatar_url, style: { width: '100%', height: '100%', objectFit: 'cover' } }) : React.createElement('span', { style: { fontSize: '36px', fontWeight: '700', color: '#E8E8E8' } }, (community.name || '?').charAt(0).toUpperCase())
        ),
        imageUploading ? React.createElement('div', { style: { position: 'absolute', inset: 0, borderRadius: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' } },
          React.createElement('div', { style: { width: '22px', height: '22px', borderRadius: '50%', border: '2px solid rgba(255,255,255,0.15)', borderTopColor: '#FFF', animation: 'spin 0.7s linear infinite' } })
        ) : (canEdit ? React.createElement('div', { style: { position: 'absolute', bottom: '-4px', right: '-4px', width: '26px', height: '26px', borderRadius: '50%', background: '#2563EB', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #0A0A0A', pointerEvents: 'none' } }, React.createElement('span', { style: { fontSize: '11px', color: '#FFF' } }, String.fromCharCode(9998))) : null)
      ),
      imageUploading ? React.createElement('div', { style: { fontSize: '11px', color: 'rgba(255,255,255,0.4)' } }, 'Uploading photo...') : null,
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
      pillBtn({ label: 'Save changes', loadingLabel: 'Saving...', status: saveEditStatus, onClick: function() { setSaveEditStatus('loading'); if (typeof onSaveEdit === 'function') { onSaveEdit(editName.trim(), editDesc.trim()); } setTimeout(function() { setSaveEditStatus('success'); setTimeout(function() { setSaveEditStatus('idle'); setEditMode(false); }, 700); }, 500); } }),
      React.createElement('div', { onClick: function() { setEditMode(false); }, style: { textAlign: 'center', padding: '10px', fontSize: '13px', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', userSelect: 'none', WebkitTapHighlightColor: 'transparent' } }, 'Cancel')
    ) : null,
    !editMode && members.length > 0 ? React.createElement('div', { style: { margin: '0 16px 16px' } },
      React.createElement('div', { style: { fontSize: '12px', color: 'rgba(255,255,255,0.35)', fontWeight: '600', marginBottom: '10px', paddingLeft: '2px' } }, transferMode ? 'Select the new Admin:' : (members.length + ' Members')),
      members.map(function(m) {
        var rl = roleLabel(m.role);
        var canRemove = !transferMode && (userRole === 'owner' || userRole === 'admin') && m.user_id !== currentUserId && m.role !== 'owner';
        var canAppoint = transferMode && m.role !== 'owner' && m.user_id !== currentUserId;
        return React.createElement('div', { key: m.user_id, style: { display: 'flex', flexDirection: 'row', alignItems: 'center', padding: '10px 0', gap: '10px', borderBottom: '1px solid rgba(255,255,255,0.04)' } },
          React.createElement('div', { onClick: function(e) { e.stopPropagation(); if (typeof onViewMemberProfile === 'function') onViewMemberProfile(m.user_id, m.display_name, m.username, m.avatar_url); }, style: { flexShrink: 0, cursor: 'pointer', WebkitTapHighlightColor: 'transparent' } },
            React.createElement(ProfileImage, { avatarUrl: m.avatar_url || null, contactInitials: (m.display_name || m.username || '?').charAt(0).toUpperCase(), contactAvatarColor: '#2563EB', size: 38 })
          ),
          React.createElement('div', { onClick: function() { if (typeof onStartDMWithUser === 'function') onStartDMWithUser(m.user_id, m.display_name, m.username, m.avatar_url); }, style: { flex: 1, minWidth: 0, cursor: 'pointer', WebkitTapHighlightColor: 'transparent' } },
            React.createElement('div', { style: { fontSize: '14px', fontWeight: '500', color: '#E8E8E8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, m.display_name || m.username || 'Unknown'),
            m.username ? React.createElement('div', { style: { fontSize: '11px', color: 'rgba(255,255,255,0.35)' } }, '@' + m.username) : null
          ),
          canAppoint ? React.createElement('div', { onClick: function(e) { e.stopPropagation(); if (typeof onTransferOwnership === 'function') onTransferOwnership(m.user_id, m.display_name || m.username || 'this member'); }, style: { padding: '5px 12px', borderRadius: '999px', background: '#2563EB', color: '#FFF', fontSize: '12px', fontWeight: '600', cursor: 'pointer', flexShrink: 0, userSelect: 'none', WebkitTapHighlightColor: 'transparent', transition: 'opacity 0.2s' } }, 'Appoint') :
          canRemove ? React.createElement('div', { onClick: function(e) { e.stopPropagation(); if (typeof onRemoveMember === 'function') onRemoveMember(m.user_id, m.display_name || m.username || 'this member'); }, style: { padding: '4px 10px', borderRadius: '999px', border: '1px solid rgba(239,68,68,0.25)', color: '#EF4444', fontSize: '11px', cursor: 'pointer', flexShrink: 0, userSelect: 'none', WebkitTapHighlightColor: 'transparent' } }, 'Remove') :
          rl ? React.createElement('span', { style: { fontSize: '10px', fontWeight: '600', padding: '2px 6px', borderRadius: '4px', background: 'rgba(37,99,235,0.18)', color: '#60A5FA' } }, rl) : null
        );
      })
    ) : null,
    !editMode && !transferMode ? React.createElement('div', { style: { padding: '4px 16px 36px', display: 'flex', flexDirection: 'column', gap: '10px' } },
      !isMember ? pillBtn({ label: community.type === 'protected' ? 'Request to join' : 'Join community', loadingLabel: community.type === 'protected' ? 'Requesting...' : 'Joining...', status: joinStatus, onClick: function() { setJoinStatus('loading'); if (community.type === 'protected') { if (typeof onRequest === 'function') onRequest(); setTimeout(function(){ setJoinStatus('idle'); }, 1200); } else { if (typeof onJoin === 'function') onJoin(); setTimeout(function(){ setJoinStatus('success'); }, 600); } } }) : null,
      isMember && userRole === 'owner' ? React.createElement('div', { onClick: function() { setTransferMode(true); }, style: { textAlign: 'center', padding: '13px', borderRadius: '999px', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.5)', fontSize: '14px', fontWeight: '600', cursor: 'pointer', userSelect: 'none', WebkitTapHighlightColor: 'transparent', transition: 'opacity 0.2s' } }, 'Transfer Admin') : null,
      isMember && userRole !== 'owner' ? pillBtn({ label: 'Leave community', loadingLabel: 'Leaving...', status: leaveStatus, danger: true, onClick: function() { setLeaveStatus('loading'); if (typeof onLeave === 'function') onLeave(); } }) : null,
      isMember && userRole === 'owner' ? pillBtn({ label: 'Delete community', loadingLabel: 'Deleting...', status: deleteStatus, danger: true, onClick: function() { setDeleteStatus('loading'); if (typeof onDeleteCommunity === 'function') onDeleteCommunity(); } }) : null
    ) : (!editMode && transferMode ? React.createElement('div', { style: { padding: '4px 16px 36px' } },
      React.createElement('div', { onClick: function() { setTransferMode(false); }, style: { textAlign: 'center', padding: '11px', borderRadius: '999px', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.4)', fontSize: '13px', cursor: 'pointer', userSelect: 'none', WebkitTapHighlightColor: 'transparent' } }, 'Cancel')
    ) : null)
  );
}\`;`;

const replacement3 = `export const DEFAULT_COMMUNITYCHATSCREEN_SOURCE = \`function Component() {
  var msgsState = useComponentState('communityMessages', []);
  var messages = msgsState[0];
  var inputState = React.useState(''); var inputValue = inputState[0], setInputValue = inputState[1];
  var joinStatusState = useComponentState('communityJoinStatus', 'non-member');
  var joinStatus = joinStatusState[0];
  var otherTypingState = useComponentState('communityOtherTyping', false);
  var otherTyping = otherTypingState[0];
  var canPost = joinStatus === 'member';
  var isJoining = joinStatus === 'loading' || joinStatus === 'requesting';
  var endRef = React.useRef(null);
  React.useEffect(function() { if (endRef.current) endRef.current.scrollIntoView({ behavior: 'auto' }); }, [messages]);
  var onSend = function() { var txt = inputValue && inputValue.trim(); if (!txt) return; if (typeof sendMessage === 'function') sendMessage(txt); setInputValue(''); };
  var joinLabel = isJoining ? 'Joining...' : joinStatus === 'requested' ? 'Request sent' : communityType === 'protected' ? 'Request to join ' + communityName : 'Join ' + communityName;
  return React.createElement('div', { style: { display: 'flex', flexDirection: 'column', height: '100%', background: '#0A0A0A' } },
    React.createElement('div', { style: { display: 'flex', flexDirection: 'row', alignItems: 'center', padding: '0 16px', borderBottom: '1px solid #1F1F1F', background: '#141414', flexShrink: 0, minHeight: '60px', gap: '10px' } },
      React.createElement(BackButton, { onBack: onBack }),
      React.createElement('div', { onClick: function() { if (typeof onViewCommunityProfile === 'function') onViewCommunityProfile(); }, style: { width: '36px', height: '36px', borderRadius: '10px', background: '#1A1A1A', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', cursor: 'pointer', WebkitTapHighlightColor: 'transparent' } },
        communityAvatarUrl ? React.createElement('img', { src: communityAvatarUrl, style: { width: '100%', height: '100%', objectFit: 'cover' } }) : React.createElement('span', { style: { fontSize: '16px', fontWeight: '700', color: '#E8E8E8' } }, (communityName || '?').charAt(0).toUpperCase())
      ),
      React.createElement('div', { onClick: function() { if (typeof onViewCommunityProfile === 'function') onViewCommunityProfile(); }, style: { flex: 1, minWidth: 0, cursor: 'pointer', WebkitTapHighlightColor: 'transparent' } },
        React.createElement('div', { style: { fontSize: '15px', fontWeight: '700', color: '#F3F4F6', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, communityName),
        otherTyping ? React.createElement('div', { style: { fontSize: '11px', color: '#60A5FA', fontStyle: 'italic' } }, 'typing...') : React.createElement('div', { style: { fontSize: '11px', color: 'rgba(255,255,255,0.35)' } }, (memberCount || 0) + ' members')
      )
    ),
    React.createElement('div', { style: { flex: 1, overflowY: 'auto', padding: '8px 0', display: 'flex', flexDirection: 'column' } },
      messages.length === 0 ? React.createElement('div', { style: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.25)', gap: '10px', padding: '32px', textAlign: 'center' } },
        React.createElement('div', { style: { fontSize: '40px' } }, String.fromCharCode(128101)),
        React.createElement('div', { style: { fontSize: '14px', fontWeight: '600' } }, 'No messages yet'),
        React.createElement('div', { style: { fontSize: '12px' } }, canPost ? 'Be the first to say something!' : 'Join to start chatting')
      ) : messages.map(function(msg) { return React.createElement(CommunityMessageBubble, { key: msg.id, id: msg.id, content: msg.content, timestamp: msg.timestamp, isMine: msg.isMine, senderName: msg.senderName, senderAvatar: msg.senderAvatar, senderInitials: msg.senderInitials }); }),
      React.createElement('div', { ref: endRef })
    ),
    canPost ? React.createElement('div', { style: { display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '10px', padding: '10px 16px', paddingBottom: 'calc(env(safe-area-inset-bottom,0px) + 10px)', borderTop: '1px solid #1F1F1F', background: '#141414', flexShrink: 0 } },
      React.createElement('input', { type: 'text', value: inputValue, onChange: function(e) { setInputValue(e.target.value); if (typeof onTyping === 'function') onTyping(); }, onKeyDown: function(e) { if (e.key === 'Enter') onSend(); }, placeholder: 'Message ' + communityName + '...', style: { flex: 1, background: '#1E1E1E', borderRadius: '24px', padding: '10px 16px', fontSize: '15px', color: '#E8E8E8', border: 'none', outline: 'none', minWidth: 0 } }),
      React.createElement('div', { onClick: onSend, style: { width: '38px', height: '38px', borderRadius: '50%', background: inputValue && inputValue.trim() ? '#2563EB' : 'rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, userSelect: 'none', WebkitTapHighlightColor: 'transparent', transition: 'background 0.2s' } }, React.createElement('span', { style: { fontSize: '16px', color: '#FFF' } }, String.fromCharCode(10148)))
    ) : React.createElement('div', { style: { padding: '12px 16px', paddingBottom: 'calc(env(safe-area-inset-bottom,0px) + 12px)', borderTop: '1px solid #1F1F1F', background: '#141414', flexShrink: 0 } },
      React.createElement('div', {
        onClick: function() { if (isJoining || joinStatus === 'requested') return; if (communityType === 'protected') { if (typeof onRequest === 'function') onRequest(); } else { if (typeof onJoin === 'function') onJoin(); } },
        style: { textAlign: 'center', padding: '13px', borderRadius: '999px', background: isJoining || joinStatus === 'requested' ? 'rgba(255,255,255,0.08)' : '#2563EB', color: isJoining || joinStatus === 'requested' ? 'rgba(255,255,255,0.4)' : '#FFF', fontSize: '15px', fontWeight: '600', cursor: isJoining || joinStatus === 'requested' ? 'default' : 'pointer', userSelect: 'none', WebkitTapHighlightColor: 'transparent', transition: 'background 0.25s ease, color 0.2s ease' }
      }, joinLabel)
    )
  );
}\`;`;

const startIndex1 = content.indexOf('export const DEFAULT_PROFILESCREEN_SOURCE');
const endIndex1 = content.indexOf('};', startIndex1) + 2;

const startIndex2 = content.indexOf('export const DEFAULT_COMMUNITYCHATSCREEN_SOURCE');
const endIndex2 = content.indexOf('};', startIndex2) + 2;

const startIndex3 = content.indexOf('export const DEFAULT_COMMUNITYPROFILESCREEN_SOURCE');
const endIndex3 = content.indexOf('};', startIndex3) + 2;

content = content.substring(0, startIndex1) + replacement1 + content.substring(endIndex1);

const startIndex2New = content.indexOf('export const DEFAULT_COMMUNITYCHATSCREEN_SOURCE');
const endIndex2New = content.indexOf('};', startIndex2New) + 2;
content = content.substring(0, startIndex2New) + replacement3 + content.substring(endIndex2New);

const startIndex3New = content.indexOf('export const DEFAULT_COMMUNITYPROFILESCREEN_SOURCE');
const endIndex3New = content.indexOf('};', startIndex3New) + 2;
content = content.substring(0, startIndex3New) + replacement2 + content.substring(endIndex3New);

fs.writeFileSync('src/lib/defaultComponents.ts', content, 'utf8');
