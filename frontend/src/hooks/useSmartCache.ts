import { useState, useEffect, useCallback, useRef } from 'react'

interface CacheConfig {
  maxAge?: number // em ms
  maxItems?: number
  persistToLocalStorage?: boolean
  prefetchStrategy?: 'aggressive' | 'moderate' | 'conservative'
}

interface CacheItem<T> {
  data: T
  timestamp: number
  lastAccessed: number
  hitCount: number
}

class SmartCache<T> {
  private cache = new Map<string, CacheItem<T>>()
  private config: Required<CacheConfig>
  
  constructor(config: CacheConfig = {}) {
    this.config = {
      maxAge: 5 * 60 * 1000, // 5 minutos
      maxItems: 100,
      persistToLocalStorage: true,
      prefetchStrategy: 'moderate',
      ...config
    }
    
    if (this.config.persistToLocalStorage) {
      this.loadFromStorage()
    }
  }

  set(key: string, data: T): void {
    const now = Date.now()
    
    // Limpar cache antigo se necessário
    if (this.cache.size >= this.config.maxItems) {
      this.cleanup()
    }
    
    this.cache.set(key, {
      data,
      timestamp: now,
      lastAccessed: now,
      hitCount: 0
    })
    
    if (this.config.persistToLocalStorage) {
      this.saveToStorage()
    }
  }

  get(key: string): T | null {
    const item = this.cache.get(key)
    
    if (!item) return null
    
    const now = Date.now()
    
    // Verificar se expirou
    if (now - item.timestamp > this.config.maxAge) {
      this.cache.delete(key)
      return null
    }
    
    // Atualizar estatísticas de acesso
    item.lastAccessed = now
    item.hitCount++
    
    return item.data
  }

  has(key: string): boolean {
    return this.get(key) !== null
  }

  delete(key: string): void {
    this.cache.delete(key)
    if (this.config.persistToLocalStorage) {
      this.saveToStorage()
    }
  }

  clear(): void {
    this.cache.clear()
    if (this.config.persistToLocalStorage) {
      localStorage.removeItem('smart-cache')
    }
  }

  private cleanup(): void {
    const now = Date.now()
    const items = Array.from(this.cache.entries())
    
    // Remover itens expirados primeiro
    items.forEach(([key, item]) => {
      if (now - item.timestamp > this.config.maxAge) {
        this.cache.delete(key)
      }
    })
    
    // Se ainda estiver cheio, remover itens menos usados
    if (this.cache.size >= this.config.maxItems) {
      const sortedByUsage = items
        .filter(([key]) => this.cache.has(key))
        .sort(([, a], [, b]) => {
          // Priorizar por hit count e acesso recente
          const scoreA = a.hitCount * (1 / (now - a.lastAccessed))
          const scoreB = b.hitCount * (1 / (now - b.lastAccessed))
          return scoreA - scoreB
        })
      
      // Remover 25% dos itens menos usados
      const toRemove = Math.floor(this.config.maxItems * 0.25)
      sortedByUsage.slice(0, toRemove).forEach(([key]) => {
        this.cache.delete(key)
      })
    }
  }

  private saveToStorage(): void {
    try {
      const data = Array.from(this.cache.entries())
      localStorage.setItem('smart-cache', JSON.stringify(data))
    } catch (error) {
      console.warn('Failed to save cache to localStorage:', error)
    }
  }

  private loadFromStorage(): void {
    try {
      const data = localStorage.getItem('smart-cache')
      if (data) {
        const items: [string, CacheItem<T>][] = JSON.parse(data)
        const now = Date.now()
        
        items.forEach(([key, item]) => {
          // Só carregar itens que não expiraram
          if (now - item.timestamp <= this.config.maxAge) {
            this.cache.set(key, item)
          }
        })
      }
    } catch (error) {
      console.warn('Failed to load cache from localStorage:', error)
    }
  }
}

// Hook para uso do cache
export const useSmartCache = <T>(config?: CacheConfig) => {
  const cacheRef = useRef<SmartCache<T>>()
  
  if (!cacheRef.current) {
    cacheRef.current = new SmartCache<T>(config)
  }
  
  return cacheRef.current
}

// Hook para API calls com cache inteligente
export const useCachedAPI = <T>(
  key: string,
  fetcher: () => Promise<T>,
  options: {
    cacheConfig?: CacheConfig
    onSuccess?: (data: T) => void
    onError?: (error: Error) => void
    refetchInterval?: number
    enabled?: boolean
  } = {}
) => {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  
  const cache = useSmartCache<T>(options.cacheConfig)
  const intervalRef = useRef<NodeJS.Timeout>()
  const abortControllerRef = useRef<AbortController>()

  const fetchData = useCallback(async (force = false) => {
    // Verificar cache primeiro
    if (!force) {
      const cached = cache.get(key)
      if (cached) {
        setData(cached)
        setLoading(false)
        options.onSuccess?.(cached)
        return cached
      }
    }

    // Cancelar requisição anterior se existir
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }

    abortControllerRef.current = new AbortController()
    setLoading(true)
    setError(null)

    try {
      const result = await fetcher()
      
      // Verificar se não foi cancelado
      if (!abortControllerRef.current.signal.aborted) {
        cache.set(key, result)
        setData(result)
        options.onSuccess?.(result)
      }
      
      return result
    } catch (err) {
      if (!abortControllerRef.current.signal.aborted) {
        const error = err instanceof Error ? err : new Error('Fetch failed')
        setError(error)
        options.onError?.(error)
      }
      throw err
    } finally {
      if (!abortControllerRef.current.signal.aborted) {
        setLoading(false)
      }
    }
  }, [key, fetcher, cache, options])

  // Auto-fetch quando enabled muda
  useEffect(() => {
    if (options.enabled !== false) {
      fetchData()
    }
  }, [fetchData, options.enabled])

  // Configurar refetch interval
  useEffect(() => {
    if (options.refetchInterval && options.enabled !== false) {
      intervalRef.current = setInterval(() => {
        fetchData(true)
      }, options.refetchInterval)
      
      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current)
        }
      }
    }
  }, [fetchData, options.refetchInterval, options.enabled])

  // Cleanup
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [])

  const refetch = useCallback(() => fetchData(true), [fetchData])
  const invalidate = useCallback(() => {
    cache.delete(key)
    return fetchData(true)
  }, [cache, key, fetchData])

  return {
    data,
    loading,
    error,
    refetch,
    invalidate,
    isFromCache: !loading && !!cache.get(key)
  }
}

// Hook para prefetch inteligente
export const usePrefetch = () => {
  const cache = useSmartCache()

  const prefetch = useCallback(async <T>(
    key: string,
    fetcher: () => Promise<T>,
    priority: 'high' | 'low' = 'low'
  ) => {
    // Só prefetch se não estiver em cache
    if (cache.has(key)) return

    // Usar requestIdleCallback para low priority
    const execute = async () => {
      try {
        const data = await fetcher()
        cache.set(key, data)
      } catch (error) {
        // Silenciar erros de prefetch
        console.debug('Prefetch failed for key:', key, error)
      }
    }

    if (priority === 'high') {
      execute()
    } else {
      // Low priority - usar idle time
      if ('requestIdleCallback' in window) {
        requestIdleCallback(() => execute())
      } else {
        setTimeout(() => execute(), 100)
      }
    }
  }, [cache])

  return { prefetch }
}