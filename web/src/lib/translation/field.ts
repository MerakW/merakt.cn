import type { Field } from 'payload'

export const translationField: Field = {
  name: 'translationAction', type: 'ui',
  admin: { components: { Field: './components/admin/TranslationAction' } },
}
