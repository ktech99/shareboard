'use client'

import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Users, LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function Navbar() {
  const router = useRouter()

  const handleLogout = () => {
    localStorage.removeItem('friendlist_auth')
    localStorage.removeItem('friendlist_auth_time')
    router.push('/')
  }

  return (
    <motion.nav
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="sticky top-0 z-50 w-full border-b bg-background/80 backdrop-blur-lg"
    >
      <div className="container flex h-16 items-center justify-between px-4 md:px-8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
            <Users className="w-5 h-5 text-primary" />
          </div>
          <span className="text-xl font-display font-bold tracking-tight">
            FriendList
          </span>
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={handleLogout}
          className="gap-2 text-muted-foreground hover:text-foreground"
        >
          <LogOut className="w-4 h-4" />
          <span className="hidden sm:inline">Logout</span>
        </Button>
      </div>
    </motion.nav>
  )
}
