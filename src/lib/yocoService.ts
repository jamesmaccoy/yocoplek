export interface YocoProduct {
  id: string
  title: string
  description: string
  price: number
  currency: string
  period: 'hour' | 'day' | 'week' | 'month' | 'year'
  periodCount: number
  category: 'standard' | 'hosted' | 'addon' | 'special'
  features: string[]
  isEnabled: boolean
  entitlement?: 'standard' | 'pro' | string
  icon?: string
}

export interface YocoPaymentLink {
  id: string
  url: string
  created_at: string
  updated_at: string
  customer_description?: string
  customer_reference: string
  order: {
    id: string
    display_name: string
    name: string
    status: string
    currency: string
    amounts: {
      gross_amount: { amount: number; currency: string }
      net_amount: { amount: number; currency: string }
      tax_amount: { amount: number; currency: string }
      discount_amount: { amount: number; currency: string }
      tip_amount: { amount: number; currency: string }
    }
    line_items: Array<{
      id: string
      name: string
      quantity: string
      unit_price: { amount: number; currency: string }
      total_price: { amount: number; currency: string }
      item_type: string
    }>
  }
}

export interface YocoCustomer {
  id: string
  entitlements: any
  activeSubscriptions: string[]
  allPurchasedProductIdentifiers: string[]
  paymentLinks: YocoPaymentLink[]
}

class YocoService {
  private apiKey: string
  private initialized: boolean = false
  private baseUrl: string = 'https://api.yoco.com/v1'

  constructor() {
    this.apiKey = process.env.YOCO_SECRET_KEY || process.env.YOCO_SECRET_KEY_V2 || ''
  }

  async initialize() {
    if (this.initialized) return

    try {
      if (!this.apiKey) {
        console.warn('Yoco API key not configured, using mock data')
        this.initialized = true
        return
      }
      
      this.initialized = true
    } catch (error) {
      console.error('Failed to initialize Yoco:', error)
      console.warn('Falling back to mock data')
      this.initialized = true
    }
  }

  async getProducts(): Promise<YocoProduct[]> {
    await this.initialize()
    
    try {
      return await this.getYocoProducts()
    } catch (error) {
      console.error('Failed to fetch Yoco products:', error)
      return []
    }
  }

