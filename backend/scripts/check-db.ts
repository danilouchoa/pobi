/**
 * SCRIPT DE VERIFICAÇÃO DE SAÚDE DO MONGODB
 * 
 * Este script é usado para verificar a conectividade com o MongoDB de forma independente.
 * 
 * CASOS DE USO:
 * 1. CI/CD: Verificar se banco está pronto antes de rodar testes
 * 2. Debug local: Testar conexão sem iniciar todo o servidor
 * 3. Healthcheck alternativo: Para ambientes que não podem usar HTTP
 * 4. Monitoramento: Scripts cron que verificam saúde periodicamente
 * 
 * EXECUÇÃO:
 * ```bash
 * # Via npm script
 * npm run health:db
 * 
 * # Via node direto
 * node scripts/check-db.js
 * 
 * # Via Docker
 * docker exec finance_backend npm run health:db
 * ```
 * 
 * EXIT CODES:
 * - 0: MongoDB conectado e responsivo ✅
 * - 1: MongoDB inacessível ou erro de conexão ❌
 * 
 * Por que usar este script além do endpoint /api/health?
 * - Mais leve: Não precisa inicializar todo o Express
 * - Mais rápido: Execução direta, sem overhead HTTP
 * - Diagnóstico: Output mais detalhado para troubleshooting
 */

import { PrismaClient } from '@prisma/client';

// Inicializar cliente Prisma
const prisma = new PrismaClient({
  log: ['error'], // Mostrar apenas erros para não poluir output
});

/**
 * Função principal de verificação de saúde do MongoDB.
 * 
 * ESTRATÉGIA:
 * - Tenta executar query simples (SELECT 1)
 * - Mede tempo de resposta (latência)
 * - Exibe resultado formatado no console
 * - Retorna exit code apropriado para scripts shell
 */
async function checkDatabaseHealth() {
  console.log('🔍 Verificando conectividade com MongoDB...\n');
  
  const start = Date.now();
  
  try {
    // Executar query mais simples possível
    // Comando ping do MongoDB para verificar conectividade
    await prisma.$runCommandRaw({ ping: 1 });
    
    const latency = Date.now() - start;
    
    console.log('✅ MongoDB: CONECTADO');
    console.log(`⏱️  Latência: ${latency}ms`);
    console.log(`🔗 URL: ${getMaskedDatabaseUrl()}`);
    console.log('');
    
    // Informações adicionais úteis para debug
    console.log('📊 Informações da conexão:');
    console.log(`   - Status: OK`);
    console.log(`   - Tempo de resposta: ${latency < 100 ? 'Excelente' : latency < 500 ? 'Bom' : 'Lento'}`);
    console.log('');
    
    // Exit code 0 = sucesso
    process.exit(0);
    
  } catch (error) {
    console.error('❌ MongoDB: FALHA NA CONEXÃO\n');
    console.error('📋 Detalhes do erro:');
    console.error(`   - Mensagem: ${error.message}`);
    console.error(`   - Código: ${error.code || 'N/A'}`);
    console.error(`   - URL tentada: ${getMaskedDatabaseUrl()}`);
    console.error('');
    console.error('🔧 Possíveis causas:');
    console.error('   1. MongoDB não está rodando');
    console.error('   2. Credenciais incorretas no .env');
    console.error('   3. Firewall bloqueando conexão');
    console.error('   4. URL de conexão malformada');
    console.error('');
    console.error('💡 Soluções sugeridas:');
    console.error('   - Verifique DATABASE_URL no arquivo .env');
    console.error('   - Teste conexão com mongosh manualmente');
    console.error('   - Verifique logs do container MongoDB');
    console.error('   - Confirme que MongoDB Atlas permite seu IP');
    console.error('');
    
    // Exit code 1 = erro
    process.exit(1);
    
  } finally {
    // Sempre desconectar do Prisma para liberar recursos
    await prisma.$disconnect();
  }
}

/**
 * Retorna a URL do banco de dados com credenciais mascaradas.
 * 
 * SEGURANÇA:
 * - Nunca exibir senha/token em logs
 * - Mascarar com *** para manter privacidade
 * - Ainda mostra hostname para debug (sem expor credenciais)
 * 
 * EXEMPLO:
 * mongodb+srv://user:password@cluster.mongodb.net/db
 * ↓
 * mongodb+srv://***:***@cluster.mongodb.net/db
 * 
 * @returns URL do banco com credenciais mascaradas
 */
function getMaskedDatabaseUrl(): string {
  const url = process.env.DATABASE_URL || 'NOT_CONFIGURED';
  
  if (url === 'NOT_CONFIGURED') {
    return url;
  }
  
  try {
    // Regex para capturar e mascarar credenciais
    // Formato: protocol://username:password@host/database
    return url.replace(
      /(:\/\/)([^:]+):([^@]+)(@)/,
      '$1***:***$4'
    );
  } catch {
    // Se parsing falhar, retornar genérico
    return 'mongodb://***';
  }
}

// Executar verificação
checkDatabaseHealth();
