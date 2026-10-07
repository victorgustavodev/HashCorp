/**
 * ==============================================================================
 * PROJETO ACADÊMICO: GERENCIAMENTO DINÂMICO DE SEGREDOS COM HASHICORP VAULT
 * Especialidade: Segurança da Informação & Arquitetura Cloud
 * ==============================================================================
 *
 * [ANTI-PADRÃO: HARDCODING DE CREDENCIAIS]
 * ------------------------------------------------------------------------------
 * Exemplo do que NUNCA fazer em ambientes profissionais (CWE-798 / OWASP A07):
 *
 *   const DATABASE_PASS = "SuperSecretPassword123!"; // ❌ VAZAMENTO NO GIT!
 *   const API_KEY       = "prod_live_sk_9876543210";  // ❌ IMPOSSÍVEL ROTACIONAR SEM NOVO DEPLOY!
 *
 * Riscos do Hardcoding:
 * 1. Exposição em repositórios de código-fonte (Git history, vazamentos públicos).
 * 2. Ciclo de vida estático: trocar uma senha requer recompile/redeploy da aplicação.
 * 3. Ausência de auditoria: impossível rastrear quem leu ou utilizou a credencial.
 * 4. Violação de compliance (LGPD, PCI-DSS, SOC2, ISO 27001).
 *
 * [PADRÃO SEGURO: DESACOPLAMENTO E INJEÇÃO DINÂMICA VIA VAULT]
 * ------------------------------------------------------------------------------
 * A aplicação não possui credenciais persistidas no código nem em arquivos .env
 * commitados. Em vez disso, consulta um cofre seguro (HashiCorp Vault) autenticando-se
 * via token ou identidade de máquina (AppRole, IAM, Kubernetes ServiceAccount) e
 * carrega os segredos apenas em memória de execução (RAM) sob demanda.
 * ==============================================================================
 */

const axios = require('axios');

// ==============================================================================
// CONFIGURAÇÕES DE AMBIENTE
// ==============================================================================
// Em produção, VAULT_ADDR e VAULT_TOKEN seriam injetados pela plataforma (ex: Vault Agent, K8s)
const VAULT_ADDR = process.env.VAULT_ADDR || 'http://localhost:8200';
const VAULT_TOKEN = process.env.VAULT_TOKEN || 'my-root-token';
const SECRET_PATH = process.env.VAULT_SECRET_PATH || 'secret/data/app/config';

/**
 * Função utilitária para mascarar strings sensíveis em logs/apresentações.
 * Em produção, segredos NUNCA devem ser impressos em logs de console!
 *
 * @param {string} value - Valor do segredo a ser mascarado
 * @returns {string} Valor mascarado para exibição didática
 */
function maskSecret(value) {
  if (!value || typeof value !== 'string') return '[N/A]';
  if (value.length <= 4) return '****';
  return `${value.slice(0, 2)}****${value.slice(-2)}`;
}

/**
 * Realiza a busca assíncrona de segredos na API REST do HashiCorp Vault.
 * Motor: Key-Value v2 (KV Version 2).
 *
 * @param {string} vaultUrl - URL base do Vault (ex: http://localhost:8200)
 * @param {string} token - Token de autenticação do Vault
 * @param {string} path - Caminho relativo do segredo (ex: secret/data/app/config)
 * @returns {Promise<Object>} Retorna o payload contendo os segredos e metadados
 */
async function fetchSecretsFromVault(vaultUrl, token, path) {
  const targetUrl = `${vaultUrl}/v1/${path}`;

  console.log('\n=============================================================');
  console.log('🔒 INICIANDO COMUNICAÇÃO SEGURA COM O HASHICORP VAULT');
  console.log('=============================================================');
  console.log(`📡 Endpoint API: ${targetUrl}`);
  console.log(`🔑 Cabeçalho Auth: X-Vault-Token = ${maskSecret(token)}`);

  const response = await axios.get(targetUrl, {
    headers: {
      'X-Vault-Token': token,
      'Accept': 'application/json'
    },
    timeout: 5000 // Timeout de 5s para evitar bloqueio indefinido
  });

  return response.data;
}

