#!/bin/bash
set -e # Para o script se houver erro

echo "🚀 Iniciando processo de Reset da Main..."

# 1. Criar branch temporária e salvar o estado atual
echo "📦 Criando branch temporária 'temp-fix'..."
# Tenta criar a branch, se já existir, muda para ela
git checkout -b temp-fix 2>/dev/null || git checkout temp-fix
git add .
git commit -m "fix: backup current state before reset" --allow-empty
git push -u origin temp-fix

# 2. Alterar a branch default para temp-fix (para liberar a main)
echo "🔄 Alterando branch default para 'temp-fix'..."
gh repo edit --default-branch temp-fix

# 3. Remover regra de proteção da main (Se existir)
echo "🛡️ Removendo regras de proteção da 'main'..."
# O '|| true' garante que o script não pare se não houver regra para deletar
gh api -X DELETE repos/:owner/:repo/branches/main/protection || true

# 4. Deletar a main antiga (Remota e Local)
echo "🔥 Deletando a main antiga..."
git push origin --delete main || true
git branch -D main || true

# 5. Criar a nova main Limpa (Orphan)
echo "✨ Criando nova main limpa..."
git checkout --orphan main
git add .
git commit -m "Init: New clean main branch"
# 6. Enviar a nova main
echo "⬆️ Enviando nova main para o GitHub..."
git push -u origin main

# 7. Restaurar a main como default
echo "👑 Definindo 'main' como default novamente..."
gh repo edit --default-branch main

# 8. Limpeza Final
echo "🧹 Limpando branch temporária..."
git push origin --delete temp-fix
git branch -D temp-fix

echo "✅ Processo concluído! A main foi resetada com sucesso."
echo "⚠️ Lembrete: Vá nas configurações do GitHub e recrie as regras de proteção da main (Branch Protection Rules)."