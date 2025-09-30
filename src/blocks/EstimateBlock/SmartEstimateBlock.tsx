'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { cn } from '@/utilities/cn'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Input } from '@/components/ui/input'
import { Bot, Send, Calendar, Package, Sparkles, Loader2 } from 'lucide-react'
import { format } from 'date-fns'
import { useUserContext } from '@/context/UserContext'
import { useSubscription } from '@/hooks/useSubscription'
import { getCustomerEntitlement, type CustomerEntitlement } from '@/utils/packageSuggestions'
import { calculateTotal } from '@/lib/calculateTotal'
import { useYoco } from '@/providers/RevenueCat'
import { yocoService, YocoProduct, YocoPaymentLink } from '@/lib/yocoService'
import { useRouter } from 'next/navigation'
import { Mic, MicOff } from 'lucide-react'

interface Package {
  id: string
  name: string
  description: string
  multiplier: number
  category: string
  entitlement?: 'standard' | 'pro'
  minNights: number
  maxNights: number
  yocoId?: string
  baseRate?: number
  isEnabled: boolean
  features: string[]
  source: 'database' | 'yoco'
}

interface Message {
  role: 'user' | 'assistant' | 'system'
  content: string
  type?: 'text' | 'package_suggestion' | 'booking_summary' | 'quick_action' | 'date_selection'
  data?: any
}

interface SmartEstimateBlockProps {
  className?: string
  postId: string
  baseRate: number
  postTitle?: string
  postDescription?: string
}

const QuickActions = ({ onAction }: { onAction: (action: string, data?: any) => void }) => (
  <div className="flex flex-wrap gap-2 mb-4">
    <Button 
      variant="outline" 
      size="sm" 
      onClick={() => onAction('select_dates')}
      className="text-xs"
    >
      <Calendar className="h-3 w-3 mr-1" />
      Select Dates
    </Button>
    <Button 
      variant="outline" 
      size="sm" 
      onClick={() => onAction('suggest_duration')}
      className="text-xs"
    >
      <Calendar className="h-3 w-3 mr-1" />
      When should I visit?
    </Button>
    <Button 
      variant="outline" 
      size="sm" 
      onClick={() => onAction('show_packages')}
      className="text-xs"
    >
      <Package className="h-3 w-3 mr-1" />
      What packages are available?
    </Button>
    <Button 
      variant="outline" 
      size="sm" 
      onClick={() => onAction('debug_packages')}
      className="text-xs"
    >
      <Package className="h-3 w-3 mr-1" />
      Debug Packages
    </Button>
    <Button 
      variant="outline" 
      size="sm" 
      onClick={() => onAction('get_recommendation')}
      className="text-xs"
    >
      <Sparkles className="h-3 w-3 mr-1" />
      Recommend something for me
    </Button>
    <Button 
      variant="outline" 
      size="sm" 
      onClick={() => onAction('check_availability')}
      className="text-xs"
    >
      <Calendar className="h-3 w-3 mr-1" />
      Check Availability
    </Button>
  </div>
)

