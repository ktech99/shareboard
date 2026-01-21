import { PlaceInfo } from './supabase'

export interface GrokMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export interface GrokResponse {
  choices: {
    message: {
      content: string
    }
  }[]
}

export async function chatWithGrok(messages: GrokMessage[]): Promise<string> {
  try {
    const response = await fetch('/api/grok', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ messages }),
    })

    if (!response.ok) {
      throw new Error('Failed to get response from Grok')
    }

    const data = await response.json()
    return data.content
  } catch (error) {
    console.error('Error chatting with Grok:', error)
    throw error
  }
}

// Search for place information in NYC
export async function searchPlace(query: string, type?: string): Promise<PlaceInfo | null> {
  try {
    const response = await fetch('/api/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query, type }),
    })

    if (!response.ok) {
      return null
    }

    const data = await response.json()

    if (data.found === false) {
      return null
    }

    return {
      name: data.name || query,
      type: data.type || 'Other',
      neighborhood: data.neighborhood || null,
      address: data.address || null,
      description: data.description || null,
      knownFor: data.knownFor || null,
      priceRange: data.priceRange || null,
      tips: data.tips || null,
    }
  } catch (error) {
    console.error('Error searching place:', error)
    return null
  }
}

export interface ParsedIntent {
  action: 'add' | 'edit' | 'delete' | 'search' | 'unknown'
  text: string
  category: string
  link: string | null
  searchQuery?: string
  editItemId?: string
  confidence: number
  place?: PlaceInfo
  isPlace: boolean
}

export async function parseUserIntent(
  input: string,
  existingItems: { id: string; text: string; category: string }[]
): Promise<ParsedIntent> {
  const itemsList = existingItems
    .slice(0, 20)
    .map((item) => `- ID: "${item.id}" | Text: "${item.text}" | Category: ${item.category}`)
    .join('\n')

  const prompt = `You are a smart assistant for a shared friends list app used by people in NYC.

CONTEXT: All users are based in NYC. They frequently add restaurants, bars, clubs, cafes, and activities in New York City.

Current items in the list:
${itemsList || '(empty list)'}

User input: "${input}"

Analyze the input and determine:
1. ACTION: "add", "edit", "delete", "search", or "unknown"
2. IS_PLACE: Is this referring to a specific place/venue (restaurant, bar, club, cafe, activity location)?
3. PLACE_TYPE: If it's a place, what type? (Restaurant, Bar, Club, Cafe, Activity, Event, Shop)
4. For ADD: Extract the place/item name, suggest a category (Food, Nightlife, Activity, Entertainment, Shopping, Other)
5. For EDIT/DELETE: Match to existing item by text similarity
6. For SEARCH: Extract search terms

IMPORTANT:
- If the user mentions a place name (like "Carbone", "Le Bernardin", "1 Oak", etc.), set isPlace=true
- If it sounds like a restaurant, bar, or venue name, assume it's a place
- Generate a Google Maps search URL for places

Respond ONLY with valid JSON:
{
  "action": "add" | "edit" | "delete" | "search" | "unknown",
  "text": "place name or item text",
  "category": "Food" | "Nightlife" | "Activity" | "Entertainment" | "Shopping" | "Other",
  "isPlace": true | false,
  "placeType": "Restaurant" | "Bar" | "Club" | "Cafe" | "Activity" | "Event" | "Shop" | null,
  "link": "Google Maps URL like https://www.google.com/maps/search/PlaceName+NYC or null",
  "searchQuery": "search terms or null",
  "editItemId": "item ID or null",
  "confidence": 0.0 to 1.0
}`

  try {
    const response = await chatWithGrok([
      {
        role: 'system',
        content: 'You are a precise intent parser for a NYC-focused friends list app. Always respond with valid JSON only. Assume any place name refers to NYC.',
      },
      { role: 'user', content: prompt },
    ])

    const jsonMatch = response.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0])

      let place: PlaceInfo | undefined = undefined

      // If it's a place, search for more info
      if (parsed.isPlace && parsed.action === 'add') {
        const placeInfo = await searchPlace(parsed.text, parsed.placeType)
        if (placeInfo) {
          place = placeInfo
          // Update category based on place type
          if (placeInfo.type === 'Restaurant' || placeInfo.type === 'Cafe') {
            parsed.category = 'Food'
          } else if (placeInfo.type === 'Bar' || placeInfo.type === 'Club') {
            parsed.category = 'Nightlife'
          }
        }
      }

      return {
        action: parsed.action || 'unknown',
        text: place?.name || parsed.text || input,
        category: parsed.category || 'Other',
        link: parsed.link || null,
        searchQuery: parsed.searchQuery || undefined,
        editItemId: parsed.editItemId || undefined,
        confidence: parsed.confidence || 0.5,
        isPlace: parsed.isPlace || false,
        place,
      }
    }

    return {
      action: 'add',
      text: input,
      category: 'Other',
      link: null,
      confidence: 0.3,
      isPlace: false,
    }
  } catch (error) {
    console.error('Error parsing intent:', error)
    return {
      action: 'add',
      text: input,
      category: 'Other',
      link: null,
      confidence: 0.3,
      isPlace: false,
    }
  }
}

export async function analyzeSocialLink(url: string, type: 'tiktok' | 'instagram'): Promise<string> {
  const prompt = `A user in NYC shared a ${type} link: ${url}

Please provide a brief summary. Since you cannot access the actual content:
1. Ask what they saw in the video
2. If it's about a restaurant, bar, or place in NYC, offer to help add it to their list
3. Suggest how this could be categorized

Keep your response concise and helpful.`

  try {
    const response = await chatWithGrok([
      { role: 'system', content: 'You are a helpful assistant for a NYC friends list app. Help users extract useful information from social media content.' },
      { role: 'user', content: prompt }
    ])

    return response
  } catch (error) {
    console.error('Error analyzing social link:', error)
    return "I couldn't analyze that link. Could you describe what you saw and I'll help you add it to the list?"
  }
}
