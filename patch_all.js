import fs from 'fs';

// STEP A: src/lib/defaultComponents.ts
let defs = fs.readFileSync('src/lib/defaultComponents.ts', 'utf8');

const oldAvatar = `        React.createElement('div', {
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
        ),`;

const newAvatar = `        React.createElement('div', {
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
        ),`;

if (defs.includes(oldAvatar)) {
  defs = defs.replace(oldAvatar, newAvatar);
  fs.writeFileSync('src/lib/defaultComponents.ts', defs, 'utf8');
  console.log('Patched SRC A');
} else {
  console.log('Failed to find oldAvatar in src/lib/defaultComponents.ts');
}

// STEP B: src/components/ContactList.tsx
let cl = fs.readFileSync('src/components/ContactList.tsx', 'utf8');
cl = cl.replace(`interface ContactListProps {
  onContactSelect?: (contact: Contact) => void
  onTileLongPress?: (contact: Contact) => void
}`, `interface ContactListProps {
  onContactSelect?: (contact: Contact) => void
  onTileLongPress?: (contact: Contact) => void
  onContactAvatarTap?: (contact: any) => void
}`);

cl = cl.replace(`export function ContactList({ onContactSelect, onTileLongPress }: ContactListProps) {`, `export function ContactList({ onContactSelect, onTileLongPress, onContactAvatarTap }: ContactListProps) {`);

cl = cl.replace(`      storeActions={{
        contacts,
        onContactSelect: (contact: Contact) => onContactSelect?.(contact),
        onTileLongPress: (contact: Contact) => onTileLongPress?.(contact),
        useComponentState,
      }}`, `      storeActions={{
        contacts,
        onContactSelect: (contact: Contact) => onContactSelect?.(contact),
        onTileLongPress: (contact: Contact) => onTileLongPress?.(contact),
        onAvatarTap: (contact: any) => onContactAvatarTap?.(contact),
        useComponentState,
      }}`);

fs.writeFileSync('src/components/ContactList.tsx', cl, 'utf8');
console.log('Patched SRC B');

// STEP C: src/app/page.tsx
let pg = fs.readFileSync('src/app/page.tsx', 'utf8');
pg = pg.replace(`<ContactList
                  onContactSelect={(contact) => dispatchAction(interactions?.tileTap, buildHandlers(contact.id))}
                  onTileLongPress={(contact) => dispatchAction(interactions?.tileLongPress, buildHandlers(contact.id))}
                />`, `<ContactList
                  onContactSelect={(contact) => dispatchAction(interactions?.tileTap, buildHandlers(contact.id))}
                  onTileLongPress={(contact) => dispatchAction(interactions?.tileLongPress, buildHandlers(contact.id))}
                  onContactAvatarTap={(contact: any) => setContactProfileUser({ id: contact.id, display_name: contact.name, username: contact.username || null, avatar_url: contact.avatarUrl || null })}
                />`);

fs.writeFileSync('src/app/page.tsx', pg, 'utf8');
console.log('Patched SRC C');
