const fs = require('fs');
const path = require('path');

/**
 * Script para copiar a pasta public/ para o build standalone
 * Necessário porque Next.js standalone mode não copia arquivos estáticos automaticamente
 */

const publicDir = path.join(__dirname, '..', 'public');
const standalonePublicDir = path.join(__dirname, '..', '.next', 'standalone', 'public');

console.log('📁 Copiando pasta public/ para .next/standalone/...');
console.log(`   Source: ${publicDir}`);
console.log(`   Dest: ${standalonePublicDir}`);

// Verificar se o diretório standalone existe
if (!fs.existsSync(path.join(__dirname, '..', '.next', 'standalone'))) {
  console.log('⚠️  Diretório .next/standalone não existe. Build standalone não foi criado.');
  process.exit(0);
}

// Verificar se a pasta public/ existe
if (!fs.existsSync(publicDir)) {
  console.error('❌ Pasta public/ não encontrada em:', publicDir);
  console.log('⚠️  Isso é normal em alguns ambientes de build.');
  console.log('💡 Certifique-se de que a pasta public/ existe e contém os arquivos estáticos.');
  process.exit(0); // Exit sem erro para não quebrar o build
}

// Função recursiva para copiar diretórios
function copyRecursiveSync(src, dest) {
  if (!fs.existsSync(src)) {
    console.log(`⚠️  Source não existe: ${src}`);
    return;
  }

  const stats = fs.statSync(src);
  const isDirectory = stats.isDirectory();

  if (isDirectory) {
    // Criar diretório de destino se não existir
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }

    // Copiar todos os arquivos e subdiretórios
    fs.readdirSync(src).forEach(function(childItemName) {
      copyRecursiveSync(
        path.join(src, childItemName),
        path.join(dest, childItemName)
      );
    });
  } else {
    // Criar diretório pai do arquivo se não existir
    const destDir = path.dirname(dest);
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }
    // Copiar arquivo
    fs.copyFileSync(src, dest);
  }
}

try {
  copyRecursiveSync(publicDir, standalonePublicDir);

  // Verificar se o diretório de destino foi realmente criado
  if (!fs.existsSync(standalonePublicDir)) {
    console.log('⚠️  Nenhum arquivo foi copiado (diretório de destino não existe)');
    process.exit(0);
  }

  console.log('✅ Pasta public/ copiada com sucesso para .next/standalone/public/');

  // Contar arquivos copiados
  const countFiles = (dir) => {
    let count = 0;
    try {
      const files = fs.readdirSync(dir);
      files.forEach(file => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        if (stat.isDirectory()) {
          count += countFiles(filePath);
        } else {
          count++;
        }
      });
    } catch (err) {
      console.warn(`⚠️  Erro ao contar arquivos em ${dir}:`, err.message);
    }
    return count;
  };

  const fileCount = countFiles(standalonePublicDir);
  console.log(`📊 Total de ${fileCount} arquivos copiados`);
} catch (error) {
  console.error('❌ Erro ao copiar pasta public/:', error);
  process.exit(1);
}
