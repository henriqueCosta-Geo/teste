import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { join } from 'path'

// Força uso do Node.js runtime para poder usar fs
export const runtime = 'nodejs'

export async function GET(
  request: NextRequest,
  { params }: { params: { filename: string } }
) {
  try {
    const filename = params?.filename

    // Validar nome do arquivo para segurança
    if (!filename || filename.includes('..') || filename.includes('/')) {
      return NextResponse.json({ error: 'Nome de arquivo inválido' }, { status: 400 })
    }

    // Caminho do arquivo
    const filePath = join(process.cwd(), 'public', 'logos', filename)

    try {
      // Ler o arquivo
      const fileBuffer = await readFile(filePath)

      // Determinar content-type baseado na extensão
      const extension = filename.split('.').pop()?.toLowerCase()
      let contentType = 'application/octet-stream'

      switch (extension) {
        case 'png':
          contentType = 'image/png'
          break
        case 'jpg':
        case 'jpeg':
          contentType = 'image/jpeg'
          break
        case 'gif':
          contentType = 'image/gif'
          break
        case 'webp':
          contentType = 'image/webp'
          break
        case 'svg':
          contentType = 'image/svg+xml'
          break
      }

      // Converter Buffer para Uint8Array (compatível com Response)
      const uint8Array = new Uint8Array(fileBuffer)

      return new Response(uint8Array, {
        headers: {
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=31536000, immutable',
        },
      })

    } catch (fileError) {
      // Arquivo não encontrado, retornar 404
      return NextResponse.json({ error: 'Logo não encontrado' }, { status: 404 })
    }

  } catch (error) {
    console.error('Erro ao servir logo:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}