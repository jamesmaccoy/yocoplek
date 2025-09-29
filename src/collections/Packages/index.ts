import type { CollectionConfig } from 'payload'
import { authenticated } from '../../access/authenticated'
import { adminOrSelf } from '../../access/adminOrSelf'

const Packages: CollectionConfig = {
  slug: 'packages',
  access: {
    create: authenticated,
    read: authenticated,
    update: authenticated,
    delete: authenticated,
  },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'post', 'category', 'isEnabled'],
  },
  hooks: {
    beforeChange: [
      ({ data }) => {
        // Prevent unwanted default value overrides during updates
        // Only apply defaults for new documents (no id) and when values are actually undefined
        return data
      }
    ]
  },
  fields: [
    {
      name: 'post',
      type: 'relationship',
      relationTo: 'posts',
      required: true,
      admin: { position: 'sidebar' },
    },
    { name: 'name', type: 'text', required: true },
    { name: 'description', type: 'textarea' },
    { 
      name: 'multiplier', 
      type: 'number', 
      required: false, // Changed to false to prevent forced defaults
      defaultValue: 1, 
      min: 0.1, 
      max: 3.0, 
      admin: { step: 0.01 } 
    },
    {
      name: 'features',
      type: 'array',
      fields: [{ name: 'feature', type: 'text' }],
    },
    {
      name: 'category',
      type: 'select',
      options: [
        { label: 'Standard', value: 'standard' },
        { label: 'Hosted', value: 'hosted' },
        { label: 'Add-on', value: 'addon' },
        { label: 'Special', value: 'special' },
      ],
      required: false, // Changed to false to prevent forced defaults
      defaultValue: 'standard',
    },
    {
      name: 'entitlement',
      type: 'select',
      options: [
        { label: 'Standard', value: 'standard' },
        { label: 'Pro', value: 'pro' },
      ],
      required: false,
      defaultValue: 'standard',
    },
    { 
      name: 'minNights', 
      type: 'number', 
      required: false, // Changed to false to prevent forced defaults
      defaultValue: 1, 
      min: 1 
    },
    { 
      name: 'maxNights', 
      type: 'number', 
      required: false, // Changed to false to prevent forced defaults
      defaultValue: 7, 
      min: 1 
    },
    { name: 'revenueCatId', type: 'text' },
    {
      name: 'relatedPage',
      type: 'relationship',
      relationTo: 'pages',
      required: false,
      hasMany: false,
      admin: { 
        position: 'sidebar',
        description: 'Link to a page containing sensitive information like check-in instructions or house manual'
      },
    },
    { name: 'isEnabled', type: 'checkbox', defaultValue: true },
    { name: 'baseRate', type: 'number', required: false },
  ],
}

export default Packages 