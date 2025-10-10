import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'

// POST /api/upload/logo - Upload de logo para customer
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!['ADMIN', 'SUPER_USER'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File
    const customerSlug = formData.get('customerSlug') as string

    if (!file) {
      return NextResponse.json({ error: 'Nenhum arquivo enviado' }, { status: 400 })
    }

    if (!customerSlug) {
      return NextResponse.json({ error: 'Customer slug é obrigatório' }, { status: 400 })
    }

    // Validar tipo de arquivo
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({
        error: 'Tipo de arquivo não suportado. Use JPG, PNG, GIF ou WebP'
      }, { status: 400 })
    }

    // Validar tamanho (máximo 5MB)
    const maxSize = 5 * 1024 * 1024 // 5MB
    if (file.size > maxSize) {
      return NextResponse.json({
        error: 'Arquivo muito grande. Máximo 5MB'
      }, { status: 400 })
    }

    // Criar diretório de logos se não existir
    const logosDir = join(process.cwd(), 'public', 'logos')
    await mkdir(logosDir, { recursive: true })

    // Gerar nome do arquivo
    const fileExtension = file.name.split('.').pop()
    const fileName = `${customerSlug}-logo.${fileExtension}`
    const filePath = join(logosDir, fileName)

    // Salvar arquivo
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    await writeFile(filePath, buffer)

    // Retornar path estático (funciona após script de build copiar public/ para standalone)
    const relativePath = `/logos/${fileName}`

    return NextResponse.json({
      success: true,
      logoPath: relativePath,
      message: 'Logo uploaded com sucesso'
    })

  } catch (error) {
    console.error('Erro no upload do logo:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}