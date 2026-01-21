'use client'

import { motion } from 'framer-motion'
import { ExternalLink, Check, RotateCcw, Trash2, MapPin, DollarSign } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Item } from '@/lib/supabase'

interface ItemCardProps {
  item: Item
  onToggleDone: (id: string, done: boolean) => void
  onDelete: (id: string) => void
}

const categoryVariants: Record<string, 'activity' | 'food' | 'travel' | 'entertainment' | 'nightlife' | 'shopping' | 'other'> = {
  Activity: 'activity',
  Food: 'food',
  Travel: 'travel',
  Entertainment: 'entertainment',
  Nightlife: 'nightlife',
  Shopping: 'shopping',
  Other: 'other',
}

export function ItemCard({ item, onToggleDone, onDelete }: ItemCardProps) {
  const badgeVariant = categoryVariants[item.category] || 'other'

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      whileHover={{ y: -2 }}
      transition={{ duration: 0.2 }}
    >
      <Card className={`group overflow-hidden transition-all hover:shadow-md ${item.done ? 'opacity-60' : ''}`}>
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              {/* Header with badges */}
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <Badge variant={badgeVariant}>{item.category}</Badge>
                {item.place?.type && (
                  <Badge variant="outline" className="text-xs">
                    {item.place.type}
                  </Badge>
                )}
                {item.done && (
                  <Badge variant="secondary" className="text-xs">
                    Done
                  </Badge>
                )}
              </div>

              {/* Title */}
              <p className={`font-medium leading-relaxed ${item.done ? 'line-through text-muted-foreground' : ''}`}>
                {item.text}
              </p>

              {/* Place details */}
              {item.place && (
                <div className="mt-2 space-y-1">
                  <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                    {item.place.neighborhood && (
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {item.place.neighborhood}
                      </span>
                    )}
                    {item.place.priceRange && (
                      <span className="flex items-center gap-1">
                        <DollarSign className="w-3 h-3" />
                        {item.place.priceRange}
                      </span>
                    )}
                  </div>

                  {item.place.knownFor && (
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {item.place.knownFor}
                    </p>
                  )}

                  {item.place.tips && (
                    <p className="text-xs text-primary/70 italic line-clamp-1">
                      💡 {item.place.tips}
                    </p>
                  )}
                </div>
              )}

              {/* Link */}
              {item.link && (
                <a
                  href={item.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-2"
                >
                  <ExternalLink className="w-3 h-3" />
                  {item.place ? 'View on Maps' : 'Open link'}
                </a>
              )}
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => onToggleDone(item.id, !item.done)}
              >
                {item.done ? (
                  <RotateCcw className="w-4 h-4" />
                ) : (
                  <Check className="w-4 h-4 text-green-600" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                onClick={() => onDelete(item.id)}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Timestamp */}
          <p className="text-xs text-muted-foreground mt-3">
            {new Date(item.created_at).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </p>
        </CardContent>
      </Card>
    </motion.div>
  )
}
