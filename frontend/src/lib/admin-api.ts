/**
 * API Client para Dashboard de Administração
 * Usa proxy Next.js para evitar problemas de CORS
 */

import type { DashboardData } from './admin-types'

export const adminAPI = {
  /**
   * Obter dados do dashboard para um customer específico
   */
  async getDashboard(
    customerId: number,
    daysBack: number = 30
  ): Promise<DashboardData> {
    const response = await fetch(
      `/api/proxy/api/admin/dashboard/${customerId}?days_back=${daysBack}`,
      {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    )

    if (!response.ok) {
      if (response.status === 403) {
        throw new Error('Acesso negado. Você não tem permissão para visualizar este dashboard.')
      }
      if (response.status === 404) {
        throw new Error('Customer não encontrado.')
      }
      throw new Error('Erro ao carregar dashboard')
    }

    return response.json()
  },

  /**
   * Exportar conversas do mês atual em JSON
   */
  async exportConversationsMonth(customerId: number): Promise<Blob> {
    const now = new Date()
    const year = now.getFullYear()
    const month = now.getMonth() + 1 // JavaScript months are 0-indexed

    const response = await fetch(
      `/api/proxy/api/admin/customers/${customerId}/export-conversations?year=${year}&month=${month}`,
      {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    )

    if (!response.ok) {
      throw new Error('Erro ao exportar conversas do mês')
    }

    return await response.blob()
  },

  /**
   * Baixar export de dados
   */
  downloadExport(blob: Blob, filename: string) {
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)
  },
}
