import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const payload = await getPayload({ config: configPromise })
    
    // Get the authenticated user from the request
    const { user } = await payload.auth({ headers: req.headers })
    
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    if (req.method === 'PATCH') {
      const body = await req.json();
      // Deduplicate and ensure only package IDs are saved
      let packageSettings = Array.isArray(body.packageSettings) ? body.packageSettings : [];
      const deduped: Record<string, any> = {};
      for (const setting of packageSettings) {
        const pkgId = typeof setting.package === 'object' ? setting.package.id : setting.package;
        deduped[pkgId] = {
          ...setting,
          package: pkgId,
        };
      }
      const cleanData = { ...body };
      delete cleanData.packageSettings;
      console.log('Saving package settings:', Object.values(deduped));
      const updated = await payload.update({
        collection: 'posts',
        id,
        data: {
          ...cleanData,
          packageSettings: Object.values(deduped),
        },
        user,
        depth: 1, // Ensure relationships are populated
      });
      console.log('Updated post with package settings:', updated.packageSettings);
      return NextResponse.json({ message: 'Post updated successfully', doc: updated });
    }

    let body: any
    const contentType = req.headers.get('content-type') || ''
    
    try {
      if (contentType.includes('application/json')) {
        // Handle JSON requests
        body = await req.json()
      } else if (contentType.includes('application/x-www-form-urlencoded') || contentType.includes('multipart/form-data')) {
        // Handle form data requests
        const formData = await req.formData()
        body = {} as any
        
        // Convert FormData to regular object
        for (const [key, value] of formData.entries()) {
          if (key.includes('[') && key.includes(']')) {
            // Handle nested form fields like "meta[title]"
            const match = key.match(/^(\w+)\[(\w+)\]$/)
            if (match && match.length >= 3) {
              const parentKey = match[1]
              const childKey = match[2]
              if (parentKey && childKey) {
                if (!body[parentKey]) body[parentKey] = {}
                body[parentKey][childKey] = value
              }
            } else {
              body[key] = value
            }
          } else {
            body[key] = value
          }
        }
      } else {
        // Try to parse as JSON as fallback
        body = await req.json()
      }
    } catch (jsonError) {
      console.error('Request parsing error:', jsonError)
      console.error('Content-Type:', contentType)
      console.error('Request URL:', req.url)
      return NextResponse.json(
        { error: 'Invalid request body format' },
        { status: 400 }
      )
    }

    // Validate and clean the data
    const cleanData: any = {}

    // Handle title
    if (body.title !== undefined) {
      cleanData.title = String(body.title || '').trim()
      if (!cleanData.title) {
        return NextResponse.json(
          { error: 'Title cannot be empty' },
          { status: 400 }
        )
      }
    }

    // Handle status - support both _status and status field names
    if (body._status !== undefined) {
      cleanData._status = body._status
    } else if (body.status !== undefined) {
      cleanData._status = body.status
    }

    // Handle content properly - convert simple text to Lexical structure if needed
    if (body.content !== undefined) {
      if (typeof body.content === 'string') {
        // Convert simple text to Lexical format
        cleanData.content = {
          root: {
            type: "root",
            children: [
              {
                type: "paragraph",
                children: [
                  {
                    type: "text",
                    text: body.content
                  }
                ]
              }
            ],
            direction: null,
            format: '',
            indent: 0,
            version: 1
          }
        }
      } else if (body.content && body.content.root) {
        // Already in Lexical format, but ensure all nodes have proper types
        const ensureNodeTypes = (node: any): any => {
          if (typeof node === 'object' && node !== null) {
            // Ensure text nodes have type
            if (node.text !== undefined && !node.type) {
              node.type = "text"
            }
            // Recursively process children
            if (Array.isArray(node.children)) {
              node.children = node.children.map(ensureNodeTypes)
            }
          }
          return node
        }
        
        cleanData.content = {
          root: ensureNodeTypes(body.content.root)
        }
      } else if (Array.isArray(body.content)) {
        // Convert array format to Lexical
        cleanData.content = {
          root: {
            type: "root",
            children: body.content.map((item: any) => ({
              type: item.type || "paragraph",
              children: item.children ? item.children.map((child: any) => ({
                type: child.type || "text",
                text: child.text || '',
                ...child
              })) : [{ type: "text", text: item.text || '' }],
              direction: item.direction || 'ltr',
              format: item.format || '',
              indent: item.indent || 0,
              version: item.version || 1
            })),
            direction: null,
            format: '',
            indent: 0,
            version: 1
          }
        }
      }
    }

    // Handle categories safely
    if (body.categories !== undefined && Array.isArray(body.categories)) {
      cleanData.categories = body.categories.filter((cat: any) => 
        cat && typeof cat === 'string' && cat.trim() !== ''
      )
    }

    // Handle hero image
    if (body.heroImage !== undefined && typeof body.heroImage === 'string') {
      cleanData.heroImage = body.heroImage
    }

    // Handle baseRate safely
    if (body.baseRate !== undefined) {
      if (body.baseRate === null || body.baseRate === '') {
        cleanData.baseRate = null
      } else {
        const baseRateNum = Number(body.baseRate)
        if (!isNaN(baseRateNum) && baseRateNum >= 0) {
          cleanData.baseRate = baseRateNum
        }
      }
    }

    // Handle packageTypes safely
    if (body.packageTypes !== undefined && Array.isArray(body.packageTypes)) {
      cleanData.packageTypes = body.packageTypes
        .filter((pkg: any) => pkg && typeof pkg === 'object' && pkg.name)
        .map((pkg: any) => {
          // Use post's baseRate if package price is empty/undefined
          const packagePrice = (pkg.price !== undefined && pkg.price !== null && pkg.price !== '') 
            ? Number(pkg.price) 
            : (cleanData.baseRate || 150) // Fallback to baseRate or 150 if no baseRate
          
          // Handle features array safely to prevent circular references
          let features = []
          if (Array.isArray(pkg.features)) {
            features = pkg.features
              .filter((f: any) => f && (typeof f === 'string' || (typeof f === 'object' && f.feature)))
              .map((f: any) => {
                if (typeof f === 'string') {
                  return { feature: f.trim() }
                } else if (typeof f === 'object' && f.feature) {
                  return { feature: String(f.feature).trim() }
                }
                return null
              })
              .filter(Boolean)
          }
          
          return {
            name: String(pkg.name || '').trim(),
            description: String(pkg.description || '').trim(),
            price: packagePrice,
            multiplier: Number(pkg.multiplier) || 1,
            features: features,
            revenueCatId: String(pkg.revenueCatId || '').trim(),
            templateId: pkg.templateId ? String(pkg.templateId).trim() : undefined,
            category: pkg.category ? String(pkg.category).trim() : undefined,
            minNights: pkg.minNights !== undefined ? Number(pkg.minNights) : undefined,
            maxNights: pkg.maxNights !== undefined ? Number(pkg.maxNights) : undefined,
            isHosted: pkg.isHosted !== undefined ? Boolean(pkg.isHosted) : undefined,
          }
        })
        .filter((pkg: any) => pkg.name && pkg.price >= 0)
    }

    // Handle meta fields safely
    if (body.meta !== undefined && typeof body.meta === 'object') {
      cleanData.meta = {}
      if (body.meta.title !== undefined) {
        cleanData.meta.title = typeof body.meta.title === 'string' ? body.meta.title.trim() : null
      }
      if (body.meta.description !== undefined) {
        cleanData.meta.description = typeof body.meta.description === 'string' ? body.meta.description.trim() : null
      }
      if (body.meta.image !== undefined) {
        cleanData.meta.image = typeof body.meta.image === 'string' ? body.meta.image : null
      }
    }

    // Handle publishedAt
    if (body.publishedAt !== undefined) {
      if (body.publishedAt) {
        try {
          cleanData.publishedAt = new Date(body.publishedAt).toISOString()
        } catch (dateError) {
          console.warn('Invalid publishedAt date:', body.publishedAt)
        }
      } else {
        cleanData.publishedAt = null
      }
    } else if (cleanData._status === 'published') {
      // Auto-set publishedAt if status is being changed to published
      cleanData.publishedAt = new Date().toISOString()
    }

    console.log('Updating post with clean data:', JSON.stringify(cleanData, null, 2))

    const post = await payload.update({
      collection: 'posts',
      id,
      data: {
        ...cleanData,
        packageSettings: body.packageSettings,
      },
      user,
    })

    return NextResponse.json({ 
      message: 'Post updated successfully',
      doc: post 
    })
  } catch (error: any) {
    console.error('Error updating post:', error)
    
    // Provide more specific error messages
    if (error.message?.includes('validation')) {
      return NextResponse.json(
        { error: 'Validation error: ' + error.message },
        { status: 400 }
      )
    }
    
    if (error.message?.includes('duplicate')) {
      return NextResponse.json(
        { error: 'A post with this title already exists' },
        { status: 409 }
      )
    }

    return NextResponse.json(
      { error: error.message || 'Failed to update post' },
      { status: 500 }
    )
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const payload = await getPayload({ config: configPromise })
    
    // Get the authenticated user from the request
    const { user } = await payload.auth({ headers: req.headers })
    
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    await payload.delete({
      collection: 'posts',
      id,
      user,
    })

    return NextResponse.json({ 
      message: 'Post deleted successfully' 
    })
  } catch (error: any) {
    console.error('Error deleting post:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to delete post' },
      { status: 500 }
    )
  }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const payload = await getPayload({ config: configPromise })
    
    const post = await payload.findByID({
      collection: 'posts',
      id,
      depth: 2, // Include related data
    })

    if (!post) {
      return NextResponse.json(
        { error: 'Post not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ doc: post })
  } catch (error: any) {
    console.error('Error fetching post:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch post' },
      { status: 500 }
    )
  }
} 