'use client'

import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Send, Loader2, MapPin, DollarSign, Check, X, RotateCcw, Plus, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { chatWithGrok } from '@/lib/grok'
import { Item, PlaceInfo } from '@/lib/supabase'

interface SmartInputProps {
  items: Item[]
  onAdd: (text: string, category: string, link: string | null, place?: PlaceInfo) => void
  onEdit: (id: string, text: string, category: string) => void
  onDelete: (id: string) => void
  onSearch: (query: string) => void
}

interface Recommendation {
  text: string
  category: string
  link: string | null
  place?: PlaceInfo
}

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
  proposal?: {
    action: 'add' | 'edit' | 'delete' | 'search'
    text: string
    category: string
    link: string | null
    place?: PlaceInfo
    editItemId?: string
  }
  proposalStatus?: 'pending' | 'accepted' | 'rejected'
  recommendations?: Recommendation[]
  addedRecommendations?: Set<number>
}

export function SmartInput({ items, onAdd, onEdit, onDelete, onSearch }: SmartInputProps) {
  const [input, setInput] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isFocused, setIsFocused] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const isExpanded = messages.length > 0 || isFocused

  useEffect(() => {
    if (messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages])

  const generateId = () => Math.random().toString(36).substring(7)

  const addMessage = (
    role: 'user' | 'assistant',
    content: string,
    proposal?: ChatMessage['proposal'],
    recommendations?: Recommendation[]
  ) => {
    const newMessage: ChatMessage = {
      id: generateId(),
      role,
      content,
      timestamp: Date.now(),
      proposal,
      proposalStatus: proposal ? 'pending' : undefined,
      recommendations,
      addedRecommendations: recommendations ? new Set() : undefined,
    }
    setMessages(prev => [...prev, newMessage])
    return newMessage.id
  }

  const updateProposalStatus = (messageId: string, status: 'accepted' | 'rejected') => {
    setMessages(prev => prev.map(msg =>
      msg.id === messageId ? { ...msg, proposalStatus: status } : msg
    ))
  }

  const markRecommendationAdded = (messageId: string, index: number) => {
    setMessages(prev => prev.map(msg => {
      if (msg.id === messageId && msg.addedRecommendations) {
        const newSet = new Set(msg.addedRecommendations)
        newSet.add(index)
        return { ...msg, addedRecommendations: newSet }
      }
      return msg
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isProcessing) return

    const userInput = input.trim()
    setInput('')
    addMessage('user', userInput)
    setIsProcessing(true)

    try {
      const itemsList = items
        .slice(0, 15)
        .map((item) => `- "${item.text}" (${item.category})${item.id ? ` [id:${item.id.slice(0,8)}]` : ''}`)
        .join('\n')

      const recentMessages = messages.slice(-6).map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content
      }))

      // Detect URLs in user input
      const urlRegex = /(https?:\/\/[^\s]+)/g
      const urls = userInput.match(urlRegex) || []
      let scrapedContent = ''

      // Scrape any URLs found
      if (urls.length > 0) {
        try {
          for (const url of urls.slice(0, 2)) { // Limit to 2 URLs
            const scrapeResponse = await fetch('/api/scrape', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ url })
            })
            const scrapeResult = await scrapeResponse.json()
            if (scrapeResult.content) {
              scrapedContent += `\n\nCONTENT FROM URL (${scrapeResult.title || url}):\n${scrapeResult.content}`
            }
          }
        } catch (e) {
          console.error('Scrape error:', e)
        }
      }

      // Call Places API first to get real data (skip if we have scraped content with place names)
      let placesData = ''
      if (!scrapedContent) {
        try {
          const placesResponse = await fetch('/api/places', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: userInput })
          })
          const placesResult = await placesResponse.json()
          if (placesResult.results?.length > 0) {
            placesData = `\n\nGOOGLE PLACES API RESULTS (use this real data!):\n${placesResult.results.map((p: { name: string; type: string; address: string; neighborhood: string; rating: number; reviewCount: number; priceRange: string; mapsUrl: string }) =>
              `- ${p.name} (${p.type}) - ${p.address}
   Rating: ${p.rating ? `${p.rating}/5 (${p.reviewCount} reviews)` : 'N/A'}
   Price: ${p.priceRange || 'N/A'}
   Maps: ${p.mapsUrl}`
            ).join('\n')}`
          }
        } catch (e) {
          console.error('Places API error:', e)
        }
      }

      const systemPrompt = `You are a helpful assistant for a NYC-focused friends list app. Users add restaurants, bars, clubs, and activities.

CURRENT LIST:
${itemsList || '(empty)'}${placesData}${scrapedContent}

YOUR JOB:
1. If CONTENT FROM URL is provided above, extract ALL place names (restaurants, bars, clubs, etc.) mentioned and return them as recommendations
2. USE THE GOOGLE PLACES DATA ABOVE if available - it has real ratings and reviews!
3. When a user asks for RECOMMENDATIONS, provide ALL options (up to 10). If user specifies a number, provide that many.
4. ONLY ask clarifying questions if no places were found and request is ambiguous

URL CONTENT HANDLING:
- If the user pastes a URL, the content has been scraped and provided above
- Extract ALL place names from the article/page content
- For each place found, create a recommendation with category based on type (restaurant=Food, bar/club=Nightlife, etc.)
- Generate Google Maps links for each place
- If the content mentions NYC places, extract and recommend them all

CRITICAL RESPONSE FORMAT RULES:
1. You MUST wrap JSON in triple backticks with the label
2. Format: \`\`\`action or \`\`\`recommendations followed by JSON, then closing \`\`\`
3. Add a brief friendly message BEFORE the JSON block
4. NEVER output raw JSON without the code fence wrapper
5. ALWAYS include the label (action or recommendations) right after the opening backticks

SINGLE PLACE FORMAT (when user wants to add one specific place):
First write a short message like "Found it! Here's what I found about [place]:"
Then output:
\`\`\`action
{
  "action": "add",
  "text": "Place Name",
  "category": "Food",
  "link": "https://www.google.com/maps/...",
  "place": {
    "name": "Official Name",
    "type": "Restaurant",
    "neighborhood": "East Village",
    "address": "123 Main St, New York, NY",
    "description": "Brief description",
    "knownFor": "What it's famous for",
    "priceRange": "$$",
    "tips": "Useful tip",
    "rating": 4.5,
    "reviewCount": 1234
  }
}
\`\`\`

MULTIPLE RECOMMENDATIONS FORMAT (when user asks for suggestions):
First write a short message like "Here are some great options:"
Then output:
\`\`\`recommendations
[
  {
    "text": "Place 1",
    "category": "Nightlife",
    "link": "https://www.google.com/maps/...",
    "place": {"name": "Place 1", "type": "Bar", "neighborhood": "East Village", "priceRange": "$$", "knownFor": "craft cocktails", "tips": "come early", "rating": 4.5, "reviewCount": 500}
  },
  {
    "text": "Place 2",
    "category": "Nightlife",
    "link": "https://www.google.com/maps/...",
    "place": {"name": "Place 2", "type": "Bar", "neighborhood": "East Village", "priceRange": "$", "knownFor": "dive bar vibes", "tips": "cash only", "rating": 4.2, "reviewCount": 300}
  }
]
\`\`\`

Categories: "Food", "Nightlife", "Activity", "Entertainment", "Shopping", "Travel", "Other"

For EDIT: use "action": "edit" and include "editItemId" matching the item's ID from the list.
For DELETE: use "action": "delete" and include "editItemId".
For SEARCH (filtering the list): use "action": "search" with "text" as the search query.

IMPORTANT: Always include "rating" and "reviewCount" from the Places API data. Use the real Maps URL provided.
REMEMBER: Always use \`\`\`action or \`\`\`recommendations wrapper. Never output bare JSON.`

      const response = await chatWithGrok([
        { role: 'system', content: systemPrompt },
        ...recentMessages,
        { role: 'user', content: userInput }
      ])

      // Helper to extract and parse JSON from response
      const extractJson = (text: string, startMarker: string, isArray: boolean): { json: unknown; cleaned: string } | null => {
        // Try with code fence first
        const fenceRegex = new RegExp('```' + startMarker + '\\s*([\\s\\S]*?)\\s*```')
        const fenceMatch = text.match(fenceRegex)
        if (fenceMatch) {
          try {
            const parsed = JSON.parse(fenceMatch[1])
            return { json: parsed, cleaned: text.replace(fenceRegex, '').trim() }
          } catch (e) {
            console.error('Failed to parse fenced JSON:', e)
          }
        }

        // Try without fence - find the keyword and extract JSON after it
        const keywordIndex = text.toLowerCase().indexOf(startMarker.toLowerCase())
        if (keywordIndex !== -1) {
          const afterKeyword = text.slice(keywordIndex + startMarker.length)
          const jsonStart = afterKeyword.search(isArray ? /\[/ : /\{/)
          if (jsonStart !== -1) {
            const jsonStr = afterKeyword.slice(jsonStart)
            // Find matching bracket
            const openBracket = isArray ? '[' : '{'
            const closeBracket = isArray ? ']' : '}'
            let depth = 0
            let endIndex = -1
            for (let i = 0; i < jsonStr.length; i++) {
              if (jsonStr[i] === openBracket) depth++
              else if (jsonStr[i] === closeBracket) {
                depth--
                if (depth === 0) {
                  endIndex = i + 1
                  break
                }
              }
            }
            if (endIndex > 0) {
              try {
                const parsed = JSON.parse(jsonStr.slice(0, endIndex))
                const fullMatch = text.slice(keywordIndex, keywordIndex + startMarker.length + jsonStart + endIndex)
                return { json: parsed, cleaned: text.replace(fullMatch, '').trim() }
              } catch (e) {
                console.error('Failed to parse extracted JSON:', e)
              }
            }
          }
        }
        return null
      }

      let proposal: ChatMessage['proposal'] | undefined
      let recommendations: Recommendation[] | undefined
      let displayContent = response

      // Try to parse recommendations first
      let recsResult = extractJson(response, 'recommendations', true)

      // Also try to find raw JSON array with recommendation objects
      if (!recsResult) {
        const jsonStart = response.search(/\[\s*\{\s*"text"/)
        if (jsonStart !== -1) {
          const jsonStr = response.slice(jsonStart)
          let depth = 0
          let endIndex = -1
          for (let i = 0; i < jsonStr.length; i++) {
            if (jsonStr[i] === '[') depth++
            else if (jsonStr[i] === ']') {
              depth--
              if (depth === 0) {
                endIndex = i + 1
                break
              }
            }
          }
          if (endIndex > 0) {
            try {
              const parsed = JSON.parse(jsonStr.slice(0, endIndex))
              if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].text) {
                recsResult = {
                  json: parsed,
                  cleaned: response.slice(0, jsonStart).trim() + ' ' + response.slice(jsonStart + endIndex).trim()
                }
              }
            } catch (e) {
              console.error('Failed to parse raw recommendations JSON:', e)
            }
          }
        }
      }

      if (recsResult && Array.isArray(recsResult.json)) {
        recommendations = recsResult.json as Recommendation[]
        displayContent = recsResult.cleaned
      }

      // Try to parse action if no recommendations
      if (!recommendations) {
        let actionResult = extractJson(response, 'action', false)

        // Also try to find raw JSON object with "action" field inside
        if (!actionResult) {
          const jsonStart = response.search(/\{\s*"action"/)
          if (jsonStart !== -1) {
            const jsonStr = response.slice(jsonStart)
            let depth = 0
            let endIndex = -1
            for (let i = 0; i < jsonStr.length; i++) {
              if (jsonStr[i] === '{') depth++
              else if (jsonStr[i] === '}') {
                depth--
                if (depth === 0) {
                  endIndex = i + 1
                  break
                }
              }
            }
            if (endIndex > 0) {
              try {
                const parsed = JSON.parse(jsonStr.slice(0, endIndex))
                if (parsed.action) {
                  actionResult = {
                    json: parsed,
                    cleaned: response.slice(0, jsonStart).trim() + ' ' + response.slice(jsonStart + endIndex).trim()
                  }
                }
              } catch (e) {
                console.error('Failed to parse raw action JSON:', e)
              }
            }
          }
        }

        if (actionResult && typeof actionResult.json === 'object' && actionResult.json !== null) {
          const actionData = actionResult.json as Record<string, unknown>
          if (actionData.action) {
            proposal = {
              action: actionData.action as 'add' | 'edit' | 'delete' | 'search',
              text: actionData.text as string,
              category: (actionData.category as string) || 'Other',
              link: (actionData.link as string) || null,
              place: actionData.place as PlaceInfo | undefined,
              editItemId: actionData.editItemId as string | undefined,
            }
            displayContent = actionResult.cleaned
          }
        }
      }

      addMessage('assistant', displayContent, proposal, recommendations)
    } catch (error) {
      console.error('Error:', error)
      addMessage('assistant', "Sorry, I had trouble processing that. Could you try again?")
    } finally {
      setIsProcessing(false)
      inputRef.current?.focus()
    }
  }

  const handleAcceptProposal = (message: ChatMessage) => {
    if (!message.proposal) return
    const { action, text, category, link, place, editItemId } = message.proposal

    switch (action) {
      case 'add':
        onAdd(text, category, link, place)
        updateProposalStatus(message.id, 'accepted')
        addMessage('assistant', `Added "${text}" to your list!`)
        break
      case 'edit':
        if (editItemId) {
          onEdit(editItemId, text, category)
          updateProposalStatus(message.id, 'accepted')
          addMessage('assistant', `Updated the item!`)
        }
        break
      case 'delete':
        if (editItemId) {
          onDelete(editItemId)
          updateProposalStatus(message.id, 'accepted')
          addMessage('assistant', `Removed "${text}" from your list.`)
        }
        break
      case 'search':
        onSearch(text)
        updateProposalStatus(message.id, 'accepted')
        break
    }
  }

  const handleRejectProposal = (message: ChatMessage) => {
    updateProposalStatus(message.id, 'rejected')
    addMessage('assistant', "No problem! Tell me what to change — different name, category, or details?")
  }

  const handleAddRecommendation = (message: ChatMessage, rec: Recommendation, index: number) => {
    onAdd(rec.text, rec.category, rec.link, rec.place)
    markRecommendationAdded(message.id, index)
  }

  const clearChat = () => {
    setMessages([])
    setIsFocused(false)
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-6"
    >
      <motion.div
        layout
        className={`bg-background border shadow-lg overflow-hidden transition-all duration-300 ${
          isExpanded ? 'rounded-2xl' : 'rounded-full'
        }`}
      >
        {/* Chat messages - only show when expanded */}
        <AnimatePresence>
          {messages.length > 0 && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="max-h-[400px] overflow-y-auto border-b"
            >
              <div className="p-4 space-y-3">
                {messages.map((message) => (
                  <motion.div
                    key={message.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`max-w-[85%] ${message.role === 'user' ? 'order-2' : ''}`}>
                      <div
                        className={`rounded-2xl px-4 py-2 text-sm ${
                          message.role === 'user'
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-secondary'
                        }`}
                      >
                        <p className="whitespace-pre-wrap">{message.content}</p>
                      </div>

                      {/* Multiple recommendations */}
                      {message.recommendations && message.recommendations.length > 0 && (
                        <div className="mt-2 space-y-2">
                          {message.recommendations.map((rec, index) => {
                            const isAdded = message.addedRecommendations?.has(index)
                            return (
                              <motion.div
                                key={index}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: index * 0.05 }}
                                className={`bg-background border rounded-xl p-3 shadow-sm ${isAdded ? 'opacity-50' : ''}`}
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                                      <span className="font-medium text-sm">{rec.text}</span>
                                      {rec.place?.type && (
                                        <Badge variant="outline" className="text-xs">{rec.place.type}</Badge>
                                      )}
                                    </div>
                                    {rec.place && (
                                      <div className="text-xs text-muted-foreground space-y-0.5">
                                        <div className="flex items-center gap-3 flex-wrap">
                                          {rec.place.neighborhood && (
                                            <span className="flex items-center gap-1">
                                              <MapPin className="w-3 h-3" />
                                              {rec.place.neighborhood}
                                            </span>
                                          )}
                                          {rec.place.priceRange && (
                                            <span className="flex items-center gap-1">
                                              <DollarSign className="w-3 h-3" />
                                              {rec.place.priceRange}
                                            </span>
                                          )}
                                        </div>
                                        {rec.place.knownFor && (
                                          <p className="line-clamp-1">{rec.place.knownFor}</p>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                  <Button
                                    size="sm"
                                    variant={isAdded ? "ghost" : "default"}
                                    onClick={() => handleAddRecommendation(message, rec, index)}
                                    disabled={isAdded}
                                    className="shrink-0 rounded-full h-8 w-8 p-0"
                                  >
                                    {isAdded ? (
                                      <Check className="w-4 h-4 text-green-600" />
                                    ) : (
                                      <Plus className="w-4 h-4" />
                                    )}
                                  </Button>
                                </div>
                              </motion.div>
                            )
                          })}
                        </div>
                      )}

                      {/* Single action proposal */}
                      {message.proposal && message.proposalStatus === 'pending' && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className="mt-2 bg-background border rounded-xl p-3 shadow-sm"
                        >
                          <div className="flex items-center gap-2 mb-2 flex-wrap">
                            <Badge variant="outline" className="text-xs capitalize">
                              {message.proposal.action}
                            </Badge>
                            <span className="font-medium text-sm">{message.proposal.text}</span>
                          </div>

                          {message.proposal.place && (
                            <div className="text-xs text-muted-foreground space-y-1 mb-3">
                              <div className="flex items-center gap-3 flex-wrap">
                                {message.proposal.place.type && (
                                  <span>{message.proposal.place.type}</span>
                                )}
                                {message.proposal.place.neighborhood && (
                                  <span className="flex items-center gap-1">
                                    <MapPin className="w-3 h-3" />
                                    {message.proposal.place.neighborhood}
                                  </span>
                                )}
                                {message.proposal.place.priceRange && (
                                  <span className="flex items-center gap-1">
                                    <DollarSign className="w-3 h-3" />
                                    {message.proposal.place.priceRange}
                                  </span>
                                )}
                              </div>
                              {message.proposal.place.knownFor && (
                                <p>{message.proposal.place.knownFor}</p>
                              )}
                              {message.proposal.place.tips && (
                                <p className="text-primary/70 italic">💡 {message.proposal.place.tips}</p>
                              )}
                            </div>
                          )}

                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              onClick={() => handleAcceptProposal(message)}
                              className="gap-1 rounded-full"
                            >
                              <Check className="w-3 h-3" />
                              Add
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleRejectProposal(message)}
                              className="gap-1 rounded-full"
                            >
                              <X className="w-3 h-3" />
                              Not quite
                            </Button>
                          </div>
                        </motion.div>
                      )}

                      {message.proposal && message.proposalStatus === 'accepted' && (
                        <div className="mt-1 flex items-center gap-1 text-xs text-green-600">
                          <Check className="w-3 h-3" />
                          Added
                        </div>
                      )}
                      {message.proposal && message.proposalStatus === 'rejected' && (
                        <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                          <RotateCcw className="w-3 h-3" />
                          Tell me what to change
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))}

                {isProcessing && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex justify-start"
                  >
                    <div className="bg-secondary rounded-2xl px-4 py-2 flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="text-xs text-muted-foreground">Searching...</span>
                    </div>
                  </motion.div>
                )}

                <div ref={messagesEndRef} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Input area */}
        <form onSubmit={handleSubmit} className="flex items-center gap-2 p-2">
          {!isExpanded && (
            <div className="pl-2">
              <Sparkles className="w-5 h-5 text-muted-foreground" />
            </div>
          )}
          <input
            ref={inputRef}
            type="text"
            placeholder={isExpanded ? "Ask for recommendations or add a place..." : "What are you looking for?"}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => {
              if (messages.length === 0 && !input) {
                setIsFocused(false)
              }
            }}
            className="flex-1 bg-transparent border-none outline-none text-sm px-2 py-2 placeholder:text-muted-foreground"
            disabled={isProcessing}
          />
          <div className="flex items-center gap-1">
            {messages.length > 0 && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={clearChat}
                className="rounded-full h-9 w-9"
                title="Clear chat"
              >
                <X className="w-4 h-4" />
              </Button>
            )}
            <Button
              type="submit"
              size="icon"
              disabled={!input.trim() || isProcessing}
              className="rounded-full h-9 w-9"
            >
              {isProcessing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  )
}