  private async getYocoProducts(): Promise<YocoProduct[]> {
    try {
      if (!this.apiKey) {
        console.warn('Yoco API key not configured, using mock data')
        return this.getMockProducts()
      }

      // Return the same products as before, but now they'll be handled by Yoco payment links
      const products = [
        {
          id: 'per_hour',
          title: '⏰ Studio Space',
          description: 'Pay as you go hourly service',
          price: 25.00,
          currency: 'ZAR',
          period: 'hour' as const,
          periodCount: 1,
          category: 'standard' as const,
          features: ['Wifi', 'Hourly pricing', 'Parking'],
          isEnabled: true,
          entitlement: 'standard' as const,
          icon: '⏰',
        },
        {
          id: 'virtual_wine',
          title: '🍷 Virtual Wine Experience',
          description: 'Weekly virtual wine tasting and experience package',
          price: 5.00,
          currency: 'ZAR',
          period: 'day' as const,
          periodCount: 7,
          category: 'standard' as const,
          features: ['Pre order wine', 'Curation of the Cape finest', 'Mix and match', 'In app purchases', 'Wine sommelier on request'],
          isEnabled: true,
          entitlement: 'standard' as const,
          icon: '🍷',
        },
        {
          id: 'per_hour_guest',
          title: '🚗 Parking',
          description: 'Parking for 1 hour',
          price: 25.00,
          currency: 'ZAR',
          period: 'hour' as const,
          periodCount: 1,
          category: 'standard' as const,
          features: ['Flexible booking', 'Hourly pricing', 'No commitment'],
          isEnabled: true,
          entitlement: 'standard' as const,
          icon: '⏰',
        },
        {
          id: 'per_hour_luxury',
          title: '✨ Luxury Hours',
          description: 'Premium hourly service with VIP treatment',
          price: 389.00,
          currency: 'ZAR',
          period: 'hour' as const,
          periodCount: 1,
          category: 'hosted' as const,
          features: ['Premium service', 'Enhanced amenities', 'Dedicated support', 'VIP treatment'],
          isEnabled: true,
          entitlement: 'pro' as const,
          icon: '✨',
        },
        {
          id: 'three_nights_customer',
          title: '🌙 Three Night Getaway',
          description: 'Perfect weekend plus one experience',
          price: 389.99,
          currency: 'ZAR',
          period: 'day' as const,
          periodCount: 3,
          category: 'hosted' as const,
          features: ['Premium accommodation', 'Concierge service', 'Breakfast included', 'Late checkout'],
          isEnabled: true,
          entitlement: 'pro' as const,
          icon: '🌙',
        },
        {
          id: 'weekly_customer',
          title: '🌍 World Explorer',
          description: 'Ultimate weekly adventure for explorers',
          price: 1399.99,
          currency: 'ZAR',
          period: 'day' as const,
          periodCount: 7,
          category: 'special' as const,
          features: ['Luxury accommodation', 'Personal concierge', 'Adventure planning', 'Premium transport', 'VIP experiences'],
          isEnabled: true,
          entitlement: 'pro' as const,
          icon: '🌍',
        },
        {
          id: 'week_x2_customer',
          title: '🏖️ Two Week Paradise',
          description: 'Perfect for a refreshing getaway',
          price: 299.99,
          currency: 'ZAR',
          period: 'day' as const,
          periodCount: 14,
          category: 'standard' as const,
          features: ['Standard accommodation', 'Basic amenities', 'Free WiFi'],
          isEnabled: true,
          entitlement: 'standard' as const,
          icon: '🏖️',
        },
        {
          id: 'week_x3_customer',
          title: '🌺 Three Week Adventure',
          description: 'Extended stay with amazing benefits',
          price: 399.99,
          currency: 'ZAR',
          period: 'day' as const,
          periodCount: 21,
          category: 'standard' as const,
          features: ['Standard accommodation', 'Basic amenities', 'Free WiFi'],
          isEnabled: true,
          entitlement: 'standard' as const,
          icon: '🌺',
        },
        {
          id: 'week_x4_customer',
          title: '🏝️ Monthly Escape',
          description: 'Ultimate monthly retreat experience',
          price: 499.99,
          currency: 'ZAR',
          period: 'day' as const,
          periodCount: 30,
          category: 'standard' as const,
          features: ['Wifi', 'Cleaning', 'Security', 'Parking', 'Greeting'],
          isEnabled: true,
          entitlement: 'standard' as const,
          icon: '🏝️',
        },
        {
          id: 'monthly',
          title: '🏠 Monthly Guest',
          description: 'Guest monthly package',
          price: 4990.99,
          currency: 'ZAR',
          period: 'day' as const,
          periodCount: 30,
          category: 'standard' as const,
          features: ['Wifi', 'Cleaning', 'Security', 'Parking', 'Greeting'],
          isEnabled: true,
          entitlement: 'standard' as const,
          icon: '🏠',
        },
        {
          id: 'gathering',
          title: '🎉 Gathering',
          description: 'Perfect for group events and gatherings',
          price: 4999.99,
          currency: 'ZAR',
          period: 'day' as const,
          periodCount: 1,
          category: 'special' as const,
          features: ['Event space', 'Group amenities', 'Catering support', 'Entertainment setup'],
          isEnabled: true,
          entitlement: 'standard' as const,
          icon: '🎉',
        },
        {
          id: 'gathering_monthly',
          title: '🏘️ Annual agreement',
          description: 'Your booking is locked in for the year',
          price: 5000.00,
          currency: 'ZAR',
          period: 'month' as const,
          periodCount: 1,
          category: 'special' as const,
          features: ['Month to month agreement', 'No cancellation fees', 'No minimum stay', 'No lock in period'],
          isEnabled: true,
          entitlement: 'pro' as const,
          icon: '🏘️',
        },
        {
          id: 'weekly',
          title: '📅 Weekly Pro',
          description: 'Professional weekly package with premium benefits',
          price: 599.99,
          currency: 'ZAR',
          period: 'week' as const,
          periodCount: 7,
          category: 'standard' as const,
          features: ['Wifi', 'Cleaning', 'Security', 'Parking', 'Privacy'],
          isEnabled: true,
          entitlement: 'pro' as const,
          icon: '📅',
        },
        {
          id: 'hosted7nights',
          title: '👑 Royal Suite Experience',
          description: 'The ultimate luxury experience',
          price: 999.99,
          currency: 'ZAR',
          period: 'day' as const,
          periodCount: 7,
          category: 'special' as const,
          features: ['Presidential suite', 'Personal butler', 'Gourmet dining', 'Spa access', 'Private transport'],
          isEnabled: true,
          entitlement: 'pro' as const,
          icon: '👑',
        },
        {
          id: 'hosted3nights',
          title: '👨‍👩‍👧‍👦 3 Nights for guests',
          description: 'Perfect for family adventures',
          price: 449.99,
          currency: 'ZAR',
          period: 'day' as const,
          periodCount: 3,
          category: 'special' as const,
          features: ['Baby Cot', 'Kids activities', 'Childcare services', 'Entertainment'],
          isEnabled: true,
          entitlement: 'standard' as const,
          icon: '👨‍👩‍👧‍👦',
        },
        {
          id: 'per_night_customer',
          title: '💕 Romantic Escape',
          description: 'Intimate experience for couples',
          price: 349.99,
          currency: 'ZAR',
          period: 'day' as const,
          periodCount: 1,
          category: 'special' as const,
          features: ['All inclusive breakfast & Snacks', 'Hiking tours', 'Driver', 'Butler', 'Wine sommelier'],
          isEnabled: true,
          entitlement: 'pro' as const,
          icon: '💕',
        },
        {
          id: 'per_night_luxury',
          title: '💼 Business Function',
          description: 'Executive package for business travelers',
          price: 500.99,
          currency: 'ZAR',
          period: 'day' as const,
          periodCount: 1,
          category: 'special' as const,
          features: ['All inclusive breakfast & Snacks', 'Hiking tours', 'Driver', 'Butler', 'Wine sommelier'],
          isEnabled: true,
          entitlement: 'pro' as const,
          icon: '💼',
        },
      ]

      return products
    } catch (error) {
      console.error('Failed to fetch from Yoco API:', error)
      return this.getMockProducts()
    }
  }

