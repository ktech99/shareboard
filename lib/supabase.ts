import { createClient, SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const isSupabaseConfigured = !!(supabaseUrl && supabaseAnonKey && !supabaseUrl.includes('placeholder'))

let supabase: SupabaseClient | null = null

if (isSupabaseConfigured) {
  supabase = createClient(supabaseUrl!, supabaseAnonKey!)
}

export { supabase }

export interface PlaceInfo {
  name: string
  type: string
  neighborhood: string | null
  address: string | null
  description: string | null
  knownFor: string | null
  priceRange: string | null
  tips: string | null
}

export interface Item {
  id: string
  text: string
  category: string
  link: string | null
  done: boolean
  created_at: string
  // Rich place data (optional)
  place?: PlaceInfo
}

const STORAGE_KEY = 'friendlist_items'

// Helper to generate UUID
function generateId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

// localStorage helpers
function getLocalItems(): Item[] {
  if (typeof window === 'undefined') return []
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored ? JSON.parse(stored) : []
  } catch {
    return []
  }
}

function setLocalItems(items: Item[]): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
}

// Main functions with localStorage fallback
export async function getItems(): Promise<Item[]> {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from('items')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching items:', error)
      return getLocalItems()
    }

    return data || []
  }

  return getLocalItems().sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )
}

export async function addItem(item: Omit<Item, 'id' | 'created_at'>): Promise<Item | null> {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from('items')
      .insert([item])
      .select()
      .single()

    if (error) {
      console.error('Error adding item:', error)
      return addItemLocally(item)
    }

    return data
  }

  return addItemLocally(item)
}

function addItemLocally(item: Omit<Item, 'id' | 'created_at'>): Item {
  const newItem: Item = {
    ...item,
    id: generateId(),
    created_at: new Date().toISOString(),
  }

  const items = getLocalItems()
  items.unshift(newItem)
  setLocalItems(items)

  return newItem
}

export async function updateItem(id: string, updates: Partial<Item>): Promise<Item | null> {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from('items')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Error updating item:', error)
      return updateItemLocally(id, updates)
    }

    return data
  }

  // Use localStorage
  return updateItemLocally(id, updates)
}

function updateItemLocally(id: string, updates: Partial<Item>): Item | null {
  const items = getLocalItems()
  const index = items.findIndex((item) => item.id === id)

  if (index === -1) return null

  items[index] = { ...items[index], ...updates }
  setLocalItems(items)

  return items[index]
}

export async function deleteItem(id: string): Promise<boolean> {
  if (isSupabaseConfigured && supabase) {
    const { error } = await supabase
      .from('items')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error deleting item:', error)
      return deleteItemLocally(id)
    }

    return true
  }

  // Use localStorage
  return deleteItemLocally(id)
}

function deleteItemLocally(id: string): boolean {
  const items = getLocalItems()
  const filtered = items.filter((item) => item.id !== id)

  if (filtered.length === items.length) return false

  setLocalItems(filtered)
  return true
}

export function subscribeToItems(callback: (items: Item[]) => void) {
  if (isSupabaseConfigured && supabase) {
    const channel = supabase
      .channel('items-channel')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'items',
        },
        async () => {
          const items = await getItems()
          callback(items)
        }
      )
      .subscribe()

    return () => {
      supabase?.removeChannel(channel)
    }
  }

  // No real-time for localStorage, return empty cleanup
  return () => {}
}

export { isSupabaseConfigured }
