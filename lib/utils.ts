import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function detectSocialLink(text: string): { type: 'tiktok' | 'instagram' | null; url: string | null } {
  const tiktokRegex = /(https?:\/\/)?(www\.)?(tiktok\.com|vm\.tiktok\.com)\/[^\s]+/i
  const instagramRegex = /(https?:\/\/)?(www\.)?(instagram\.com|instagr\.am)\/[^\s]+/i

  const tiktokMatch = text.match(tiktokRegex)
  if (tiktokMatch) {
    return { type: 'tiktok', url: tiktokMatch[0] }
  }

  const instagramMatch = text.match(instagramRegex)
  if (instagramMatch) {
    return { type: 'instagram', url: instagramMatch[0] }
  }

  return { type: null, url: null }
}
