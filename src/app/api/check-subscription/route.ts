import { NextRequest, NextResponse } from 'next/server'
import { Purchases, PurchasesConfig } from '@revenuecat/purchases-js'

export async function GET(request: NextRequest) {
  try {
    const authCookie = request.cookies.get('payload-token')
    if (!authCookie?.value) {
      return NextResponse.json({ hasActiveSubscription: false }, { status: 200 })
      // display pricing regardless of authentication
    }

    // Get the user ID from the auth token
    
    const token = authCookie.value
    const [header, payload, signature] = token.split('.')
    if (!payload) throw new Error('Invalid token: missing payload')
    const decodedPayload = JSON.parse(Buffer.from(payload, 'base64').toString())
    const userId = decodedPayload.id

    // Initialize RevenueCat with the Web Billing API key using new API v2
    const apiKey = process.env.NEXT_PUBLIC_REVENUECAT_PUBLIC_SDK_KEY;
    if (!apiKey) throw new Error('RevenueCat public API key is missing');
    
    const purchases = await Purchases.configure({
      apiKey: apiKey,
      appUserId: userId,
    })

    // Get customer info
    const customerInfo = await purchases.getCustomerInfo()
    
    // Extract active entitlement IDs
    const activeEntitlements = Object.keys(customerInfo.entitlements.active || {});
    const hasActiveSubscription = activeEntitlements.length > 0;
    

    // Set the RevenueCat customer ID in a cookie for cross-device sync
    const response = NextResponse.json({ 
      hasActiveSubscription,
      customerId: customerInfo.originalAppUserId,
      activeEntitlements: activeEntitlements,
    })

    // Set the RevenueCat customer ID cookie
    response.cookies.set('rc-customer-id', customerInfo.originalAppUserId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/'
    })

    // Fetch offerings
    const offerings = await purchases.getOfferings()

    return response
  } catch (error) {
    console.error('Error checking subscription:', error)
    return NextResponse.json({ 
      hasActiveSubscription: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
} 