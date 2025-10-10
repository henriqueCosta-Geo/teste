'use client'

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import type { TokensByDay } from '@/lib/admin-types'

interface TokensByDayChartProps {
  data: TokensByDay[]
}

export default function TokensByDayChart({ data }: TokensByDayChartProps) {
  // Formatar data para exibição
  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
  }

  // Formatar números para tooltip
  const formatNumber = (value: number) => {
    return value.toLocaleString('pt-BR')
  }

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="card p-3" style={{ backgroundColor: 'var(--bg-primary)' }}>
          <p className="font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
            {formatDate(label)}
          </p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.name}: {formatNumber(entry.value)}
            </p>
          ))}
        </div>
      )
    }
    return null
  }

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
        📈 Consumo de Tokens por Dia
      </h2>

      <div className="card p-6">
        <ResponsiveContainer width="100%" height={350}>
          <LineChart
            data={data}
            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
            <XAxis
              dataKey="date"
              tickFormatter={formatDate}
              style={{ fontSize: '12px', fill: 'var(--text-secondary)' }}
            />
            <YAxis
              tickFormatter={formatNumber}
              style={{ fontSize: '12px', fill: 'var(--text-secondary)' }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{ fontSize: '14px', color: 'var(--text-primary)' }}
            />
            <Line
              type="monotone"
              dataKey="total_tokens"
              name="Total"
              stroke="#3B82F6"
              strokeWidth={2}
              dot={{ r: 4 }}
              activeDot={{ r: 6 }}
            />
            <Line
              type="monotone"
              dataKey="input_tokens"
              name="Input"
              stroke="#10B981"
              strokeWidth={2}
              dot={{ r: 3 }}
              strokeDasharray="5 5"
            />
            <Line
              type="monotone"
              dataKey="output_tokens"
              name="Output"
              stroke="#F59E0B"
              strokeWidth={2}
              dot={{ r: 3 }}
              strokeDasharray="5 5"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
