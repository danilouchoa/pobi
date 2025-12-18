#!/usr/bin/env tsx

/**
 * MIGRATION SCRIPT: Atualiza valores antigos de BillingRolloverPolicy
 * 
 * CONTEXTO:
 * O enum BillingRolloverPolicy foi simplificado de:
 * - NEXT_BUSINESS_DAY → NEXT
 * - PREVIOUS_BUSINESS_DAY → PREVIOUS
 * 
 * Este script atualiza todas as origens existentes no banco de dados
 * que ainda possuem os valores antigos.
 * 
 * SEGURANÇA:
 * - Apenas leitura e atualização, sem deletar dados
 * - Relata todas as mudanças antes de executar
 * - Modo dry-run disponível
 * 
 * EXECUÇÃO:
 * ```bash
 * # Dry run (apenas mostra o que seria alterado)
 * npm run migrate:billing-enum -- --dry-run
 * 
 * # Execução real
 * npm run migrate:billing-enum
 * 
 * # Via Docker
 * docker exec finance_backend npm run migrate:billing-enum
 * ```
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface LegacyOrigin {
  id: string;
  name: string;
  billingRolloverPolicy: any; // Pode conter valores antigos como string
}

/**
 * Mapeia valores antigos do enum para os novos valores.
 * 
 * @param oldValue - Valor antigo armazenado no banco
 * @returns Novo valor válido do enum ou null
 */
function migrateEnumValue(oldValue: any): 'NEXT' | 'PREVIOUS' | null {
  if (!oldValue) return null;
  
  const valueStr = String(oldValue).toUpperCase();
  
  // Mapeamento de valores antigos → novos
  const migrations: Record<string, 'NEXT' | 'PREVIOUS'> = {
    'NEXT_BUSINESS_DAY': 'NEXT',
    'PREVIOUS_BUSINESS_DAY': 'PREVIOUS',
    'NEXT': 'NEXT', // Já está correto
    'PREVIOUS': 'PREVIOUS', // Já está correto
  };
  
  return migrations[valueStr] || null;
}

/**
 * Executa a migração de dados.
 * 
 * @param dryRun - Se true, apenas mostra o que seria alterado sem salvar
 */
async function migrate(dryRun = false) {
  console.log('🔄 Iniciando migração de BillingRolloverPolicy...\n');
  
  if (dryRun) {
    console.log('⚠️  MODO DRY-RUN: Nenhuma alteração será salva\n');
  }
  
  try {
    // 1. Buscar todas as origens (MongoDB permite queries diretas sem validação de enum)
    const origins = await prisma.$runCommandRaw({
      find: 'Origin',
      filter: {}
    }) as any;
    
    if (!origins.cursor || !origins.cursor.firstBatch) {
      console.log('✅ Nenhuma origem encontrada no banco de dados.');
      return;
    }
    
    const allOrigins: LegacyOrigin[] = origins.cursor.firstBatch;
    
    console.log(`📋 Total de origens encontradas: ${allOrigins.length}\n`);
    
    // 2. Identificar origens que precisam ser migradas
    const toMigrate = allOrigins.filter(origin => {
      if (!origin.billingRolloverPolicy) return false;
      
      const value = String(origin.billingRolloverPolicy).toUpperCase();
      return value === 'NEXT_BUSINESS_DAY' || value === 'PREVIOUS_BUSINESS_DAY';
    });
    
    if (toMigrate.length === 0) {
      console.log('✅ Nenhuma origem precisa ser migrada. Todos os valores já estão atualizados!\n');
      return;
    }
    
    console.log(`🔧 Origens a migrar: ${toMigrate.length}\n`);
    console.log('Mudanças planejadas:');
    console.log('─'.repeat(80));
    
    // 3. Mostrar mudanças planejadas
    for (const origin of toMigrate) {
      const oldValue = origin.billingRolloverPolicy;
      const newValue = migrateEnumValue(oldValue);
      
      console.log(`📌 ${origin.name} (ID: ${origin.id})`);
      console.log(`   Anterior: ${oldValue}`);
      console.log(`   Novo:     ${newValue}`);
      console.log('');
    }
    
    console.log('─'.repeat(80));
    console.log('');
    
    if (dryRun) {
      console.log('⚠️  Dry-run concluído. Execute sem --dry-run para aplicar as mudanças.');
      return;
    }
    
    // 4. Confirmar execução
    console.log('⚠️  Iniciando atualização em 3 segundos...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // 5. Executar migrações
    let successCount = 0;
    let errorCount = 0;
    
    for (const origin of toMigrate) {
      const newValue = migrateEnumValue(origin.billingRolloverPolicy);
      
      if (!newValue) {
        console.error(`❌ Valor inválido para migração: ${origin.billingRolloverPolicy}`);
        errorCount++;
        continue;
      }
      
      try {
        // Atualizar usando updateRaw para evitar validação do enum pelo Prisma
        // Usar updateMany com filtro por name (mais confiável que _id)
        await prisma.$runCommandRaw({
          update: 'Origin',
          updates: [
            {
              q: { name: origin.name },
              u: { $set: { billingRolloverPolicy: newValue } },
              multi: false
            }
          ]
        });
        
        console.log(`✅ ${origin.name}: ${origin.billingRolloverPolicy} → ${newValue}`);
        successCount++;
      } catch (error) {
        console.error(`❌ Erro ao atualizar ${origin.name}:`, error);
        errorCount++;
      }
    }
    
    console.log('');
    console.log('─'.repeat(80));
    console.log('📊 Resultado da Migração:');
    console.log(`   ✅ Sucesso: ${successCount}`);
    console.log(`   ❌ Erros:   ${errorCount}`);
    console.log(`   📋 Total:   ${toMigrate.length}`);
    console.log('─'.repeat(80));
    
    if (successCount > 0) {
      console.log('');
      console.log('🎉 Migração concluída com sucesso!');
      console.log('');
      console.log('⚠️  PRÓXIMO PASSO: Reinicie o backend para aplicar as mudanças:');
      console.log('   docker compose restart backend worker bulk-worker');
    }
    
  } catch (error) {
    console.error('❌ Erro fatal durante a migração:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Parsing de argumentos da linha de comando
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run') || args.includes('-d');

// Executar migração
migrate(dryRun).catch(error => {
  console.error('💥 Migração falhou:', error);
  process.exit(1);
});
