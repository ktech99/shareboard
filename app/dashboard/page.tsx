'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { ListTodo, Loader2, X, Search } from 'lucide-react'
import { Navbar } from '@/components/navbar'
import { ItemCard } from '@/components/item-card'
import { SmartInput } from '@/components/smart-input'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Item,
  PlaceInfo,
  getItems,
  addItem,
  updateItem,
  deleteItem,
  subscribeToItems,
} from '@/lib/supabase'

export default function DashboardPage() {
  const [items, setItems] = useState<Item[]>([])
  const [showDone, setShowDone] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null)
  const router = useRouter()

  const categories = ['Food', 'Nightlife', 'Activity', 'Entertainment', 'Shopping', 'Travel', 'Other']

  // Check authentication
  useEffect(() => {
    const auth = localStorage.getItem('friendlist_auth')
    if (auth !== 'authenticated') {
      router.push('/')
    } else {
      setIsAuthenticated(true)
    }
  }, [router])

  // Load items and subscribe to real-time updates
  useEffect(() => {
    if (!isAuthenticated) return

    const loadItems = async () => {
      setIsLoading(true)
      const fetchedItems = await getItems()
      setItems(fetchedItems)
      setIsLoading(false)
    }

    loadItems()

    // Subscribe to real-time updates
    const unsubscribe = subscribeToItems((updatedItems) => {
      setItems(updatedItems)
    })

    return () => {
      unsubscribe()
    }
  }, [isAuthenticated])

  const handleAddItem = async (text: string, category: string, link: string | null, place?: PlaceInfo) => {
    const newItem = await addItem({ text, category, link, done: false, place })
    if (newItem) {
      setItems((prev) => [newItem, ...prev])
    }
  }

  const handleEditItem = async (id: string, text: string, category: string) => {
    const updated = await updateItem(id, { text, category })
    if (updated) {
      setItems((prev) =>
        prev.map((item) => (item.id === id ? { ...item, text, category } : item))
      )
    }
  }

  const handleToggleDone = async (id: string, done: boolean) => {
    const updated = await updateItem(id, { done })
    if (updated) {
      setItems((prev) =>
        prev.map((item) => (item.id === id ? { ...item, done } : item))
      )
    }
  }

  const handleDelete = async (id: string) => {
    const success = await deleteItem(id)
    if (success) {
      setItems((prev) => prev.filter((item) => item.id !== id))
    }
  }

  const handleSearch = (query: string) => {
    setSearchQuery(query)
  }

  const clearFilters = () => {
    setSearchQuery('')
    setCategoryFilter(null)
  }

  // Filter items based on search, category, and done status
  const filteredItems = useMemo(() => {
    let result = items

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      result = result.filter(
        (item) =>
          item.text.toLowerCase().includes(query) ||
          item.category.toLowerCase().includes(query) ||
          item.place?.neighborhood?.toLowerCase().includes(query) ||
          item.place?.type?.toLowerCase().includes(query)
      )
    }

    // Apply category filter
    if (categoryFilter) {
      result = result.filter((item) => item.category === categoryFilter)
    }

    // Apply done filter
    if (!showDone) {
      result = result.filter((item) => !item.done)
    }

    return result
  }, [items, searchQuery, categoryFilter, showDone])

  const hasActiveFilters = searchQuery || categoryFilter

  const doneCount = items.filter((item) => item.done).length

  // Count items per category (excluding done items unless showDone is true)
  const categoryCounts = useMemo(() => {
    const baseItems = showDone ? items : items.filter(i => !i.done)
    return categories.reduce((acc, cat) => {
      acc[cat] = baseItems.filter(item => item.category === cat).length
      return acc
    }, {} as Record<string, number>)
  }, [items, showDone])

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/10">
      <Navbar />

      <main className="container mx-auto px-4 md:px-8 py-8 max-w-5xl">
        {/* Smart Input */}
        <SmartInput
          items={items}
          onAdd={handleAddItem}
          onEdit={handleEditItem}
          onDelete={handleDelete}
          onSearch={handleSearch}
        />

        {/* Filters */}
        <div className="mt-8 mb-6 space-y-4">
          {/* Header row */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Your List</h2>
              <p className="text-sm text-muted-foreground">
                {filteredItems.length} item{filteredItems.length !== 1 ? 's' : ''}
                {doneCount > 0 && !showDone && ` • ${doneCount} done`}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="show-done"
                checked={showDone}
                onCheckedChange={setShowDone}
              />
              <Label htmlFor="show-done" className="text-sm cursor-pointer">
                Show done
              </Label>
            </div>
          </div>

          {/* Search and filters row */}
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Search bar */}
            <div className="relative flex-shrink-0 sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search items..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9 rounded-full bg-secondary/50 border-0 focus-visible:ring-1"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Category filters */}
            <div className="flex items-center gap-2 flex-wrap flex-1">
              {categories.map((category) => {
                const count = categoryCounts[category] || 0
                const isActive = categoryFilter === category
                return (
                  <button
                    key={category}
                    onClick={() =>
                      setCategoryFilter(isActive ? null : category)
                    }
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                      isActive
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'bg-secondary/50 text-muted-foreground hover:bg-secondary hover:text-foreground'
                    }`}
                  >
                    {category}
                    {count > 0 && (
                      <span className={`inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-semibold ${
                        isActive
                          ? 'bg-primary-foreground/20 text-primary-foreground'
                          : 'bg-background text-muted-foreground'
                      }`}>
                        {count}
                      </span>
                    )}
                  </button>
                )
              })}

              {/* Clear all filters */}
              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearFilters}
                  className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                >
                  <X className="w-3 h-3 mr-1" />
                  Clear
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Items Grid */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : filteredItems.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-20"
          >
            <div className="w-16 h-16 bg-secondary rounded-2xl flex items-center justify-center mx-auto mb-4">
              <ListTodo className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium mb-2">
              {hasActiveFilters
                ? 'No matching items'
                : showDone
                ? 'No items yet'
                : 'All caught up!'}
            </h3>
            <p className="text-muted-foreground text-sm max-w-sm mx-auto">
              {hasActiveFilters
                ? `No items match your filters. Try adjusting your search or category.`
                : showDone
                ? 'Ask for recommendations like "best bars in East Village" or add a specific place.'
                : 'No pending items. Toggle "Show done" to see completed items or add something new!'}
            </p>
          </motion.div>
        ) : (
          <motion.div
            layout
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
          >
            <AnimatePresence mode="popLayout">
              {filteredItems.map((item) => (
                <ItemCard
                  key={item.id}
                  item={item}
                  onToggleDone={handleToggleDone}
                  onDelete={handleDelete}
                />
              ))}
            </AnimatePresence>
          </motion.div>
        )}
      </main>
    </div>
  )
}
