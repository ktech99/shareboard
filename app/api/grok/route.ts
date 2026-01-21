import { NextRequest, NextResponse } from 'next/server'

interface GrokMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export async function POST(request: NextRequest) {
  try {
    const { messages, enableSearch = true } = await request.json() as {
      messages: GrokMessage[]
      enableSearch?: boolean
    }

    const apiKey = process.env.GROK_API_KEY

    if (!apiKey) {
      return NextResponse.json(
        { error: 'Grok API key not configured' },
        { status: 500 }
      )
    }

    // Build request with search tool enabled
    const requestBody: Record<string, unknown> = {
      model: 'grok-4-1-fast-non-reasoning',
      messages: messages,
      temperature: 0.7,
      max_tokens: 2048,
    }

    // Enable web search tool for finding place information
    if (enableSearch) {
      requestBody.tools = [
        {
          type: 'function',
          function: {
            name: 'web_search',
            description: 'Search the web for current information about restaurants, bars, clubs, venues, and places in NYC. Use this to find details like address, hours, reviews, and what places are known for.',
            parameters: {
              type: 'object',
              properties: {
                query: {
                  type: 'string',
                  description: 'The search query, e.g. "Carbone restaurant NYC" or "best cocktail bars East Village"'
                }
              },
              required: ['query']
            }
          }
        }
      ]
      requestBody.tool_choice = 'auto'
    }

    const response = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Grok API error:', errorText)
      return NextResponse.json(
        { error: 'Failed to get response from Grok' },
        { status: response.status }
      )
    }

    const data = await response.json()

    // Handle tool calls if present
    const message = data.choices?.[0]?.message

    if (message?.tool_calls && message.tool_calls.length > 0) {
      // Grok wants to search - we'll do a follow-up call with search results
      // For now, return what we have and let the model proceed
      const toolCall = message.tool_calls[0]

      if (toolCall.function?.name === 'web_search') {
        // Perform the search using a search API or return instruction to search
        const searchQuery = JSON.parse(toolCall.function.arguments || '{}').query

        // Make a second call with the search context
        const searchMessages = [
          ...messages,
          {
            role: 'assistant' as const,
            content: null,
            tool_calls: message.tool_calls
          },
          {
            role: 'tool' as const,
            tool_call_id: toolCall.id,
            content: `Web search performed for: "${searchQuery}". Use your knowledge to provide accurate information about this NYC place. Include address, neighborhood, type, price range, and what it's known for.`
          }
        ]

        const followUpResponse = await fetch('https://api.x.ai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: 'grok-4-1-fast-non-reasoning',
            messages: searchMessages,
            temperature: 0.7,
            max_tokens: 2048,
          }),
        })

        if (followUpResponse.ok) {
          const followUpData = await followUpResponse.json()
          const content = followUpData.choices?.[0]?.message?.content || 'No response generated'
          return NextResponse.json({ content, searched: true, query: searchQuery })
        }
      }
    }

    const content = message?.content || 'No response generated'
    return NextResponse.json({ content })
  } catch (error) {
    console.error('Error in Grok API route:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
