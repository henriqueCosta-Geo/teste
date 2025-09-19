'use client'

import { useState, useRef } from 'react'
import { Upload, X, Image, AlertCircle, CheckCircle } from 'lucide-react'

interface LogoUploadProps {
  customerSlug: string
  currentLogoPath?: string
  onLogoChange: (logoPath: string) => void
  disabled?: boolean
}

export default function LogoUpload({
  customerSlug,
  currentLogoPath,
  onLogoChange,
  disabled = false
}: LogoUploadProps) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [preview, setPreview] = useState<string | null>(currentLogoPath || null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Validações client-side
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      setError('Tipo de arquivo não suportado. Use JPG, PNG, GIF ou WebP')
      return
    }

    const maxSize = 5 * 1024 * 1024 // 5MB
    if (file.size > maxSize) {
      setError('Arquivo muito grande. Máximo 5MB')
      return
    }

    // Criar preview
    const reader = new FileReader()
    reader.onload = (e) => {
      setPreview(e.target?.result as string)
    }
    reader.readAsDataURL(file)

    // Upload do arquivo
    setUploading(true)
    setError('')
    setSuccess('')

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('customerSlug', customerSlug)

      const response = await fetch('/api/upload/logo', {
        method: 'POST',
        body: formData
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Erro no upload')
      }

      setSuccess('Logo uploaded com sucesso!')
      onLogoChange(result.logoPath)

      // Limpar mensagem de sucesso após 3 segundos
      setTimeout(() => setSuccess(''), 3000)

    } catch (error: any) {
      setError(error.message || 'Erro no upload do logo')
      setPreview(currentLogoPath || null)
    } finally {
      setUploading(false)
    }
  }

  const handleRemoveLogo = () => {
    setPreview(null)
    onLogoChange('')
    setSuccess('')
    setError('')
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const triggerFileSelect = () => {
    fileInputRef.current?.click()
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Logo do Customer
        </label>
        <p className="text-xs text-gray-500 mb-3">
          Formatos suportados: JPG, PNG, GIF, WebP. Máximo 5MB.
        </p>
      </div>

      {/* Preview Area */}
      <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">
        {preview ? (
          <div className="flex items-center justify-center">
            <div className="relative">
              <img
                src={preview}
                alt="Logo preview"
                className="max-h-32 max-w-48 object-contain rounded-lg shadow-sm"
              />
              {!disabled && (
                <button
                  onClick={handleRemoveLogo}
                  className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
                  title="Remover logo"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>
        ) : (
          <div
            className={`flex flex-col items-center justify-center py-8 ${
              !disabled ? 'cursor-pointer hover:bg-gray-50' : 'cursor-not-allowed opacity-60'
            } transition-colors`}
            onClick={!disabled ? triggerFileSelect : undefined}
          >
            <div className="p-3 bg-gray-100 rounded-full mb-3">
              <Image size={24} className="text-gray-400" />
            </div>
            <p className="text-sm text-gray-600 mb-1">
              {uploading ? 'Fazendo upload...' : 'Clique para selecionar um logo'}
            </p>
            <p className="text-xs text-gray-400">
              ou arraste e solte aqui
            </p>
          </div>
        )}
      </div>

      {/* Input oculto */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        disabled={disabled || uploading}
        className="hidden"
      />

      {/* Botões de ação */}
      {!disabled && (
        <div className="flex gap-2">
          <button
            onClick={triggerFileSelect}
            disabled={uploading}
            className="btn-outline flex items-center gap-2"
          >
            <Upload size={16} />
            {uploading ? 'Fazendo upload...' : preview ? 'Alterar Logo' : 'Selecionar Logo'}
          </button>

          {preview && (
            <button
              onClick={handleRemoveLogo}
              disabled={uploading}
              className="btn-ghost text-red-600 hover:text-red-800"
            >
              <X size={16} />
              Remover
            </button>
          )}
        </div>
      )}

      {/* Mensagens de status */}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700">
          <AlertCircle size={16} />
          <span className="text-sm">{error}</span>
        </div>
      )}

      {success && (
        <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700">
          <CheckCircle size={16} />
          <span className="text-sm">{success}</span>
        </div>
      )}
    </div>
  )
}