import type { CollectionConfig } from 'payload'

// Only the verified WebAuthn routes may access these records, including for admins.
const access = { create: () => false, read: () => false, update: () => false, delete: () => false }
export const Passkeys: CollectionConfig = {
  slug: 'passkeys', admin: { hidden: true }, access, lockDocuments: false,
  fields: [
    { name: 'user', type: 'relationship', relationTo: 'users', required: true, index: true },
    { name: 'credentialID', type: 'text', required: true, unique: true },
    { name: 'publicKey', type: 'text', required: true },
    { name: 'counter', type: 'number', required: true, min: 0 },
    { name: 'transports', type: 'json' },
    { name: 'name', type: 'text', required: true, maxLength: 80 },
    { name: 'lastUsedAt', type: 'date' },
  ],
}
export const PasskeyChallenges: CollectionConfig = {
  slug: 'passkey-challenges', admin: { hidden: true }, access, lockDocuments: false, timestamps: false,
  fields: [
    { name: 'tokenHash', type: 'text', required: true, unique: true },
    { name: 'challenge', type: 'text', required: true },
    { name: 'purpose', type: 'select', options: ['login', 'register'], required: true },
    { name: 'userID', type: 'number' },
    { name: 'expiresAt', type: 'date', required: true, index: true },
  ],
}
