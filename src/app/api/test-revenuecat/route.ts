import { NextRequest, NextResponse } from 'next/server'
import { revenueCatService } from '@/lib/revenueCatService'

export async function GET(request: NextRequest) {
  try {
    // Test RevenueCat service initialization
    await revenueCatService.initialize()
    
    // Test getting products
    const products = await revenueCatService.getProducts()
    
    return NextResponse.json({
      success: true,
      message: 'RevenueCat integration is working',
      productsCount: products.length,
      products: products.map(p => ({
        id: p.id,
        title: p.title,
        price: p.price,
        category: p.category
      }))
    })
  } catch (error) {
    console.error('RevenueCat test failed:', error)
    return NextResponse.json(
      { 
        success: false,
        error: 'RevenueCat integration failed', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    )
  }
} 