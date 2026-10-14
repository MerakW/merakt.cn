import type { CollectionConfig } from 'payload'

export const FlightWorkerReplays: CollectionConfig = {
  slug: 'flight-worker-replays', timestamps: false, lockDocuments: false,
  admin: { hidden: true },
  access: { create: () => false, read: () => false, update: () => false, delete: () => false },
  fields: [
    { name: 'nonce', type: 'text', required: true, unique: true },
    { name: 'expiresAt', type: 'date', required: true, index: true },
  ],
}