const PackageCard = ({ 
  package: pkg, 
  duration, 
  baseRate, 
  isSelected, 
  onSelect 
}: { 
  package: Package
  duration: number
  baseRate: number
  isSelected: boolean
  onSelect: () => void 
}) => {
  const total = pkg.baseRate || calculateTotal(baseRate, duration, pkg.multiplier)
  const pricePerNight = pkg.baseRate ? baseRate : (total / duration)
  const multiplierText = pkg.baseRate 
    ? 'Fixed package price' 
    : pkg.multiplier === 1 
    ? 'Base rate' 
    : pkg.multiplier > 1 
      ? `+${((pkg.multiplier - 1) * 100).toFixed(0)}%` 
      : `-${((1 - pkg.multiplier) * 100).toFixed(0)}%`
  
  return (
    <Card 
      className={cn(
        "cursor-pointer transition-all hover:shadow-md",
        isSelected ? "border-primary bg-primary/5" : "border-border"
      )}
      onClick={onSelect}
    >
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <CardTitle className="text-lg">{pkg.name}</CardTitle>
            <CardDescription className="mt-1">{pkg.description}</CardDescription>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-primary">R{total.toFixed(0)}</div>
            <div className="text-sm text-muted-foreground">
              R{pricePerNight.toFixed(0)}/night
            </div>
            <div className="text-xs text-muted-foreground">
              {multiplierText}
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-2">
          <div className="text-xs text-muted-foreground">
            Duration: {pkg.minNights === pkg.maxNights 
              ? `${pkg.minNights} ${pkg.minNights === 1 ? 'night' : 'nights'}`
              : `${pkg.minNights}-${pkg.maxNights} nights`
            }
          </div>
          <div className="space-y-1">
            {pkg.features.slice(0, 3).map((feature, idx) => (
              <div key={idx} className="flex items-center text-sm">
                <span className="w-1.5 h-1.5 bg-primary rounded-full mr-2" />
                {typeof feature === 'string' ? feature : (feature as any).feature}
              </div>
            ))}
            {pkg.features.length > 3 && (
              <div className="text-xs text-muted-foreground">
                +{pkg.features.length - 3} more features
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export const SmartEstimateBlock: React.FC<SmartEstimateBlockProps> = ({
  className,
  postId,
  baseRate,
  postTitle = "this property",
  postDescription = ""
}) => {
  const { currentUser } = useUserContext()
  const isLoggedIn = !!currentUser
  const router = useRouter()
  const { isInitialized } = useYoco()
  
  // Session storage key for this specific post
  const sessionKey = `booking_journey_${postId}_${currentUser?.id || 'guest'}`
  
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [packages, setPackages] = useState<Package[]>([])
  const [selectedPackage, setSelectedPackage] = useState<Package | null>(null)
  const [duration, setDuration] = useState(1)
  const [startDate, setStartDate] = useState<Date | null>(null)
  const [endDate, setEndDate] = useState<Date | null>(null)
  const [isListening, setIsListening] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [micError, setMicError] = useState<string | null>(null)
  
  // Booking states
  const [isBooking, setIsBooking] = useState(false)
  const [bookingError, setBookingError] = useState<string | null>(null)
  const [offerings, setOfferings] = useState<YocoProduct[]>([])
  const [isCreatingEstimate, setIsCreatingEstimate] = useState(false)
  
  // Availability checking states
  const [unavailableDates, setUnavailableDates] = useState<string[]>([])
  const [isCheckingAvailability, setIsCheckingAvailability] = useState(false)
  const [areDatesAvailable, setAreDatesAvailable] = useState(true)
  const [availabilityError, setAvailabilityError] = useState<string | null>(null)
  
  // Latest estimate state
  const [latestEstimate, setLatestEstimate] = useState<any>(null)
  const [loadingEstimate, setLoadingEstimate] = useState(false)
  
  // Package loading state to prevent multiple API calls
  const [loadingPackages, setLoadingPackages] = useState(false)
  const [packagesLoaded, setPackagesLoaded] = useState(false)
  
  // Ref to track loading state to prevent infinite loops
  const loadingRef = useRef(false)
  const loadedRef = useRef(false)
  
  // Ref to prevent infinite loops in booking journey
  const journeyLoadedRef = useRef(false)
  
  // Debounce ref for saving booking journey
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  
  // Ref to prevent loadLatestEstimate from being called repeatedly
  const estimateLoadedRef = useRef(false)
  
  // Ref to prevent package suggestions from being triggered repeatedly
  const packagesSuggestedRef = useRef(false)
  
  // Ref to store original packages for re-filtering
  const originalPackagesRef = useRef<Package[]>([])
  
  const subscriptionStatus = useSubscription()
  const [customerEntitlement, setCustomerEntitlement] = useState<CustomerEntitlement>('none')
  
  const scrollRef = useRef<HTMLDivElement>(null)
  const recognitionRef = useRef<any>(null)
  const synthRef = useRef<SpeechSynthesis | null>(null)
  const isProcessingRef = useRef(false)
  const finalTranscriptRef = useRef('')

  // Helper function to filter packages based on customer entitlement
  // This ensures that pro-only packages are only shown to pro users
  // Also filters out addon packages which should only appear on the booking page
  const filterPackagesByEntitlement = useCallback((packages: Package[]): Package[] => {
    
    const filtered = packages.filter((pkg: Package) => {
      if (!pkg.isEnabled) {
        return false
      }
      
      // Filter out addon packages - these should only appear on the booking page
      if (pkg.category === 'addon') {
        return false
      }
      
      // 3-Tier System Implementation:
      
      // Tier 1: Non-subscribers (none) - Only see hosted/special packages (premium experience)
      if (customerEntitlement === 'none') {
        return ['hosted', 'special'].includes(pkg.category)
      }
      
      // Tier 2: Standard subscribers - See standard + hosted + special (better than non-subscribers)
      if (customerEntitlement === 'standard') {
        // Standard subscribers get more than non-subscribers
        const shouldShow = ['standard', 'hosted', 'special'].includes(pkg.category)
        
        
        return shouldShow
      }
      
      // Tier 3: Pro subscribers - See everything (all packages)
      if (customerEntitlement === 'pro') {
        return true
      }
      
      // Legacy: Filter out pro-only packages by yocoId for non-pro users
      // Only keep this for packages that don't have entitlement field in database
      if (pkg.yocoId === 'gathering_monthly' && customerEntitlement !== 'pro') {
        return false
      }
      
      return true
    })
    
    
    return filtered
  }, [customerEntitlement])

  // Load unavailable dates for the post
  const loadUnavailableDates = async () => {
    try {
      const response = await fetch(`/api/bookings/unavailable-dates?postId=${postId}`)
      if (response.ok) {
        const data = await response.json()
        setUnavailableDates(data.unavailableDates || [])
      }
    } catch (error) {
      console.error('Error loading unavailable dates:', error)
    }
  }

  // Check if selected dates are available
  const checkDateAvailability = async (fromDate: Date, toDate: Date) => {
    if (!fromDate || !toDate) return true
    
    setIsCheckingAvailability(true)
    setAvailabilityError(null)
    
    try {
      
      const response = await fetch(
        `/api/bookings/check-availability?postId=${postId}&startDate=${fromDate.toISOString()}&endDate=${toDate.toISOString()}`
      )
      
      if (response.ok) {
        const data = await response.json()
        const isAvailable = data.isAvailable
        
        setAreDatesAvailable(isAvailable)
        
        // Add a message to inform the user about availability
        if (!isAvailable) {
          const availabilityMessage: Message = {
            role: 'assistant',
            content: `I'm sorry, but the dates you selected (${format(fromDate, 'MMM dd')} to ${format(toDate, 'MMM dd, yyyy')}) are not available. Please select different dates for your stay.`,
            type: 'text'
          }
          setMessages(prev => [...prev, availabilityMessage])
        }
        
        return isAvailable
      } else {
        console.error('Availability check failed:', response.status, response.statusText)
        setAvailabilityError('Failed to check availability')
        return false
      }
    } catch (error) {
      console.error('Error checking availability:', error)
      setAvailabilityError('Failed to check availability')
      return false
    } finally {
      setIsCheckingAvailability(false)
    }
  }

  // Load latest estimate for the user
  const loadLatestEstimate = async (force: boolean = false) => {
    if (!isLoggedIn || (estimateLoadedRef.current && !force)) return
    
    try {
      estimateLoadedRef.current = true
      const response = await fetch(`/api/estimates/latest?userId=${currentUser?.id}&postId=${postId}`)
      if (response.ok) {
        const estimate = await response.json()
        if (estimate) {
          setLatestEstimate(estimate)
          
          // Pre-populate dates if available
          if (estimate.fromDate && estimate.toDate) {
            const from = new Date(estimate.fromDate)
            const to = new Date(estimate.toDate)
            const calcDuration = Math.ceil((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24))
            
            setStartDate(from)
            setEndDate(to)
            setDuration(calcDuration)
          }
        }
      }
    } catch (error) {
      console.error('Error loading latest estimate:', error)
    }
  }
  
  // Initialize booking journey on component mount
  useEffect(() => {
    const restored = loadBookingJourney()
    
    // Load unavailable dates for the post
    loadUnavailableDates()
    
    if (!restored) {
      // Load latest estimate first, then set initial message
      if (isLoggedIn) {
        loadLatestEstimate().then(() => {
          // Check if we need to set an initial message after loading estimate
          if (messages.length === 0) {
            const initialMessage: Message = {
              role: 'assistant',
              content: latestEstimate ? 
                `Welcome back! I see you have an existing estimate for ${postTitle}. I've pre-loaded your previous dates. Feel free to modify them or ask me anything about your booking.` :
                `Hi! I'm here to help you book ${postTitle}. I can help you find the perfect dates, recommend packages based on your needs, and handle your booking. What would you like to know?`,
              type: 'text'
            }
            setMessages([initialMessage])
          }
        })
      } else {
        const initialMessage: Message = {
          role: 'assistant',
          content: `Welcome to ${postTitle}! I can show you available packages and help you get started. Please log in to access the full AI booking experience and complete your reservation.`,
          type: 'text'
        }
        setMessages([initialMessage])
      }
    } else if (isLoggedIn) {
      // Even if journey was restored, still load latest estimate to sync data
      loadLatestEstimate()
    }
  }, [isLoggedIn]) // Removed postTitle and postId from dependencies to prevent infinite loops

  // Refetch latest estimate when post changes
  useEffect(() => {
    estimateLoadedRef.current = false
    if (isLoggedIn && postId) {
      loadLatestEstimate(true)
    }
  }, [postId, isLoggedIn])

  // Separate effect to handle initial message after estimate loads
  useEffect(() => {
    if (latestEstimate && messages.length === 0 && isLoggedIn && !estimateLoadedRef.current) {
      const initialMessage: Message = {
        role: 'assistant',
        content: `Welcome back! I see you have an existing estimate for ${postTitle}. I've pre-loaded your previous dates (${format(new Date(latestEstimate.fromDate), 'MMM dd')} to ${format(new Date(latestEstimate.toDate), 'MMM dd, yyyy')}). Feel free to modify them or ask me anything about your booking.`,
        type: 'text'
      }
      setMessages([initialMessage])
    }
  }, [latestEstimate, isLoggedIn]) // Removed messages.length and postTitle from dependencies

  // Save booking journey when state changes
  useEffect(() => {
    if (messages.length > 0 && !journeyLoadedRef.current) {
      saveBookingJourney()
    }
  }, [messages, selectedPackage, duration, startDate, endDate])

  // Update customer entitlement when subscription status changes
  useEffect(() => {
    const entitlement = getCustomerEntitlement(subscriptionStatus)
    setCustomerEntitlement(entitlement)
    
    // Re-filter packages when entitlement changes
    if (originalPackagesRef.current.length > 0) {
      const filtered = filterPackagesByEntitlement(originalPackagesRef.current)
      setPackages(filtered)
    }
  }, [subscriptionStatus, filterPackagesByEntitlement])

  // Load Yoco products when initialized
  useEffect(() => {
    if (isInitialized) {
      loadYocoProducts()
    }
  }, [isInitialized])

  // Initialize speech recognition and synthesis
  useEffect(() => {
    // Initialize speech recognition
    if (typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
      if (SpeechRecognition) {
        try {
          recognitionRef.current = new SpeechRecognition()
          recognitionRef.current.continuous = true
          recognitionRef.current.interimResults = true
          recognitionRef.current.lang = 'en-US'

          recognitionRef.current.onresult = async (event: any) => {
            let interimTranscript = ''
            let finalTranscript = ''

            for (let i = event.resultIndex; i < event.results.length; i++) {
              const result = event.results[i]
              if (result && result[0]) {
                const transcript = result[0].transcript
                if (result.isFinal) {
                  finalTranscript += transcript
                } else {
                  interimTranscript += transcript
                }
              }
            }

            // Update input with interim results
            setInput(interimTranscript || finalTranscript)

            // If we have a final transcript and we're not already processing
            if (finalTranscript && !isProcessingRef.current) {
              isProcessingRef.current = true
              finalTranscriptRef.current = finalTranscript
              await handleAIRequest(finalTranscript)
              isProcessingRef.current = false
            }
          }

          recognitionRef.current.onend = () => {
            if (isListening) {
              try {
                recognitionRef.current?.start()
              } catch (error) {
                console.error('Error restarting speech recognition:', error)
                setIsListening(false)
                setMicError('Error with speech recognition. Please try again.')
              }
            }
          }

          recognitionRef.current.onerror = (event: any) => {
            console.error('Speech recognition error:', event)
            setMicError('Error with speech recognition. Please try again.')
            setIsListening(false)
          }
        } catch (error) {
          console.error('Error initializing speech recognition:', error)
          setMicError('Speech recognition is not supported in your browser.')
        }
      } else {
        setMicError('Speech recognition is not supported in your browser.')
      }
    }

    // Initialize speech synthesis
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      synthRef.current = window.speechSynthesis
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop()
      }
      if (synthRef.current) {
        synthRef.current.cancel()
      }
    }
  }, [isListening])

  const startListening = () => {
    if (!recognitionRef.current) {
      setMicError('Speech recognition is not available.')
      return
    }

    try {
      setMicError(null)
      finalTranscriptRef.current = ''
      recognitionRef.current.start()
      setIsListening(true)
    } catch (error) {
      console.error('Error starting speech recognition:', error)
      setMicError('Failed to start speech recognition. Please try again.')
      setIsListening(false)
    }
  }

  const stopListening = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop()
        setIsListening(false)
      } catch (error) {
        console.error('Error stopping speech recognition:', error)
        setMicError('Error stopping speech recognition.')
      }
    }
  }

  const speak = (text: string) => {
    if (synthRef.current) {
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.onstart = () => setIsSpeaking(true)
      utterance.onend = () => {
        setIsSpeaking(false)
        // If we're still listening, restart recognition after speaking
        if (isListening && recognitionRef.current) {
          try {
            recognitionRef.current.start()
          } catch (error) {
            console.error('Error restarting speech recognition after speaking:', error)
          }
        }
      }
      synthRef.current.speak(utterance)
    }
  }

  const loadYocoProducts = async () => {
    try {
      const products = await yocoService.getProducts()
      setOfferings(products)
    } catch (err) {
      console.error('Error loading Yoco products:', err)
    }
  }

  const handleBooking = async () => {
    if (!selectedPackage || !isLoggedIn) return
    
    // Prevent booking if dates are not available or if we're still checking
    if (!areDatesAvailable || isCheckingAvailability) {
      setBookingError('Please wait for availability check to complete or select different dates.')
      return
    }
    
    // Double-check availability before proceeding with booking
    if (startDate && endDate) {
      const isAvailable = await checkDateAvailability(startDate, endDate)
      if (!isAvailable) {
        setBookingError('The selected dates are no longer available. Please choose different dates.')
        return
      }
    }
    
    setIsBooking(true)
    setBookingError(null)
    
    try {
      const total = selectedPackage.baseRate || calculateTotal(baseRate, duration, selectedPackage.multiplier)
      
      // Create estimate first
      console.log('Creating estimate with package:', {
        selectedPackage,
        packageType: selectedPackage.yocoId || selectedPackage.id,
        postId,
        total
      })
      
      const estimateData = {
        postId,
        fromDate: startDate?.toISOString() || new Date().toISOString(),
        toDate: endDate?.toISOString() || new Date(Date.now() + duration * 24 * 60 * 60 * 1000).toISOString(),
        guests: [],
        baseRate: total,
        duration,
        customer: currentUser?.id,
        packageType: selectedPackage.yocoId || selectedPackage.id,
      }
      
      const estimateResponse = await fetch('/api/estimates', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(estimateData),
      })
      
      if (!estimateResponse.ok) {
        const errorData = await estimateResponse.json()
        throw new Error(errorData.error || 'Failed to create estimate')
      }
      
      const estimate = await estimateResponse.json()
      
      console.log('Available Yoco products:', offerings.map(pkg => ({
        id: pkg.id,
        title: pkg.title
      })))
      console.log('Looking for package with yocoId:', selectedPackage.yocoId)
      console.log('Selected package details:', {
        id: selectedPackage.id,
        name: selectedPackage.name,
        yocoId: selectedPackage.yocoId,
        source: selectedPackage.source
      })
      
      // Log all available package mappings for debugging
      console.log('📋 Available package mappings:', {
        'per_night': 'per_night_customer',
        'Weekly': 'weekly_customer', 
        'week_x2_customer': 'week_x2_customer'
      })
      
      // Handle known package ID mismatches between database and Yoco
      const getYocoPackageId = (yocoId: string) => {
        const mappings: Record<string, string> = {
          'per_night': 'per_night_customer', // Database has per_night, Yoco has per_night_customer
          'Weekly': 'weekly_customer', // Database has Weekly, Yoco has weekly_customer (Standard Weekly)
          'week_x2_customer': 'week_x2_customer', // Database has week_x2_customer, Yoco has week_x2_customer
        }
        return mappings[yocoId] || yocoId
      }
      
      // Find the package in Yoco products (case-insensitive + mapping)
      const yocoProduct = offerings.find((pkg) => {
        const identifier = pkg.id
        const yocoId = selectedPackage.yocoId
        const mappedYocoId = yocoId ? getYocoPackageId(yocoId) : undefined
        
        console.log('Checking Yoco product:', {
          identifier,
          yocoId,
          mappedYocoId,
          matches: identifier === yocoId || 
                   identifier === mappedYocoId ||
                   (identifier && yocoId && identifier.toLowerCase() === yocoId.toLowerCase()) ||
                   (identifier && mappedYocoId && identifier.toLowerCase() === mappedYocoId.toLowerCase())
        })
        
        return identifier === yocoId || 
               identifier === mappedYocoId ||
               (identifier && yocoId && identifier.toLowerCase() === yocoId.toLowerCase()) ||
               (identifier && mappedYocoId && identifier.toLowerCase() === mappedYocoId.toLowerCase())
      })
      
      if (yocoProduct) {
        try {
          // Create Yoco payment link
          const paymentLink = await yocoService.createPaymentLink(
            yocoProduct,
            String(currentUser.id),
            currentUser.name || currentUser.email || 'Customer'
          )
          
          if (!paymentLink) {
            throw new Error('Failed to create payment link')
          }
          
          // Redirect to Yoco payment page
          window.location.href = paymentLink.url
          
        } catch (paymentError: any) {
          console.error('Yoco Payment Link Error:', paymentError)
          throw new Error('Payment link creation failed. Please try again.')
        }
      } else {
        // Fallback: simulate payment success and confirm estimate first
        console.log('❌ Package not found in Yoco products, using fallback payment flow')
        console.log('❌ This means the payment modal will be bypassed!')
        console.log('❌ Available products:', offerings.map(pkg => pkg.id))
        console.log('❌ Looking for:', selectedPackage.yocoId)
        console.log('❌ Mapped to:', selectedPackage.yocoId ? getYocoPackageId(selectedPackage.yocoId) : 'undefined')
        
        // Confirm the estimate with payment validation (for fallback case)
        const confirmResponse = await fetch(`/api/estimates/${estimate.id}/confirm`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            packageType: selectedPackage.yocoId || selectedPackage.id,
            baseRate: total,
            paymentValidated: true, // Mark that payment was successfully processed (fallback case)
            yocoPaymentId: new Date().toISOString() // Use current timestamp as fallback validation
          }),
        })
        
        if (!confirmResponse.ok) {
          const errorData = await confirmResponse.json()
          throw new Error(errorData.error || 'Failed to confirm estimate')
        }
        
        const confirmedEstimate = await confirmResponse.json()
        
        // Create booking record AFTER successful estimate confirmation
        await createBookingRecord()
        
        // Clear booking journey after successful booking
        clearBookingJourney()
        
        // Redirect to booking confirmation
        router.push(`/booking-confirmation?total=${total}&duration=${duration}`)
      }
      
    } catch (error) {
      console.error('Booking Error:', error)
      setBookingError(error instanceof Error ? error.message : 'An unknown error occurred')
    } finally {
      setIsBooking(false)
    }
  }

  // Create booking record in the database
  const createBookingRecord = async () => {
    if (!startDate || !endDate) {
      throw new Error('Start and end dates are required')
    }

    const bookingData = {
      postId,
      fromDate: startDate.toISOString(),
      toDate: endDate.toISOString(),
      paymentStatus: 'paid', // This will be set after successful payment validation
    }

    const bookingResponse = await fetch('/api/bookings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(bookingData),
    })

    if (!bookingResponse.ok) {
      const errorData = await bookingResponse.json()
      throw new Error(errorData.error || 'Failed to create booking')
    }

    const booking = await bookingResponse.json()
    return booking
  }

  // Navigate to estimate details (latest or create then navigate)
  const handleGoToEstimate = async () => {
    if (!isLoggedIn) {
      router.push('/login')
      return
    }
    try {
      setIsCreatingEstimate(true)
      // If we already loaded a latest estimate for this post, use it
      if (latestEstimate && (typeof latestEstimate.post === 'string' ? latestEstimate.post === postId : latestEstimate.post?.id === postId)) {
        router.push(`/estimate/${latestEstimate.id}`)
        return
      }

      // Otherwise, create a minimal estimate and navigate to it
      const from = startDate ? startDate.toISOString() : new Date().toISOString()
      const to = endDate
        ? endDate.toISOString()
        : new Date(Date.now() + (duration || 1) * 24 * 60 * 60 * 1000).toISOString()
      const multiplier = selectedPackage?.multiplier ?? 1
              const total = selectedPackage?.baseRate || calculateTotal(baseRate, duration || 1, multiplier)

      const resp = await fetch('/api/estimates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          postId,
          fromDate: from,
          toDate: to,
          guests: [],
          title: `Estimate for ${postId}`,
          packageType: selectedPackage?.yocoId || selectedPackage?.id || 'standard',
          total
        })
      })
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}))
        throw new Error(err?.error || 'Failed to create estimate')
      }
      const created = await resp.json()
      // Refresh latest estimate state for future actions
      await loadLatestEstimate(true)
      router.push(`/estimate/${created.id}`)
    } catch (e) {
      console.error('Failed navigating to estimate:', e)
    } finally {
      setIsCreatingEstimate(false)
    }
  }
  
  // Load packages - simplified to prevent infinite loops
  useEffect(() => {
    if (!loadedRef.current && !loadingRef.current) {
      loadingRef.current = true
      fetch(`/api/packages/post/${postId}`)
        .then(res => res.json())
        .then(data => {
          
          // Filter packages inline to avoid dependency issues
          const filtered = (data.packages || []).filter((pkg: Package) => {
            if (!pkg.isEnabled) return false
            
            // Filter out addon packages - these should only appear on the booking page
            if (pkg.category === 'addon') return false
            
            // 3-Tier System Implementation:
            
            // Tier 1: Non-subscribers (none) - Only see hosted/special packages (premium experience)
            if (customerEntitlement === 'none') {
              return ['hosted', 'special'].includes(pkg.category)
            }
            
            // Tier 2: Standard subscribers - See standard + hosted + special (better than non-subscribers)
            if (customerEntitlement === 'standard') {
              // Standard subscribers get more than non-subscribers
              const shouldShow = ['standard', 'hosted', 'special'].includes(pkg.category)
              
              console.log('🔍 Inline Standard subscriber package check:', {
                packageName: pkg.name,
                packageCategory: pkg.category,
                packageEntitlement: pkg.entitlement,
                shouldShow,
                reason: shouldShow ? `Package category '${pkg.category}' is available to Standard subscribers` : `Package category '${pkg.category}' is not available to Standard subscribers`
              })
              
              return shouldShow
            }
            
            // Tier 3: Pro subscribers - See everything (all packages)
            if (customerEntitlement === 'pro') {
              return true
            }
            
            // Legacy: Filter out pro-only packages for non-pro users
            // Only keep this for packages that don't have entitlement field in database
            if (pkg.yocoId === 'gathering_monthly' && customerEntitlement !== 'pro') return false
            
            return true
          })
          
          
          
          // Store original packages for re-filtering
          originalPackagesRef.current = data.packages || []
          setPackages(filtered)
          loadedRef.current = true
        })
        .catch(console.error)
        .finally(() => {
          loadingRef.current = false
        })
    }
  }, [postId, customerEntitlement])
  
  // Auto-scroll messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])
  
  const handleQuickAction = (action: string, data?: any) => {
    let message = ''
    
    switch (action) {
      case 'select_dates':
        // If dates are already populated, acknowledge them
        if (startDate && endDate) {
          const acknowledgmentMessage: Message = {
            role: 'assistant',
            content: `I see you already have dates selected: ${format(startDate, 'MMM dd')} to ${format(endDate, 'MMM dd, yyyy')} (${duration} ${duration === 1 ? 'night' : 'nights'}). You can modify them below or ask me to suggest packages for these dates.`,
            type: 'text'
          }
          setMessages(prev => [...prev, acknowledgmentMessage])
        }
        
        const dateMessage: Message = {
          role: 'assistant',
          content: startDate && endDate ? 
            'You can modify your dates below if needed:' : 
            'Please select your check-in and check-out dates:',
          type: 'date_selection'
        }
        setMessages(prev => [...prev, dateMessage])
        return
      case 'suggest_duration':
        message = `For ${postTitle}, I'd recommend considering these durations:\n\n` +
          `• 1-2 nights: Perfect for a quick getaway\n` +
          `• 3-5 nights: Ideal for a relaxing break\n` +
          `• 7+ nights: Great for a longer vacation\n\n` +
          `What duration are you thinking of? I can help you find the perfect package.`
        break
      case 'show_packages':
        if (startDate && endDate) {
          showAvailablePackages()
          return
        } else {
          message = `I'd love to show you the best packages! To give you personalized recommendations, please select your dates first using the "Select Dates" button above.`
        }
        break
      case 'get_recommendation':
        if (startDate && endDate) {
          message = `Based on your ${duration} ${duration === 1 ? 'night' : 'nights'} stay at ${postTitle}, here are my top recommendations:\n\n` +
            `• For couples: Romantic packages with premium amenities\n` +
            `• For families: Spacious options with kid-friendly features\n` +
            `• For business: Professional packages with work amenities\n\n` +
            `Let me show you the specific packages available for your dates!`
          
          const assistantMessage: Message = { role: 'assistant', content: message, type: 'text' }
          setMessages(prev => [...prev, assistantMessage])
          
          // Show packages after the recommendation message
          setTimeout(() => showAvailablePackages(), 1000)
          return
        } else {
          message = `I'd love to give you personalized recommendations! To suggest the best packages for your needs, please select your travel dates first using the "Select Dates" button above.`
        }
        break
      case 'debug_packages':
        console.log('🐛 DEBUG: Current state:', {
          packages: packages,
          packagesLength: packages.length,
          customerEntitlement,
          startDate,
          endDate,
          duration
        })
        message = `Debug info logged to console. Packages loaded: ${packages.length}, Entitlement: ${customerEntitlement}`
        break
      case 'check_availability':
        if (startDate && endDate) {
          // Check availability and provide feedback
          checkDateAvailability(startDate, endDate).then((isAvailable) => {
            const availabilityMessage: Message = {
              role: 'assistant',
              content: isAvailable ? 
                `✅ Great news! Your selected dates (${format(startDate, 'MMM dd')} to ${format(endDate, 'MMM dd, yyyy')}) are available for booking.` :
                `❌ Unfortunately, your selected dates (${format(startDate, 'MMM dd')} to ${format(endDate, 'MMM dd, yyyy')}) are not available. Please select different dates.`,
              type: 'text'
            }
            setMessages(prev => [...prev, availabilityMessage])
          })
          return
        } else {
          message = `To check availability, please select your dates first using the "Select Dates" button above.`
        }
        break
      default:
        message = 'I can help you with that! What would you like to know?'
    }
    
    const assistantMessage: Message = { role: 'assistant', content: message, type: 'text' }
    setMessages(prev => [...prev, assistantMessage])
  }

  const showAvailablePackages = () => {
    
    // Use existing packages instead of making new API calls
    if (packages.length > 0) {
      // Apply entitlement filtering first
      const filteredPackages = filterPackagesByEntitlement(packages)
      
      // Filter packages by duration if dates are selected
      let suitablePackages = filteredPackages
      if (startDate && endDate) {
        const selectedDuration = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
        setDuration(selectedDuration)
        
        // Filter packages that match the duration
        suitablePackages = filteredPackages.filter((pkg: any) => {
          return selectedDuration >= pkg.minNights && selectedDuration <= pkg.maxNights
        })
        
        // If no exact matches, include packages that can accommodate the duration
        if (suitablePackages.length === 0) {
          suitablePackages = filteredPackages.filter((pkg: any) => {
            return pkg.maxNights >= selectedDuration || pkg.maxNights === 1 // Include per-night packages
          })
        }
      }
      
      // Sort packages by relevance and select top 3
      const sortedPackages = suitablePackages.sort((a: any, b: any) => {
        
        // Prioritize packages that exactly match the duration
        const aExactMatch = startDate && endDate ? 
          (duration >= a.minNights && duration <= a.maxNights) : false
        const bExactMatch = startDate && endDate ? 
          (duration >= b.minNights && duration <= b.maxNights) : false
        
        if (aExactMatch && !bExactMatch) return -1
        if (!aExactMatch && bExactMatch) return 1
        
        // Then sort by category priority (special > hosted > standard)
        // Note: addon packages are filtered out earlier and should not appear here
        // RevenueCat packages without category field get default priority
        const categoryPriority: Record<string, number> = { special: 3, hosted: 2, standard: 1 }
        const aPriority = a.category ? categoryPriority[a.category as string] || 1 : 1
        const bPriority = b.category ? categoryPriority[b.category as string] || 1 : 1
        
        
        if (aPriority !== bPriority) return bPriority - aPriority
        
        // Finally sort by multiplier (higher first)
        return (b.multiplier || 1) - (a.multiplier || 1)
      })
      
      // Take top 3 packages
      const suggestedPackages = sortedPackages.slice(0, 3)
      
      // Create personalized message based on duration
      let message = ''
      if (startDate && endDate) {
        message = `Based on your ${duration} ${duration === 1 ? 'night' : 'nights'} stay from ${format(startDate, 'MMM dd')} to ${format(endDate, 'MMM dd, yyyy')}, here are my top 3 recommendations:`
      } else {
        message = `Here are my top 3 package recommendations for ${postTitle}:`
      }
      
      const packageMessage: Message = {
        role: 'assistant',
        content: message,
        type: 'package_suggestion',
        data: { packages: suggestedPackages }
      }
      setMessages(prev => [...prev, packageMessage])
    } else {
      // Fallback: load packages if none exist
      fetch(`/api/packages/post/${postId}`)
        .then(res => res.json())
        .then(data => {
          // Apply entitlement filtering first
          const allPackages = filterPackagesByEntitlement((data.packages || []).filter((pkg: Package) => pkg.isEnabled))
          
          // Filter packages by duration if dates are selected
          let suitablePackages = allPackages
          if (startDate && endDate) {
            const selectedDuration = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
            setDuration(selectedDuration)
            
            // Filter packages that match the duration
            suitablePackages = allPackages.filter((pkg: any) => {
              return selectedDuration >= pkg.minNights && selectedDuration <= pkg.maxNights
            })
            
            // If no exact matches, include packages that can accommodate the duration
            if (suitablePackages.length === 0) {
              suitablePackages = allPackages.filter((pkg: any) => {
                return pkg.maxNights >= selectedDuration || pkg.maxNights === 1 // Include per-night packages
              })
            }
          }
          
          // Sort packages by relevance and select top 3
          const sortedPackages = suitablePackages.sort((a: any, b: any) => {
            // Prioritize packages that exactly match the duration
            const aExactMatch = startDate && endDate ? 
              (duration >= a.minNights && duration <= a.maxNights) : false
            const bExactMatch = startDate && endDate ? 
              (duration >= b.minNights && duration <= b.maxNights) : false
            
            if (aExactMatch && !bExactMatch) return -1
            if (!aExactMatch && bExactMatch) return 1
            
            // Then sort by category priority (special > hosted > standard)
            // Note: addon packages are filtered out earlier and should not appear here
            const categoryPriority: Record<string, number> = { special: 3, hosted: 2, standard: 1 }
            const aPriority = categoryPriority[a.category as string] || 1
            const bPriority = categoryPriority[b.category as string] || 1
            
            if (aPriority !== bPriority) return bPriority - aPriority
            
            // Finally sort by multiplier (higher first)
            return (b.multiplier || 1) - (a.multiplier || 1)
          })
          
          // Take top 3 packages
          const suggestedPackages = sortedPackages.slice(0, 3)
          setPackages(suggestedPackages)
          
          // Create personalized message based on duration
          let message = ''
          if (startDate && endDate) {
            message = `Based on your ${duration} ${duration === 1 ? 'night' : 'nights'} stay from ${format(startDate, 'MMM dd')} to ${format(endDate, 'MMM dd, yyyy')}, here are my top 3 recommendations:`
          } else {
            message = `Here are my top 3 package recommendations for ${postTitle}:`
          }
          
          const packageMessage: Message = {
            role: 'assistant',
            content: message,
            type: 'package_suggestion',
            data: { packages: suggestedPackages }
          }
          setMessages(prev => [...prev, packageMessage])
        })
        .catch(err => {
          console.error('Error loading packages:', err)
          const errorMessage: Message = {
            role: 'assistant',
            content: 'Sorry, I encountered an error loading packages. Please try again.',
            type: 'text'
          }
          setMessages(prev => [...prev, errorMessage])
        })
    }
  }
  
  const handleAIRequest = async (message: string) => {
    if (!message.trim()) return
    
    const userMessage: Message = { role: 'user', content: message }
    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsLoading(true)
    
    try {
      // Check for debug packages request
      if (message.toLowerCase().includes('debug packages') || 
          message.toLowerCase().includes('debug') ||
          message.toLowerCase().includes('show packages')) {
        
        // Handle debug packages request
        try {
          const response = await fetch(`/api/packages/post/${postId}`)
          if (response.ok) {
            const data = await response.json()
            const packages = data.packages || []
            
            // Get user's subscription status for entitlement info
            const userEntitlement = currentUser?.role === 'admin' ? 'pro' : 
                                   currentUser?.subscriptionStatus?.plan || 'none'
            
            const debugInfo = `
**Debug Package Information:**
- Total packages found: ${packages.length}
- User role: ${currentUser?.role || 'guest'}
- Subscription plan: ${currentUser?.subscriptionStatus?.plan || 'none'}
- Entitlement level: ${userEntitlement}

**Available Packages:**
${packages.map((pkg: any, index: number) => 
  `${index + 1}. **${pkg.name}**
     - Category: ${pkg.category || 'N/A'}
     - Entitlement: ${pkg.entitlement || 'N/A'}
     - Enabled: ${pkg.isEnabled ? 'Yes' : 'No'}
     - Min/Max nights: ${pkg.minNights}-${pkg.maxNights}
     - Multiplier: ${pkg.multiplier}x
     - Yoco ID: ${pkg.yocoId || 'N/A'}
     - Features: ${pkg.features?.length || 0} features`
).join('\n\n')}

**Filtering Logic:**
- Non-subscribers see: hosted, special packages only
- Standard subscribers see: standard, hosted, special packages
- Pro subscribers see: all packages
- Addon packages are filtered out (booking page only)
            `
            
            const assistantMessage: Message = { 
              role: 'assistant', 
              content: debugInfo
            }
            setMessages(prev => [...prev, assistantMessage])
            speak('Here\'s the debug information for packages and entitlements.')
            setIsLoading(false)
            return
          }
        } catch (error) {
          console.error('Debug packages error:', error)
          const assistantMessage: Message = { 
            role: 'assistant', 
            content: 'Sorry, I encountered an error while fetching debug information. Please try again.'
          }
          setMessages(prev => [...prev, assistantMessage])
          setIsLoading(false)
          return
        }
      }
      
      // If user is not logged in, provide basic responses without API call
      if (!isLoggedIn) {
        let response = ''
        const lowerMessage = message.toLowerCase()
        
        if (lowerMessage.includes('package') || lowerMessage.includes('option')) {
          response = `Here are the available packages for ${postTitle}. Please log in for personalized recommendations and to complete your booking.`
          const assistantMessage: Message = { 
            role: 'assistant', 
            content: response,
            type: 'text'
          }
          setMessages(prev => [...prev, assistantMessage])
          setTimeout(() => showAvailablePackages(), 500)
        } else if (lowerMessage.includes('price') || lowerMessage.includes('cost')) {
          response = `Pricing starts at R${baseRate} per night, with different packages offering various multipliers. Log in to see personalized pricing and complete your booking.`
        } else if (lowerMessage.includes('book') || lowerMessage.includes('reserve')) {
          response = `To complete a booking, please log in first. I'll be able to help you through the entire process once you're logged in!`
        } else {
          response = `I'd love to help you with that! For the full AI assistant experience and personalized recommendations, please log in. I can show you available packages without logging in if you'd like.`
        }
        
        const assistantMessage: Message = { 
          role: 'assistant', 
          content: response,
          type: 'text'
        }
        setMessages(prev => [...prev, assistantMessage])
        setIsLoading(false)
        return
      }
      
      // For logged-in users, use the full AI API with enhanced context
      const contextString = `
Property Context:
- Title: ${postTitle}
- Description: ${postDescription}
- Base Rate: R${baseRate}
- Post ID: ${postId}

Current Booking State:
- Selected Package: ${selectedPackage?.name || 'None'}
- Duration: ${duration} ${duration === 1 ? 'night' : 'nights'}
- Start Date: ${startDate ? format(startDate, 'MMM dd, yyyy') : 'Not selected'}
- End Date: ${endDate ? format(endDate, 'MMM dd, yyyy') : 'Not selected'}
- Available Packages: ${packages.length}
- User Entitlement: ${customerEntitlement}

Availability Status:
- Are dates available: ${areDatesAvailable ? 'Yes' : 'No'}
- Currently checking availability: ${isCheckingAvailability ? 'Yes' : 'No'}
      `
      
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          message: `${contextString}\n\nUser question: ${message}`,
          context: 'smart-estimate'
        })
      })
      
      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Please log in to use the AI assistant.')
        }
        throw new Error(`Server error: ${response.status}`)
      }
      
      const data = await response.json()
      
      if (!data.message) {
        throw new Error('No response from AI assistant.')
      }
      
      const assistantMessage: Message = { 
        role: 'assistant', 
        content: data.message,
        type: 'text'
      }
      setMessages(prev => [...prev, assistantMessage])
      speak(data.message)
      
      // Check if AI suggests showing packages (with null check)
      if (data.message && typeof data.message === 'string' && 
          (data.message.toLowerCase().includes('package') || data.message.toLowerCase().includes('option'))) {
        setTimeout(() => showAvailablePackages(), 1000)
      }
      
    } catch (error) {
      console.error('Error:', error)
      const errorMessage: Message = {
        role: 'assistant',
        content: error instanceof Error ? error.message : 'Sorry, I encountered an error. Please try again or use the quick actions above.',
        type: 'text'
      }
      setMessages(prev => [...prev, errorMessage])
      speak(error instanceof Error ? error.message : 'Sorry, I encountered an error.')
    } finally {
      setIsLoading(false)
    }
  }
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    handleAIRequest(input)
  }
  
  const renderMessage = (message: Message, index: number) => {
    if (message.type === 'package_suggestion') {
      const { packages: suggestedPackages } = message.data || { packages: [] }
      return (
        <div key={index} className="space-y-4">
          <div className="bg-muted p-3 rounded-lg">
            <p className="text-sm">{message.content || 'Here are the available packages:'}</p>
          </div>
          <div className="grid gap-2">
            {suggestedPackages.map((pkg: Package) => (
              <PackageCard
                key={pkg.id}
                package={pkg}
                duration={duration}
                baseRate={baseRate}
                isSelected={selectedPackage?.id === pkg.id}
                onSelect={() => {
                  setSelectedPackage(pkg)
                  const confirmMessage: Message = {
                    role: 'assistant',
                    content: `Great choice! You've selected "${pkg.name}". This package includes: ${pkg.features.join(', ')}. Would you like to proceed with booking or do you have any questions?`,
                    type: 'text'
                  }
                  setMessages(prev => [...prev, confirmMessage])
                }}
              />
            ))}
          </div>
        </div>
      )
    }
    
    if (message.type === 'date_selection') {
      return (
        <div key={index} className="space-y-4">
          <div className="bg-muted p-3 rounded-lg">
            <p className="text-sm">{message.content}</p>
            {startDate && endDate && (
              <p className="text-xs text-muted-foreground mt-2">
                Current selection: {format(startDate, 'MMM dd')} - {format(endDate, 'MMM dd, yyyy')} ({duration} {duration === 1 ? 'night' : 'nights'})
              </p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-muted-foreground">Start Date</label>
              <Input
                type="date"
                value={startDate ? format(startDate, 'yyyy-MM-dd') : ''}
                onChange={(e) => {
                  const date = new Date(e.target.value)
                  setStartDate(date)
                  if (endDate && date > endDate) {
                    setEndDate(new Date(date.getTime() + duration * 24 * 60 * 60 * 1000))
                  }
                }}
                className="text-xs"
                min={format(new Date(), 'yyyy-MM-dd')}
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">End Date</label>
              <Input
                type="date"
                value={endDate ? format(endDate, 'yyyy-MM-dd') : ''}
                onChange={(e) => {
                  const date = new Date(e.target.value)
                  setEndDate(date)
                  if (startDate && date < startDate) {
                    setStartDate(new Date(date.getTime() - duration * 24 * 60 * 60 * 1000))
                  }
                }}
                className="text-xs"
                min={startDate ? format(startDate, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd')}
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button 
              size="sm" 
              variant="outline"
              onClick={() => {
                const today = new Date()
                const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000)
                const endDate = new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000) // 3 nights
                setStartDate(tomorrow)
                setEndDate(endDate)
                // Reset to allow new package suggestions
                packagesSuggestedRef.current = false
              }}
            >
              Quick 3 Nights
            </Button>
            <Button 
              size="sm" 
              variant="outline"
              onClick={() => {
                const today = new Date()
                const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000)
                const endDate = new Date(nextWeek.getTime() + 5 * 24 * 60 * 60 * 1000) // 5 nights
                setStartDate(nextWeek)
                setEndDate(endDate)
                // Reset to allow new package suggestions
                packagesSuggestedRef.current = false
              }}
            >
              Next Week (5 Nights)
            </Button>
            {startDate && endDate && (
              <Button 
                size="sm" 
                variant="default"
                onClick={() => {
                  const confirmMessage: Message = {
                    role: 'assistant',
                    content: `Perfect! I've confirmed your dates: ${format(startDate, 'MMM dd')} to ${format(endDate, 'MMM dd, yyyy')} (${duration} ${duration === 1 ? 'night' : 'nights'}). Let me show you the best packages for your stay!`,
                    type: 'text'
                  }
                  setMessages(prev => [...prev, confirmMessage])
                  setTimeout(() => showAvailablePackages(), 500)
                }}
              >
                Confirm Dates
              </Button>
            )}
          </div>
        </div>
      )
    }
    
    return (
      <div
        key={index}
        className={cn(
          'p-3 rounded-lg break-words max-w-[85%]',
          message.role === 'user'
            ? 'bg-primary text-primary-foreground ml-auto'
            : 'bg-muted'
        )}
      >
        <p className="text-sm" dangerouslySetInnerHTML={{ 
          __html: (message.content || 'No content').replace(/\n/g, '<br />') 
        }} />
      </div>
    )
  }
  
  // Save booking journey to session storage
  const saveBookingJourney = () => {
    if (typeof window === 'undefined') return
    
    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }
    
    // Debounce the save operation
    saveTimeoutRef.current = setTimeout(() => {
      const journeyData = {
        messages,
        selectedPackage,
        duration,
        startDate: startDate?.toISOString(),
        endDate: endDate?.toISOString(),
        timestamp: Date.now()
      }
      
      try {
        sessionStorage.setItem(sessionKey, JSON.stringify(journeyData))
        // Removed excessive logging
      } catch (error) {
        console.error('Error saving booking journey:', error)
      }
    }, 1000) // Save after 1 second of inactivity
  }

  // Load booking journey from session storage
  const loadBookingJourney = () => {
    if (typeof window === 'undefined' || journeyLoadedRef.current) return
    
    try {
      const savedData = sessionStorage.getItem(sessionKey)
      if (savedData) {
        const journeyData = JSON.parse(savedData)
        const now = Date.now()
        const oneHour = 60 * 60 * 1000 // 1 hour in milliseconds
        
        // Only restore if data is less than 1 hour old
        if (now - journeyData.timestamp < oneHour) {
          journeyLoadedRef.current = true
          
          setMessages(journeyData.messages || [])
          setSelectedPackage(journeyData.selectedPackage || null)
          setDuration(journeyData.duration || 1)
          setStartDate(journeyData.startDate ? new Date(journeyData.startDate) : null)
          setEndDate(journeyData.endDate ? new Date(journeyData.endDate) : null)
          
          // Show welcome back message if we have a selected package
          if (journeyData.selectedPackage) {
            const welcomeBackMessage: Message = {
              role: 'assistant',
              content: `Welcome back! I see you were looking at the "${journeyData.selectedPackage.name}" package. Your selected dates are ${journeyData.startDate ? format(new Date(journeyData.startDate), 'MMM dd') : 'not set'} to ${journeyData.endDate ? format(new Date(journeyData.endDate), 'MMM dd, yyyy') : 'not set'}. Would you like to continue with your booking?`,
              type: 'text'
            }
            setMessages(prev => [...prev, welcomeBackMessage])
          }
          
          return true
        } else {
          sessionStorage.removeItem(sessionKey)
        }
      }
    } catch (error) {
      console.error('Error loading booking journey:', error)
      sessionStorage.removeItem(sessionKey)
    }
    
    return false
  }

  // Clear booking journey
  const clearBookingJourney = () => {
    if (typeof window === 'undefined') return
    sessionStorage.removeItem(sessionKey)
  }
  
  // Auto-suggest packages after date selection
  const suggestPackagesAfterDateSelection = () => {
    if (startDate && endDate) {
      const suggestionMessage: Message = {
        role: 'assistant',
        content: `Great! I see you've selected ${duration} ${duration === 1 ? 'night' : 'nights'} from ${format(startDate, 'MMM dd')} to ${format(endDate, 'MMM dd, yyyy')}. Let me find the perfect packages for your stay...`,
        type: 'text'
      }
      setMessages(prev => [...prev, suggestionMessage])
      
      // Show packages after a brief delay
      setTimeout(() => {
        showAvailablePackages()
      }, 1000)
    }
  }

  // Update duration when dates change and auto-suggest packages
  useEffect(() => {
    if (startDate && endDate && !packagesSuggestedRef.current) {
      const newDuration = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
      setDuration(newDuration)
      
      // Immediately check availability for the selected dates
      // This ensures availability is checked as soon as dates are selected
      const checkAvailabilityImmediately = async () => {
        await checkDateAvailability(startDate, endDate)
      }
      checkAvailabilityImmediately()
      
      // Check if this is from pre-populated data (latestEstimate) or user selection
      if (latestEstimate && latestEstimate.fromDate && latestEstimate.toDate) {
        const estimateFrom = new Date(latestEstimate.fromDate)
        const estimateTo = new Date(latestEstimate.toDate)
        const isFromEstimate = startDate.getTime() === estimateFrom.getTime() && 
                               endDate.getTime() === estimateTo.getTime()
        
        if (isFromEstimate && messages.length > 0) {
          // This is from pre-populated estimate data, suggest packages immediately
          packagesSuggestedRef.current = true
          setTimeout(() => {
            const welcomeBackMessage: Message = {
              role: 'assistant',
              content: `I've loaded your previous booking for ${newDuration} ${newDuration === 1 ? 'night' : 'nights'} from ${format(startDate, 'MMM dd')} to ${format(endDate, 'MMM dd, yyyy')}. Here are the available packages for your stay:`,
              type: 'text'
            }
            setMessages(prev => [...prev, welcomeBackMessage])
            
            setTimeout(() => {
              showAvailablePackages()
            }, 500)
          }, 1000)
        } else {
          // This is from user interaction, use normal flow
          packagesSuggestedRef.current = true
          suggestPackagesAfterDateSelection()
        }
      } else {
        // No estimate data, use normal flow
        packagesSuggestedRef.current = true
        suggestPackagesAfterDateSelection()
      }
    }
  }, [startDate, endDate, latestEstimate]) // Removed messages.length from dependencies
  
  return (
    <Card className={cn("w-full max-w-2xl mx-auto", className)}>
      <CardHeader className="border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" />
            <CardTitle>AI Booking Assistant</CardTitle>
          </div>
          {messages.length > 1 && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => {
                clearBookingJourney()
                setMessages([{
                  role: 'assistant',
                  content: `Hi! I'm here to help you book ${postTitle}. I can help you find the perfect dates, recommend packages based on your needs, and handle your booking. What would you like to know?`,
                  type: 'text'
                }])
                setSelectedPackage(null)
                setStartDate(null)
                setEndDate(null)
                setDuration(1)
                setBookingError(null)
                // Reset refs to allow new package suggestions
                packagesSuggestedRef.current = false
                estimateLoadedRef.current = false
                journeyLoadedRef.current = false
              }}
              className="text-xs"
            >
              Start Over
            </Button>
          )}
        </div>
        <CardDescription>
          Get personalized recommendations and book your perfect stay
        </CardDescription>
      </CardHeader>
      
      <CardContent className="p-0">
        <ScrollArea ref={scrollRef} className="h-[400px] p-4">
          <QuickActions onAction={handleQuickAction} />
          
          <div className="space-y-4">
            {messages.map(renderMessage)}
            
            {isLoading && (
              <div className="flex w-fit max-w-[85%] rounded-lg bg-muted px-4 py-2">
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-primary rounded-full animate-bounce [animation-delay:-0.3s]" />
                  <div className="w-2 h-2 bg-primary rounded-full animate-bounce [animation-delay:-0.15s]" />
                  <div className="w-2 h-2 bg-primary rounded-full animate-bounce" />
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
        
        <div className="border-t p-4">
          {!isLoggedIn && (
            <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-sm text-amber-800 mb-2">
                To use the AI assistant and complete bookings, please log in.
              </p>
              <Button size="sm" asChild>
                <a href="/login">Log In</a>
              </Button>
            </div>
          )}
          
          {selectedPackage && (
            <div className="mb-4 p-3 bg-primary/5 rounded-lg border border-primary/20">
              <div className="flex justify-between items-center">
                <div>
                  <p className="font-medium text-sm">{selectedPackage.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {duration} {duration === 1 ? 'night' : 'nights'} • {selectedPackage.features.slice(0, 2).join(', ')}
                  </p>
                  {startDate && endDate && (
                    <div className="mt-1">
                      <p className="text-xs text-muted-foreground">
                        {format(startDate, 'MMM dd')} - {format(endDate, 'MMM dd, yyyy')}
                      </p>
                      {isCheckingAvailability ? (
                        <p className="text-xs text-blue-600 flex items-center gap-1">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          Checking availability...
                        </p>
                      ) : !areDatesAvailable ? (
                        <p className="text-xs text-red-600 flex items-center gap-1">
                          ❌ Dates not available
                        </p>
                      ) : (
                        <p className="text-xs text-green-600 flex items-center gap-1">
                          ✅ Dates available
                        </p>
                      )}
                    </div>
                  )}
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-primary">
                    R{(selectedPackage.baseRate || calculateTotal(baseRate, duration, selectedPackage.multiplier)).toFixed(0)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    R{(selectedPackage.baseRate ? baseRate : (calculateTotal(baseRate, duration, selectedPackage.multiplier) / duration)).toFixed(0)}/night
                  </div>
                  {!selectedPackage.baseRate && selectedPackage.multiplier !== 1 && (
                    <div className="text-xs text-muted-foreground">
                      {selectedPackage.multiplier > 1 ? '+' : ''}{((selectedPackage.multiplier - 1) * 100).toFixed(0)}% rate
                    </div>
                  )}
                  {isLoggedIn ? (
                    <Button 
                      size="sm" 
                      className="mt-1" 
                      onClick={handleBooking}
                      disabled={isBooking || !startDate || !endDate || !areDatesAvailable || isCheckingAvailability}
                    >
                      {isBooking ? (
                        <>
                          <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                          Processing...
                        </>
                      ) : !startDate || !endDate ? (
                        'Select Dates'
                      ) : !areDatesAvailable ? (
                        'Dates Unavailable'
                      ) : isCheckingAvailability ? (
                        <>
                          <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                          Checking...
                        </>
                      ) : (
                        'Book Now'
                      )}
                    </Button>
                  ) : (
                    <Button size="sm" variant="outline" className="mt-1" asChild>
                      <a href="/login">Log In to Book</a>
                    </Button>
                  )}
                  {/* Secondary action to create booking via estimate page */}
                  <Button size="sm" variant="ghost" className="mt-1 ml-2" onClick={handleGoToEstimate} disabled={isCreatingEstimate}>
                    {isCreatingEstimate ? (
                      <>
                        <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                        Opening...
                      </>
                    ) : (
                      'Share Estimate'
                    )}
                  </Button>
                </div>
              </div>
              {bookingError && (
                <div className="mt-2 p-2 text-xs text-destructive bg-destructive/10 rounded">
                  {bookingError}
                </div>
              )}
            </div>
          )}
          
          <form onSubmit={handleSubmit} className="flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                isListening 
                  ? "I'm listening..." 
                  : isLoggedIn 
                    ? "Ask me anything about booking..."
                    : "Ask about packages (log in for full AI assistance)..."
              }
              className="flex-1"
              disabled={isLoading || isListening}
            />
            <Button
              type="button"
              size="icon"
              variant={isListening ? 'destructive' : 'outline'}
              onClick={isListening ? stopListening : startListening}
              disabled={isLoading || isSpeaking || !!micError}
              title={micError || (isListening ? 'Stop listening' : 'Start listening')}
            >
              {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            </Button>
            <Button type="submit" size="icon" disabled={isLoading || isListening || !input.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </form>
          {micError && <p className="text-sm text-destructive mt-2">{micError}</p>}
        </div>
      </CardContent>
    </Card>
  )
} 