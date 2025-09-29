'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { useUserContext } from '@/context/UserContext'
import { Purchases } from '@revenuecat/purchases-js'

// Define types for RevenueCat
type CustomerInfo = any

type RevenueCatContextType = {
  customerInfo: CustomerInfo | null
  isLoading: boolean
  isInitialized: boolean
  error: Error | null
  refreshCustomerInfo: () => Promise<CustomerInfo | void>
  restorePurchases: () => Promise<CustomerInfo | void>
}

const RevenueCatContext = createContext<RevenueCatContextType | undefined>(undefined)

export const RevenueCatProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser } = useUserContext()
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [isInitialized, setIsInitialized] = useState<boolean>(false)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    // Only run in browser
    if (typeof window === 'undefined') return

    const initRevenueCat = async () => {
      try {
        setIsLoading(true)
        
        
        if (!process.env.NEXT_PUBLIC_REVENUECAT_PUBLIC_SDK_KEY) {
          throw new Error('RevenueCat public SDK key is not defined')
        }

        // Configure RevenueCat with the new API v2 and currency settings
        const configOptions: any = {
          apiKey: process.env.NEXT_PUBLIC_REVENUECAT_PUBLIC_SDK_KEY,
        }
        
        // Only add appUserId if we have a valid user ID
        if (currentUser?.id && currentUser.id !== '[Not provided]' && currentUser.id !== '') {
          configOptions.appUserId = String(currentUser.id)
        } else {
        }
        
        const purchases = await Purchases.configure(configOptions)
        
        // If no user ID was provided, RevenueCat will use an anonymous user
        // This is valid and should not cause errors
        
        setIsInitialized(true)

        // Only try to get customer info if user is authenticated and has valid ID
        if (!currentUser || !currentUser.id || currentUser.id === '[Not provided]' || currentUser.id === '') {
          console.log('No valid user for RevenueCat customer info')
          setCustomerInfo(null)
          setError(null)
          return
        }
        
        try {
          const info = await purchases.getCustomerInfo()
          setCustomerInfo(info)
          setError(null)
        } catch (customerInfoError) {
          console.error('Failed to get customer info:', customerInfoError)
          // Don't set this as a fatal error - just log it
          setCustomerInfo(null)
          setError(null) // Clear error since this is expected for unauthenticated users
        }
      } catch (err) {
        console.error('RevenueCat getCustomerInfo error:', err)
        setError(err instanceof Error ? err : new Error('Failed to load customer info'))
        setCustomerInfo(null)
      } finally {
        setIsLoading(false)
      }
    }

    initRevenueCat()
  }, [currentUser])

  const refreshCustomerInfo = async () => {
    if (typeof window === 'undefined') return

    try {
      setIsLoading(true)
      const purchases = await Purchases.getSharedInstance()
      const info = await purchases.getCustomerInfo()
      setCustomerInfo(info)
      return info
    } catch (err) {
      console.error('Failed to refresh customer info:', err)
      setError(err instanceof Error ? err : new Error('Unknown error refreshing customer info'))
    } finally {
      setIsLoading(false)
    }
  }

  const restorePurchases = async () => {
    if (typeof window === 'undefined') return
    
    try {
      setIsLoading(true)
      const purchases = await Purchases.getSharedInstance()
      const info = await purchases.getCustomerInfo()
      setCustomerInfo(info)
      return info
    } catch (err) {
      console.error('Failed to restore purchases:', err)
      setError(err instanceof Error ? err : new Error('Unknown error restoring purchases'))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <RevenueCatContext.Provider
      value={{
        customerInfo,
        isLoading,
        isInitialized,
        error,
        refreshCustomerInfo,
        restorePurchases,
      }}
    >
      {children}
    </RevenueCatContext.Provider>
  )
}

export const useRevenueCat = () => {
  const context = useContext(RevenueCatContext)
  if (context === undefined) {
    throw new Error('useRevenueCat must be used within a RevenueCatProvider')
  }
  return context
} 