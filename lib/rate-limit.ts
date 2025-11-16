// lib/rate-limit.ts
import { LRUCache } from 'lru-cache'

const rateLimitCache = new LRUCache({
  max: 500,
  ttl: 60 * 1000, // 1 minute
})

export async function rateLimit(request: Request) {
  const ip = request.headers.get('x-forwarded-for') || 'anonymous'
  const current = rateLimitCache.get(ip) as number || 0
  
  if (current >= 10) { // 10 requests per minute
    return { success: false }
  }
  
  rateLimitCache.set(ip, current + 1)
  return { success: true }
}