import React, { memo } from 'react'
import { useIntersectionObserver } from '@/hooks/useIntersectionObserver'
import { Skeleton } from './skeleton'

interface LazyCardProps {
  children: React.ReactNode
  className?: string
  skeletonComponent?: React.ComponentType
  delay?: number
}

const LazyCard: React.FC<LazyCardProps> = memo(({ 
  children, 
  className = '',
  skeletonComponent: SkeletonComponent,
  delay = 0
}) => {
  const { ref, isVisible } = useIntersectionObserver({
    threshold: 0.1,
    rootMargin: '100px',
    triggerOnce: true
  })

  return (
    <div ref={ref} className={className}>
      {isVisible ? (
        <div 
          className="fade-in gpu-accelerated"
          style={{ animationDelay: `${delay}ms` }}
        >
          {children}
        </div>
      ) : (
        SkeletonComponent ? <SkeletonComponent /> : (
          <div className="gpu-accelerated">
            <Skeleton height={300} className="rounded-2xl" />
          </div>
        )
      )}
    </div>
  )
})

LazyCard.displayName = 'LazyCard'

export { LazyCard }

// Componente otimizado para grids grandes
interface VirtualizedGridProps<T> {
  items: T[]
  renderItem: (item: T, index: number) => React.ReactNode
  itemHeight: number
  className?: string
  gap?: number
}

export const VirtualizedGrid = memo(<T,>({ 
  items, 
  renderItem, 
  itemHeight,
  className = '',
  gap = 32
}: VirtualizedGridProps<T>) => {
  const containerRef = React.useRef<HTMLDivElement>(null)
  const [containerHeight, setContainerHeight] = React.useState(600)
  const [scrollTop, setScrollTop] = React.useState(0)

  React.useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const updateHeight = () => setContainerHeight(container.clientHeight)
    updateHeight()
    
    window.addEventListener('resize', updateHeight)
    return () => window.removeEventListener('resize', updateHeight)
  }, [])

  const effectiveItemHeight = itemHeight + gap
  const startIndex = Math.floor(scrollTop / effectiveItemHeight)
  const visibleCount = Math.ceil(containerHeight / effectiveItemHeight) + 2
  const endIndex = Math.min(startIndex + visibleCount, items.length)

  const visibleItems = items.slice(startIndex, endIndex)
  const totalHeight = items.length * effectiveItemHeight

  const handleScroll = React.useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop)
  }, [])

  return (
    <div 
      ref={containerRef}
      className={`overflow-auto smooth-scroll ${className}`}
      style={{ height: containerHeight }}
      onScroll={handleScroll}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        <div 
          style={{ 
            transform: `translateY(${startIndex * effectiveItemHeight}px)`,
            willChange: 'transform'
          }}
          className="gpu-accelerated"
        >
          {visibleItems.map((item, localIndex) => {
            const globalIndex = startIndex + localIndex
            return (
              <div 
                key={globalIndex}
                style={{ 
                  height: itemHeight, 
                  marginBottom: gap,
                  willChange: 'transform'
                }}
                className="gpu-accelerated"
              >
                {renderItem(item, globalIndex)}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
})

VirtualizedGrid.displayName = 'VirtualizedGrid'