/**
 * Simula a inicialização de serviços corporativos utilizando as credenciais
 * recuperadas dinamicamente e mantidas estritamente em memória volátil.
 *
 * @param {Object} secrets - Objeto com os segredos carregados do Vault
 */
function initializeServices(secrets) {
  console.log('\n=============================================================');
  console.log('🚀 INICIALIZANDO SERVIÇOS EM TEMPO DE EXECUÇÃO (IN-MEMORY)');
  console.log('=============================================================');

  const { DATABASE_PASS, API_KEY } = secrets;

  // 1. Simulação: Conexão com Banco de Dados
  if (DATABASE_PASS) {
    console.log('🐘 [DB Connection]: Conectando ao PostgreSQL corporativo...');
    console.log(`   -> Usuário: db_app_user`);
    console.log(`   -> Senha obtida em memória: ${maskSecret(DATABASE_PASS)} (Comprimento: ${DATABASE_PASS.length} chars)`);
    console.log('   ✅ Conexão estabelecida com sucesso usando credencial do Vault!');
  } else {
    console.warn('   ⚠️ Aviso: DATABASE_PASS não foi encontrada no cofre.');
  }

  // 2. Simulação: Integração com Gateway de Pagamentos externo
  if (API_KEY) {
    console.log('\n💳 [Payment Gateway]: Inicializando cliente da API de Pagamentos...');
    console.log(`   -> Chave de API obtida: ${maskSecret(API_KEY)}`);
    console.log('   ✅ Cliente de pagamentos pronto para processar transações!');
  } else {
    console.warn('   ⚠️ Aviso: API_KEY não foi encontrada no cofre.');
  }

  console.log('\n🎉 SUCESSO: A aplicação está operando sem NENHUM segredo hardcoded!');
  console.log('=============================================================\n');
}

/**
 * Fluxo principal de execução da aplicação com tratamento detalhado de erros.
 */
async function main() {
  try {
    const vaultResponse = await fetchSecretsFromVault(VAULT_ADDR, VAULT_TOKEN, SECRET_PATH);

    // O motor KV v2 do Vault retorna os dados em: response.data.data
    const secretData = vaultResponse?.data?.data;
    const metadata = vaultResponse?.data?.metadata;

    if (!secretData) {
      throw new Error('Formato inesperado na resposta do Vault. Objeto de dados vazio.');
    }

    console.log('\n✅ Segredos recuperados com sucesso do Vault!');
    if (metadata) {
      console.log(`ℹ️  Versão do segredo: v${metadata.version}`);
      console.log(`ℹ️  Criado em: ${metadata.created_time}`);
    }

    // Inicializa a aplicação injetando os dados na memória
    initializeServices(secretData);

  } catch (error) {
    console.error('\n❌ ERRO NA OBTENÇÃO DE SEGREDOS DO VAULT:');

    if (error.code === 'ECONNREFUSED') {
      console.error('👉 O servidor do Vault parece estar desligado ou inacessível.');
      console.error(`   Certifique-se de que o container Docker está rodando na porta 8200.`);
      console.error(`   Comando: docker ps | grep vault`);
    } else if (error.response) {
      const status = error.response.status;
      const errors = error.response.data?.errors || [];

      if (status === 403) {
        console.error('👉 Erro 403 (Forbidden): O token fornecido (X-Vault-Token) é inválido ou expirou.');
      } else if (status === 404) {
        console.error(`👉 Erro 404 (Not Found): O caminho "${SECRET_PATH}" não existe no Vault.`);
        console.error('   Verifique se o motor KV foi habilitado e se o segredo foi inserido.');
      } else {
        console.error(`👉 Erro HTTP ${status}:`, errors.join(', ') || error.response.statusText);
      }
    } else {
      console.error(`👉 Detalhes do erro: ${error.message}`);
    }

    console.log('\n[ABORTANDO] A aplicação não pode subir sem suas credenciais seguras.\n');
    process.exit(1);
  }
}

// Execução da aplicação
main();
