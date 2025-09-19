'use client'

import { useEffect, useState } from 'react'
import { CheckCircle, AlertCircle, Loader2 } from 'lucide-react'
import { systemAPI } from '../lib/api'
import type { SystemStatus } from '@/lib/types'

export default function StatusBar() {
  const [status, setStatus] = useState<SystemStatus | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const data = await systemAPI.getStatus()
        setStatus(data)
      } catch (error) {
        setStatus({
          status: 'error',
          qdrant_connected: false,
          qdrant_collections: [],
          error: 'Não foi possível conectar com o backend'
        })
      } finally {
        setLoading(false)
      }
    }

    checkStatus()
    
    // Verificar status a cada 30 segundos
    const interval = setInterval(checkStatus, 30000)
    
    return () => clearInterval(interval)
  }, [])

  if (loading) {
    return (
      <div className="bg-gray-100 border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-center py-2">
            <Loader2 size={16} className="animate-spin text-gray-500 mr-2" />
            <span className="text-sm text-gray-600">
              Verificando status do sistema...
            </span>
          </div>
        </div>
      </div>
    )
  }

  if (!status) return null

  const isOnline = status.status === 'online'
  const bgColor = isOnline ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
  const textColor = isOnline ? 'text-green-800' : 'text-red-800'
  const Icon = isOnline ? CheckCircle : AlertCircle

  return (
    <div className={`${bgColor} border-b`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between py-2">
          <div className={`flex items-center gap-2 ${textColor}`}>
            <Icon size={16} />
            <span className="text-sm font-medium">
              Status: {isOnline ? 'Online' : 'Offline'}
            </span>
            {status.qdrant_connected && (
              <span className="text-sm">
                | Qdrant: {status.qdrant_collections?.length || 0} coleções
              </span>
            )}
            {status.error && (
              <span className="text-sm">
                | Erro: {status.error}
              </span>
            )}
          </div>
          
          <div className="text-xs text-gray-500">
            Última verificação: {new Date().toLocaleTimeString('pt-BR')}
          </div>
        </div>
      </div>
    </div>
  )
}