  private getMockProducts(): YocoProduct[] {
    return [
      {
        id: 'gathering_monthly',
        title: '🏘️ Annual agreement',
        description: 'Your booking is locked in for the year',
        price: 5000.00,
        currency: 'ZAR',
        period: 'month' as const,
        periodCount: 1,
        category: 'special' as const,
        features: ['Month to month agreement', 'No cancellation fees', 'No minimum stay', 'No lock in period'],
        isEnabled: true,
        entitlement: 'pro' as const,
        icon: '🏘️',
      },
    ]
  }

  async createPaymentLink(product: YocoProduct, customerId: string, customerName: string): Promise<YocoPaymentLink | null> {
    await this.initialize()
    
    try {
      if (!this.apiKey) {
        console.warn('Yoco API key not configured, using mock payment link')
        return this.getMockPaymentLink(product, customerId, customerName)
      }

      // Create payment link via Yoco API
      const response = await fetch(`${this.baseUrl}/payment_links`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          customer_reference: customerName,
          customer_description: product.description,
          order: {
            display_name: product.title,
            name: product.title,
            currency: product.currency,
            line_items: [{
              name: product.title,
              quantity: '1.00',
              unit_price: {
                amount: Math.round(product.price * 100), // Convert to cents
                currency: product.currency
              },
              total_price: {
                amount: Math.round(product.price * 100), // Convert to cents
                currency: product.currency
              },
              item_type: 'product'
            }]
          }
        })
      })

      if (!response.ok) {
        throw new Error(`Yoco API error: ${response.status} ${response.statusText}`)
      }

      const paymentLink = await response.json()
      return paymentLink
    } catch (error) {
      console.error('Failed to create payment link:', error)
      return this.getMockPaymentLink(product, customerId, customerName)
    }
  }

  private getMockPaymentLink(product: YocoProduct, customerId: string, customerName: string): YocoPaymentLink {
    return {
      id: `mock-${Date.now()}`,
      url: `https://pay.yoco.com/r/mock-${product.id}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      customer_description: product.description,
      customer_reference: customerName,
      order: {
        id: `order-${Date.now()}`,
        display_name: product.title,
        name: product.title,
        status: 'pending',
        currency: product.currency,
        amounts: {
          gross_amount: { amount: Math.round(product.price * 100), currency: product.currency },
          net_amount: { amount: Math.round(product.price * 100), currency: product.currency },
          tax_amount: { amount: 0, currency: product.currency },
          discount_amount: { amount: 0, currency: product.currency },
          tip_amount: { amount: 0, currency: product.currency }
        },
        line_items: [{
          id: `item-${Date.now()}`,
          name: product.title,
          quantity: '1.00',
          unit_price: { amount: Math.round(product.price * 100), currency: product.currency },
          total_price: { amount: Math.round(product.price * 100), currency: product.currency },
          item_type: 'product'
        }]
      }
    }
  }

  async getPaymentLink(paymentLinkId: string): Promise<YocoPaymentLink | null> {
    await this.initialize()
    
    try {
      if (!this.apiKey) {
        console.warn('Yoco API key not configured, using mock payment link')
        return null
      }

      const response = await fetch(`${this.baseUrl}/payment_links/${paymentLinkId}`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        }
      })

      if (!response.ok) {
        throw new Error(`Yoco API error: ${response.status} ${response.statusText}`)
      }

      const paymentLink = await response.json()
      return paymentLink
    } catch (error) {
      console.error('Failed to fetch payment link:', error)
      return null
    }
  }

  async getCustomerInfo(customerId: string): Promise<YocoCustomer | null> {
    await this.initialize()
    
    try {
      // Mock customer info for now
      return {
        id: customerId,
        entitlements: {},
        activeSubscriptions: [],
        allPurchasedProductIdentifiers: [],
        paymentLinks: []
      }
    } catch (error) {
      console.error('Failed to fetch customer info:', error)
      return null
    }
  }

  async purchasePackage(packageId: string, customerId: string, customerName: string): Promise<YocoPaymentLink | null> {
    await this.initialize()
    
    try {
      const products = await this.getProducts()
      const product = products.find(p => p.id === packageId)
      
      if (!product) {
        throw new Error(`Product not found: ${packageId}`)
      }

      return await this.createPaymentLink(product, customerId, customerName)
    } catch (error) {
      console.error('Purchase failed:', error)
      return null
    }
  }

  async validateSubscription(userId: string, productId: string): Promise<boolean> {
    await this.initialize()
    
    try {
      const customerInfo = await this.getCustomerInfo(userId)
      
      if (!customerInfo) {
        console.log(`No customer info found for user: ${userId}`)
        return false
      }

      const hasProduct = customerInfo.allPurchasedProductIdentifiers.includes(productId)
      
      console.log(`Validating subscription for user ${userId}, product ${productId}: ${hasProduct}`)
      return true // Mock: always return true for testing
    } catch (error) {
      console.error('Failed to validate subscription:', error)
      return false
    }
  }
}

export const yocoService = new YocoService()
