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
  customer_description: string
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
  email: string
  name: string
  entitlements: {
    [key: string]: {
      expires_date: string | null
      product_identifier: string
      purchase_date: string
    }
  }
}

class YocoService {
  private apiKey: string
  private initialized: boolean = false
  private baseUrl: string = 'https://api.yoco.com/v1'

  constructor() {
    this.apiKey = process.env.YOCO_SECRET_KEY || process.env.YOCO_SECRET_KEY_V2 || ''
    console.log('Yoco API Key loaded:', this.apiKey ? 'Yes' : 'No', this.apiKey ? `(${this.apiKey.substring(0, 10)}...)` : '')
  }

  async initialize() {
    if (this.initialized) return

    try {
      if (!this.apiKey) {
        console.warn('Yoco API key not configured, using mock data')
        this.initialized = true
        return
      }
      
      // Skip API testing for now since the endpoints don't exist
      console.log('Yoco service initialized with API key')
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

      // For now, return mock products since the Yoco API endpoints don't exist
      console.log('Using mock Yoco products (API endpoints not available)')
      return this.getMockProducts()
    } catch (error) {
      console.error('Failed to get Yoco products:', error)
      return this.getMockProducts()
    }
  }

  private getMockProducts(): YocoProduct[] {
    return [
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
        price: 50.00,
        currency: 'ZAR',
        period: 'hour' as const,
        periodCount: 1,
        category: 'special' as const,
        features: ['VIP treatment', 'Premium amenities', 'Personal concierge'],
        isEnabled: true,
        entitlement: 'pro' as const,
        icon: '✨',
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
      const requestBody = {
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
      }

      console.log('Making Yoco API request to create payment link for product:', {
        url: `${this.baseUrl}/payment_links`,
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey.substring(0, 10)}...`,
          'Content-Type': 'application/json',
        },
        body: requestBody
      })

      const response = await fetch(`${this.baseUrl}/payment_links`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      })

      console.log('Yoco API response:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('Yoco API error response:', errorText)
        throw new Error(`Yoco API error: ${response.status} ${response.statusText} - ${errorText}`)
      }

      const paymentLink = await response.json()
      console.log('✅ Yoco payment link created successfully for product:', paymentLink.url)
      return paymentLink
      
    } catch (error) {
      console.error('Failed to create payment link:', error)
      return this.getMockPaymentLink(product, customerId, customerName)
    }
  }

  // New method to create payment link from database package
  async createPaymentLinkFromDatabasePackage(
    packageData: {
      id: string
      name: string
      description?: string
      baseRate?: number
      revenueCatId?: string
    },
    customerId: string,
    customerName: string,
    total: number
  ): Promise<YocoPaymentLink | null> {
    await this.initialize()
    
    console.log('Creating payment link for database package:', {
      packageData,
      customerId,
      customerName,
      total,
      apiKey: this.apiKey ? 'Present' : 'Missing'
    })
    
    try {
      if (!this.apiKey) {
        console.warn('Yoco API key not configured, using mock payment link')
        return this.getMockPaymentLinkFromDatabase(packageData, customerId, customerName, total)
      }

      // Create payment link via Yoco API
      const requestBody = {
        customer_reference: customerName,
        customer_description: packageData.description || packageData.name,
        order: {
          display_name: packageData.name,
          name: packageData.name,
          currency: 'ZAR',
          line_items: [{
            name: packageData.name,
            quantity: '1.00',
            unit_price: {
              amount: Math.round(total * 100), // Convert to cents
              currency: 'ZAR'
            },
            total_price: {
              amount: Math.round(total * 100), // Convert to cents
              currency: 'ZAR'
            },
            item_type: 'product'
          }]
        }
      }

      console.log('Making Yoco API request to create payment link:', {
        url: `${this.baseUrl}/payment_links`,
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey.substring(0, 10)}...`,
          'Content-Type': 'application/json',
        },
        body: requestBody
      })

      const response = await fetch(`${this.baseUrl}/payment_links`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      })

      console.log('Yoco API response:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('Yoco API error response:', errorText)
        throw new Error(`Yoco API error: ${response.status} ${response.statusText} - ${errorText}`)
      }

      const paymentLink = await response.json()
      console.log('✅ Yoco payment link created successfully:', paymentLink.url)
      return paymentLink
      
    } catch (error) {
      console.error('Failed to create payment link:', error)
      console.error('Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      })
      console.warn('Falling back to mock payment link due to API error')
      return this.getMockPaymentLinkFromDatabase(packageData, customerId, customerName, total)
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

  private getMockPaymentLinkFromDatabase(
    packageData: {
      id: string
      name: string
      description?: string
      baseRate?: number
      revenueCatId?: string
    },
    customerId: string,
    customerName: string,
    total: number
  ): YocoPaymentLink {
    return {
      id: `mock-${Date.now()}`,
      url: `https://pay.yoco.com/r/mock-${packageData.id}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      customer_description: packageData.description || packageData.name,
      customer_reference: customerName,
      order: {
        id: `order-${Date.now()}`,
        display_name: packageData.name,
        name: packageData.name,
        status: 'pending',
        currency: 'ZAR',
        amounts: {
          gross_amount: { amount: Math.round(total * 100), currency: 'ZAR' },
          net_amount: { amount: Math.round(total * 100), currency: 'ZAR' },
          tax_amount: { amount: 0, currency: 'ZAR' },
          discount_amount: { amount: 0, currency: 'ZAR' },
          tip_amount: { amount: 0, currency: 'ZAR' }
        },
        line_items: [{
          id: `item-${Date.now()}`,
          name: packageData.name,
          quantity: '1.00',
          unit_price: { amount: Math.round(total * 100), currency: 'ZAR' },
          total_price: { amount: Math.round(total * 100), currency: 'ZAR' },
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
      console.error('Failed to get payment link:', error)
      return null
    }
  }

  async getCustomerInfo(customerId: string): Promise<YocoCustomer | null> {
    await this.initialize()
    
    try {
      if (!this.apiKey) {
        console.warn('Yoco API key not configured, using mock customer info')
        return null
      }

      // For now, return null since we can't fetch customer info from the API
      console.log('Customer info fetching not implemented yet')
      return null
    } catch (error) {
      console.error('Failed to get customer info:', error)
      return null
    }
  }

  async purchasePackage(packageId: string, customerId: string, customerName: string): Promise<YocoPaymentLink | null> {
    await this.initialize()
    
    try {
      if (!this.apiKey) {
        console.warn('Yoco API key not configured, using mock payment link')
        return null
      }

      // For now, return null since we can't purchase packages from the API
      console.log('Package purchasing not implemented yet')
      return null
    } catch (error) {
      console.error('Failed to purchase package:', error)
      return null
    }
  }
}

export const yocoService = new YocoService()
export default yocoService