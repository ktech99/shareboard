import { NextRequest, NextResponse } from 'next/server'

interface PlaceResult {
  name: string
  formatted_address: string
  rating?: number
  user_ratings_total?: number
  price_level?: number
  types?: string[]
  geometry?: {
    location: {
      lat: number
      lng: number
    }
  }
  opening_hours?: {
    open_now?: boolean
  }
  photos?: Array<{
    photo_reference: string
  }>
}

export async function POST(request: NextRequest) {
  try {
    const { query } = await request.json()
    const apiKey = process.env.GOOGLE_PLACES_API_KEY

    if (!apiKey) {
      return NextResponse.json(
        { error: 'Google Places API key not configured' },
        { status: 500 }
      )
    }

    // Search for the place
    const searchUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query + ' NYC')}&key=${apiKey}`

    const searchResponse = await fetch(searchUrl)
    const searchData = await searchResponse.json()

    if (searchData.status !== 'OK' || !searchData.results?.length) {
      return NextResponse.json({ results: [] })
    }

    // Get details for top results (up to 10)
    const places = searchData.results.slice(0, 10).map((place: PlaceResult) => {
      const priceLevel = place.price_level
      const priceRange = priceLevel !== undefined
        ? '$'.repeat(priceLevel + 1)
        : null

      // Extract neighborhood from address
      const addressParts = place.formatted_address?.split(',') || []
      const neighborhood = addressParts.length > 1
        ? addressParts[1]?.trim()
        : null

      // Map Google place types to our types
      const typeMapping: Record<string, string> = {
        restaurant: 'Restaurant',
        bar: 'Bar',
        night_club: 'Club',
        cafe: 'Cafe',
        bakery: 'Bakery',
        meal_takeaway: 'Restaurant',
        meal_delivery: 'Restaurant',
        gym: 'Gym',
        spa: 'Spa',
        museum: 'Museum',
        art_gallery: 'Gallery',
        movie_theater: 'Theater',
        shopping_mall: 'Shopping',
        store: 'Store',
        park: 'Park',
      }

      let placeType = 'Place'
      for (const type of place.types || []) {
        if (typeMapping[type]) {
          placeType = typeMapping[type]
          break
        }
      }

      return {
        name: place.name,
        address: place.formatted_address,
        neighborhood,
        type: placeType,
        rating: place.rating || null,
        reviewCount: place.user_ratings_total || null,
        priceRange,
        isOpen: place.opening_hours?.open_now ?? null,
        mapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.name + ' ' + place.formatted_address)}`,
      }
    })

    return NextResponse.json({ results: places })
  } catch (error) {
    console.error('Error in Places API route:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
