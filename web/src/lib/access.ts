import type { Access, FieldAccess, Where, PayloadRequest } from 'payload'

export const adminOnly = ({ req }: { req: PayloadRequest }): boolean => Boolean(req.user)
export const adminField: FieldAccess = ({ req }) => Boolean(req.user)
export const publishedOnly: Access = ({ req }) => req.user ? true : { _status: { equals: 'published' } }
export const visiblePublished: Access = ({ req }) => {
  if (req.user) return true
  const where: Where = {
    and: [
      { _status: { equals: 'published' } },
      { or: [
        { visibility: { equals: 'public' } },
        { and: [{ visibility: { equals: 'scheduled' } }, { publishAt: { less_than_equal: new Date().toISOString() } }] },
      ] },
    ],
  }
  return where
}

export const editingAccess = { create: adminOnly, update: adminOnly, delete: adminOnly, readVersions: adminOnly }
