import React from 'react'

interface SkeletonProps {
  className?: string
  width?: string | number
  height?: string | number
  rounded?: boolean
}

export const Skeleton: React.FC<SkeletonProps> = ({ 
  className = '', 
  width = '100%', 
  height = '1rem',
  rounded = true 
}) => {
  return (
    <div 
      className={`loading-skeleton gpu-accelerated ${rounded ? 'rounded-lg' : ''} ${className}`}
      style={{ width, height }}
    />
  )
}

// Skeleton específicos para componentes
export const AgentCardSkeleton: React.FC = () => (
  <div className="card-modern gpu-accelerated">
    <div className="flex justify-between items-start mb-6">
      <div className="flex items-center gap-4">
        <Skeleton width={60} height={60} className="rounded-2xl" />
        <div>
          <Skeleton width={120} height={24} className="mb-2" />
          <Skeleton width={80} height={16} />
        </div>
      </div>
      <div className="flex items-center gap-3">
        <Skeleton width={60} height={24} className="rounded-full" />
        <Skeleton width={32} height={32} className="rounded-lg" />
      </div>
    </div>

    <Skeleton width="100%" height={48} className="mb-6" />

    <div className="grid grid-cols-2 gap-4 mb-6">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="p-4 rounded-xl border">
          <Skeleton width={60} height={12} className="mb-2" />
          <Skeleton width={80} height={16} />
        </div>
      ))}
    </div>

    <div className="flex gap-3">
      <Skeleton width="100%" height={48} className="rounded-xl" />
      <Skeleton width={100} height={48} className="rounded-xl" />
    </div>
  </div>
)

export const TeamCardSkeleton: React.FC = () => (
  <div className="card-modern gpu-accelerated">
    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
      <div className="flex-1">
        <div className="flex items-center gap-4 mb-4">
          <Skeleton width={60} height={60} className="rounded-2xl" />
          <div>
            <Skeleton width={200} height={32} className="mb-2" />
            <Skeleton width={60} height={24} className="rounded-full" />
          </div>
        </div>

        <Skeleton width="80%" height={20} className="mb-6" />

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="p-4 rounded-xl border">
              <Skeleton width={60} height={12} className="mb-2" />
              <Skeleton width={100} height={16} className="mb-1" />
              <Skeleton width={80} height={14} />
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="p-3 rounded-lg border">
              <Skeleton width={120} height={16} className="mb-1" />
              <Skeleton width={80} height={12} />
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Skeleton width={100} height={48} className="rounded-xl" />
        <Skeleton width={80} height={48} className="rounded-xl" />
        <Skeleton width={40} height={48} className="rounded-xl" />
      </div>
    </div>
  </div>
)

export const HeaderSkeleton: React.FC = () => (
  <div className="card-modern gpu-accelerated">
    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
      <div className="space-y-2">
        <Skeleton width={300} height={48} className="mb-2" />
        <Skeleton width={400} height={24} className="mb-4" />
        <div className="flex items-center gap-4">
          <Skeleton width={100} height={20} />
          <Skeleton width={100} height={20} />
        </div>
      </div>
      <Skeleton width={150} height={48} className="rounded-xl" />
    </div>
  </div>
)

// Grid skeleton com stagger effect
export const GridSkeleton: React.FC<{ 
  items?: number
  type?: 'agent' | 'team'
}> = ({ items = 6, type = 'agent' }) => (
  <div className={`grid ${type === 'agent' ? 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8' : 'space-y-6'}`}>
    {Array.from({ length: items }).map((_, index) => (
      <div 
        key={index} 
        className={`fade-in stagger-${Math.min(index % 4, 4)}`}
      >
        {type === 'agent' ? <AgentCardSkeleton /> : <TeamCardSkeleton />}
      </div>
    ))}
  </div>
)