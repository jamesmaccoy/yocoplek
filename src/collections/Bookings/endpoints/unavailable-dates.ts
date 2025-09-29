import { Purchases } from '@revenuecat/purchases-js'
import { Endpoint } from 'payload'

export const unavailableDates: Endpoint = {
  method: 'get',
  path: '/unavailable-dates',
  handler: async (req) => {
    const { slug, postId } = req.query

    if (!slug && !postId) {
      return Response.json({ message: 'Post slug or ID is required' }, { status: 400 })
    }

    if (!req.user) {
      return Response.json({ message: 'Unauthorized' }, { status: 401 })
    }

    const isSubscribed = await hasSubscription(req.user.id)

    if (!isSubscribed) {
      return Response.json({
        unavailableDates: [],
      })
    }

    try {
      let resolvedPostId = postId

      // If slug is provided, find the post by slug
      if (slug && !postId) {
        const posts = await req.payload.find({
          collection: 'posts',
          where: {
            slug: {
              equals: slug,
            },
          },
          select: {
            slug: true,
          },
          limit: 1,
        })

        if (!posts.docs.length) {
          return Response.json({ message: 'Post not found' }, { status: 404 })
        }

        resolvedPostId = posts.docs[0]?.id
      }

      // Find all bookings for this post
      const bookings = await req.payload.find({
        collection: 'bookings',
        where: {
          post: {
            equals: resolvedPostId,
          },
        },
        limit: 1000,
        select: {
          fromDate: true,
          toDate: true,
        },
        depth: 0,
      })

      // Extract and process date ranges
      const unavailableDates: string[] = []

      bookings.docs.forEach((booking) => {
        const fromDate = new Date(booking.fromDate)
        const toDate = new Date(booking.toDate)

        // Generate array of all dates in the range with full ISO strings
        const currentDate = new Date(fromDate)
        while (currentDate < toDate) {
          unavailableDates.push(currentDate.toISOString())
          currentDate.setDate(currentDate.getDate() + 1)
        }
      })

      // Remove duplicates if needed
      const uniqueUnavailableDates = [...new Set(unavailableDates)]

      return Response.json({
        unavailableDates: uniqueUnavailableDates,
      })
    } catch (error) {
      console.error('Error fetching unavailable dates:', error)
      return Response.json({ message: 'Error fetching unavailable dates' }, { status: 500 })
    }
  },
}

const apiKey = process.env.REVENUECAT_SECRET_API_KEY

const hasSubscription = async (userId: string) => {
  if (!apiKey) {
    throw new Error('Please add REVENUECAT_SECRET_API_KEY to your env variables')
  }

  const response = await fetch(
    `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(userId)}`,
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    },
  )

  if (!response.ok) return false

  const data = await response.json()

  const entitlements = data?.subscriber?.entitlements ?? {}

  const isActive = (entitlement: unknown) => {
    if (!entitlement || typeof entitlement !== 'object' || !('expires_date' in entitlement))
      return false

    const exp = entitlement?.expires_date
    if (!exp) return true // lifetime subscription when expires_date is null according to the docs

    // To Fix type error, according to the docs, it can only ever be of type string or null.
    if (typeof exp !== 'string') return false

    const expDate = new Date(exp)

    return expDate.getTime() > Date.now()
  }

  return Object.values(entitlements).some(isActive)
}