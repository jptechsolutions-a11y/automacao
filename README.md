# automacao
Painel de Atualização de B.I.

Este projeto é um painel de automação (App Shell) criado para centralizar e simplificar a atualização de bases de dados de Business Intelligence (B.I.).

Ele é projetado para ser hospedado na Vercel, consumindo uma API serverless para segurança, e se conecta a um backend Supabase (PostgreSQL) para armazenamento e consulta dos dados.

Funcionalidades Principais

Arquitetura "App Shell": Uma única página (SPA) que carrega diferentes "views" (telas) de forma dinâmica.

Tela Home: Um seletor de painéis para escolher qual módulo de atualização utilizar.

Módulo de Upload IMOB:

Permite colar dados (separados por TAB) diretamente de um sistema interno.

Validação de Duplicados: Verifica a coluna SEQMOVIMENTAÇÃO no Supabase antes de inserir, garantindo que apenas linhas novas sejam adicionadas.

Fórmulas de Tratamento (PROCV):

Separa a coluna ID - Fornecedor em duas novas colunas: ID e fornecedor.

Extrai o ano da coluna DATA.

Faz um "PROCV" (VLOOKUP) automático na tabela lojas (do Supabase) para preencher as colunas loja e Segmento com base no ID do fornecedor.

Implementa a lógica "SEERRO" (IFERROR), onde, se o ID não for encontrado na tabela lojas, ele usa o fornecedor como valor para a loja.

API Segura (Vercel): As chaves do Supabase não ficam expostas no frontend. O app.js busca as chaves de um endpoint /api/config que as lê das variáveis de ambiente da Vercel.

Arquitetura do Projeto

Frontend: index.html (o "casco"), style.css (identidade visual) e app.js (controlador principal com toda a lógica de UI e processamento).

Backend (API): api/config.js (Um endpoint Serverless da Vercel para fornecer as chaves do Supabase com segurança).

Banco de Dados: Supabase (PostgreSQL).

Estrutura de Arquivos

/
├── index.html       (O frontend principal, "App Shell")
├── style.css        (Folha de estilos da aplicação)
├── app.js           (Lógica do frontend, troca de views, processamento IMOB)
├── api/
│   └── config.js    (Endpoint da API Vercel para chaves)
└── README.md        (Este arquivo)


Configuração e Deploy (Do Zero)

Para rodar este projeto, você precisará de uma conta no Supabase e uma conta na Vercel.

1. Configuração do Supabase

Crie o Projeto: Crie um novo projeto no seu painel do Supabase.

Crie as Tabelas: Vá até o SQL Editor no seu projeto.

Tabela imob: Cole e execute o CREATE TABLE da sua tabela imob (certifique-se de que SEQMOVIMENTAÇÃO é UNIQUE).

Tabela lojas: Cole e execute o script create_lojas.sql (que já preparamos) para criar a tabela lojas e suas políticas de RLS.

Popule lojas: Adicione os dados de "DE-PARA" (ID, nome_loja, segmento) na sua tabela lojas.

Guarde as Chaves: Vá para Project Settings > API. Guarde a URL do projeto e a anon public key.

2. Configuração do Vercel

Faça o Fork/Upload: Coloque este projeto em um repositório GitHub/GitLab ou faça o upload manual para a Vercel.

Crie o Projeto: Importe o repositório na Vercel.

Configure as Variáveis de Ambiente: No painel do seu projeto na Vercel, vá para Settings -> Environment Variables.

Adicione as seguintes variáveis (elas são essenciais para o api/config.js funcionar):

SUPABASE_URL: Cole a URL do seu projeto Supabase.

SUPABASE_ANON_KEY: Cole a chave anon public do seu projeto Supabase.

Deploy: Faça o deploy (ou redeploy, se já o fez).

A Vercel irá "buildar" o projeto e o endpoint api/config.js passará a funcionar, alimentando o app.js com as chaves necessárias.

Como Usar a Ferramenta

Acesse a URL principal do seu deploy na Vercel.

A tela Home será exibida. O status da conexão deve mudar para "Conectado ao B.I. com sucesso!".

Clique no card "Upload Painel IMOB".

Você será levado à tela do uploader (imobView).

Passo 1: Preencha os campos "Empresa (Filial)" e "Produto" (ex: 999, PALLET).

Passo 2: Copie os dados do seu sistema (sem cabeçalho, separados por TAB) e cole na área "Colar Dados do Sistema".

Passo 3: Clique em "Processar e Validar Dados".

O sistema irá:

Validar duplicados (SEQMOVIMENTAÇÃO).

Buscar o "DE-PARA" na tabela lojas.

Aplicar todas as fórmulas.

Mostrar um resumo (Ex: "Encontradas 50 linhas. 10 já existem... 40 linhas novas...")

Mostrar a tabela de Prévia com as colunas geradas (loja, Segmento, ano, etc.) destacadas em amarelo.

Passo 4: Se a prévia estiver correta, clique em "Confirmar e Inserir Linhas no Banco".
