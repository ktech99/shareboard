import { NextRequest, NextResponse } from 'next/server'

// This route uses Grok to search and extract place information
// In production, you could integrate Google Places API, Yelp API, etc.

export async function POST(request: NextRequest) {
  try {
    const { query, type } = await request.json()

    const apiKey = process.env.GROK_API_KEY

    if (!apiKey) {
      return NextResponse.json(
        { error: 'API key not configured' },
        { status: 500 }
      )
    }

    const searchPrompt = `You are a NYC local expert assistant. Search your knowledge for information about: "${query}"

Context: The user is in NYC and looking for ${type || 'a place'}.

If this is a restaurant, bar, club, or venue, provide:
1. Full name of the place
2. Type (Restaurant, Bar, Club, Cafe, etc.)
3. Neighborhood/area in NYC
4. Approximate address if known
5. What it's known for (cuisine type, vibe, specialty)
6. Price range ($, $$, $$$, $$$$)
7. Any notable details

If this is an activity or event, provide:
1. Name/description
2. Location in NYC
3. Type of activity
4. Best time to go
5. Any tips

Respond in JSON format:
{
  "found": true/false,
  "name": "Official place name",
  "type": "Restaurant" | "Bar" | "Club" | "Cafe" | "Activity" | "Event" | "Shop" | "Other",
  "category": "Food" | "Nightlife" | "Activity" | "Entertainment" | "Shopping" | "Other",
  "neighborhood": "e.g., East Village, Williamsburg",
  "address": "approximate address or null",
  "description": "brief description of what it is",
  "knownFor": "what it's famous for",
  "priceRange": "$" | "$$" | "$$$" | "$$$$" | null,
  "tips": "any useful tips",
  "googleMapsQuery": "search query for Google Maps"
}`

    const response = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'grok-3-fast-latest',
        messages: [
          {
            role: 'system',
            content: 'You are a knowledgeable NYC local expert. Always respond with valid JSON only.',
          },
          { role: 'user', content: searchPrompt },
        ],
        temperature: 0.3,
        max_tokens: 1024,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Search API error:', errorText)
      return NextResponse.json(
        { error: 'Search failed' },
        { status: response.status }
      )
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content || '{}'

    // Parse JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const placeInfo = JSON.parse(jsonMatch[0])
      return NextResponse.json(placeInfo)
    }

    return NextResponse.json({ found: false })
  } catch (error) {
    console.error('Error in search route:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
