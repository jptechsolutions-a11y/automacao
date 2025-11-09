/**
 * ARQUIVO: app.js
 * DESCRIÇÃO: Controla toda a lógica do "App Shell" de Atualização.
 * - Gerencia a troca de "views" (telas).
 * - Controla a UI (sidebar, etc.).
 * - Busca as chaves da API do Vercel.
 * - Contém a lógica específica do Uploader IMOB.
 */

// Cria o namespace global do App
window.GG = {};

(function(GG) {
    "use strict";

    // --- VARIÁVEIS GLOBAIS ---
    let supabase = null;
    let globalRowsToInsert = [];

    // --- MAPAS DE COLUNAS (Específico do IMOB) ---
    const COLUMN_MAP = [
        'SEQMOVIMENTAÇÃO', 'DATA', 'TIPO', 'DOC', 'QUANTIDADE', 'LOCAL', 'SALDO', 'OPERAÇÃO', 
        'ID - Fornecedor', 'data2', 'usuario'
    ];

    const COLUMN_TYPES = {
        'SEQMOVIMENTAÇÃO': 'bigint',
        'DOC': 'bigint',
        'QUANTIDADE': 'bigint',
        'SALDO': 'bigint',
        'ID': 'bigint',
        'Emp': 'bigint',
        'ano': 'bigint',
        'DATA': 'timestamp',
        'data2': 'timestamp'
    };


    // --- 1. LÓGICA DO APP SHELL (UI) ---

    /**
     * Inicializa a UI do App Shell (sidebar, etc.)
     */
    function initAppShell() {
        const sidebar = document.querySelector('.sidebar');
        const sidebarToggle = document.getElementById('sidebarToggle');
        const sidebarOverlay = document.getElementById('sidebarOverlay');

        // Lógica do Toggle da Sidebar
        sidebarToggle.addEventListener('click', () => {
            sidebar.classList.toggle('collapsed');
        });

        // Lógica de Navegação (clique nos links)
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                if (item.classList.contains('disabled')) {
                    e.preventDefault();
                    return;
                }
                // A troca de view é feita pelo atributo onclick no HTML
            });
        });

        // Habilita ícones do Feather
        feather.replace();
    }

    /**
     * Troca a view (tela) visível no app.
     * @param {string} viewId - O ID da view para mostrar (ex: 'homeView')
     * @param {HTMLElement} clickedItem - O item de menu que foi clicado
     */
    GG.showView = (viewId, clickedItem) => {
        // Esconde todas as views
        document.querySelectorAll('.view-content').forEach(view => {
            view.classList.remove('active');
        });
        // Mostra a view correta
        document.getElementById(viewId).classList.add('active');

        // Atualiza o estado 'active' no menu
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
        });
        if (clickedItem) {
            clickedItem.classList.add('active');
        }
    }


    // --- 2. LÓGICA DE CONEXÃO E API (SUPABASE) ---

    /**
     * Busca as chaves da API do Vercel e inicializa o Supabase.
     */
    async function initSupabase() {
        const statusEl = document.getElementById('textoStatus');
        const statusContainer = document.getElementById('statusConexao');

        try {
            // Chama a API que você criou no Vercel (api/config.js)
            const response = await fetch('/api/config');
            if (!response.ok) {
                throw new Error('Falha ao buscar config. Status: ' + response.status);
            }
            const keys = await response.json();

            if (!keys.SUPABASE_URL || !keys.SUPABASE_ANON_KEY) {
                throw new Error('Chaves do Supabase não encontradas na API.');
            }

            // Inicializa o cliente Supabase
            supabase = window.supabase.createClient(keys.SUPABASE_URL, keys.SUPABASE_ANON_KEY);
            
            if (supabase) {
                console.log('Supabase conectado com sucesso.');
                statusEl.innerHTML = '<i data-feather="check-circle" class="h-4 w-4 mr-2"></i> Conectado ao B.I. com sucesso!';
                statusContainer.setAttribute('data-status', 'conectado');
                // Habilita os botões que dependem da conexão
                document.getElementById('processButton').disabled = false;
            } else {
                throw new Error("Falha ao inicializar o cliente Supabase.");
            }

        } catch (error) {
            console.error('Erro de conexão:', error);
            statusEl.innerHTML = `<i data-feather="alert-triangle" class="h-4 w-4 mr-2"></i> Erro: ${error.message}`;
            statusContainer.setAttribute('data-status', 'erro');
        } finally {
            feather.replace(); // Re-renderiza ícones trocados
        }
    }


    // --- 3. LÓGICA DO UPLOADER IMOB (Refatorado) ---

    /**
     * Inicializa os event listeners para a view 'imobView'.
     */
    function initImobUploader() {
        const processButton = document.getElementById('processButton');
        const insertButton = document.getElementById('insertButton');

        processButton.addEventListener('click', handleProcessData);
        insertButton.addEventListener('click', handleInsertData);
    }

    /**
     * Pega os dados colados, processa, valida e prepara a prévia.
     */
    async function handleProcessData() {
        const previewSummary = document.getElementById('previewSummary');
        const rawData = document.getElementById('dataInput').value;
        const selectedEmpresa = document.getElementById('filterEmpresa').value;
        const selectedProduto = document.getElementById('filterProduto').value;
        const processButton = document.getElementById('processButton');

        if (!rawData) {
            previewSummary.textContent = 'Nenhum dado colado.';
            return;
        }
        if (!selectedEmpresa || !selectedProduto) {
            previewSummary.textContent = 'Preencha a Empresa e o Produto.';
            return;
        }

        processButton.disabled = true;
        processButton.innerHTML = '<i data-feather="refresh-cw" class="animate-spin h-4 w-4 mr-2"></i> Processando...';
        feather.replace(); // Atualiza o ícone de spin

        previewSummary.textContent = 'Lendo dados e validando no banco...';
        document.getElementById('previewSection').classList.remove('hidden');

        try {
            // 1. Parsear
            const allParsedRows = parsePastedData(rawData);
            const seqList = allParsedRows.map(row => row['SEQMOVIMENTAÇÃO']).filter(seq => seq);

            if (seqList.length === 0) {
                throw new Error("Nenhum 'SEQMOVIMENTAÇÃO' válido encontrado.");
            }

            // 2. Validar Duplicados
            const { data: existingRows, error } = await supabase
                .from('imob')
                .select('SEQMOVIMENTAÇÃO')
                .in('SEQMOVIMENTAÇÃO', seqList);
            if (error) throw error;
            const existingSeqSet = new Set(existingRows.map(row => String(row['SEQMOVIMENTAÇÃO'])));
            
            // 3. Filtrar novos
            const newRows = allParsedRows.filter(row => {
                const seq = String(row['SEQMOVIMENTAÇÃO']);
                return seq && !existingSeqSet.has(seq);
            });

            // 4. Lógica de PROCV (Tabela Lojas)
            const idFornecedorSet = new Set();
            newRows.forEach(row => {
                const rawFornecedor = row['ID - Fornecedor'];
                if (rawFornecedor && rawFornecedor.includes(' - ')) {
                    const id = rawFornecedor.split(' - ')[0].trim();
                    if (id) idFornecedorSet.add(id);
                }
            });
            
            const uniqueIds = Array.from(idFornecedorSet).map(idStr => parseInt(idStr, 10)).filter(id => !isNaN(id));
            let lojaLookup = new Map();

            if (uniqueIds.length > 0) {
                previewSummary.textContent = 'Validando IDs... buscando lojas e segmentos...';
                const { data: lojasData, error: lojasError } = await supabase
                    .from('lojas')
                    .select('id, nome_loja, segmento')
                    .in('id', uniqueIds);
                if (lojasError) throw new Error(`Erro ao buscar 'lojas': ${lojasError.message}`);
                
                lojasData.forEach(item => {
                    lojaLookup.set(String(item.id), { loja: item.nome_loja, segmento: item.segmento });
                });
            }

            // 5. Aplicar Fórmulas e Tipos
            globalRowsToInsert = newRows.map(row => {
                // Filtros
                row['Emp'] = selectedEmpresa;
                row['Produto'] = selectedProduto;

                // --- Fórmulas de Tratamento ---
                let idFornecedor = null;
                const rawFornecedor = row['ID - Fornecedor'];
                if (rawFornecedor && rawFornecedor.includes(' - ')) {
                    const parts = rawFornecedor.split(' - ');
                    idFornecedor = parts[0].trim();
                    row['ID'] = idFornecedor;
                    row['fornecedor'] = parts.slice(1).join(' - ').trim();
                } else {
                    row['ID'] = null;
                    row['fornecedor'] = rawFornecedor;
                }

                const dataCompleta = row['DATA'];
                if (dataCompleta && dataCompleta.includes('/')) {
                    row['ano'] = dataCompleta.split('/')[2];
                } else {
                    row['ano'] = new Date().getFullYear().toString();
                }
                
                row['Coluna1'] = null;
                row['Coluna2'] = null;

                // PROCV
                if (idFornecedor && lojaLookup.has(idFornecedor)) {
                    const lookupData = lojaLookup.get(idFornecedor);
                    row['loja'] = lookupData.loja;
                    row['Segmento'] = lookupData.segmento;
                } else {
                    row['loja'] = row['fornecedor']; // Lógica "SEERRO"
                    row['Segmento'] = null;
                }
                // --- Fim Fórmulas ---

                // Converter Tipos
                for (const key in row) {
                    const type = COLUMN_TYPES[key];
                    if (type === 'bigint') {
                        row[key] = row[key] ? parseInt(row[key], 10) : null;
                        if (isNaN(row[key])) row[key] = null;
                    } else if (type === 'timestamp') {
                        row[key] = formatBRLDateToISO(row[key]) || null;
                    }
                }
                return row;
            });

            // 6. Renderizar Prévia
            renderPreview(globalRowsToInsert, allParsedRows.length);
            document.getElementById('insertButton').disabled = globalRowsToInsert.length === 0;

        } catch (error) {
            console.error('Erro no processamento:', error);
            previewSummary.textContent = `Erro: ${error.message}`;
        } finally {
            processButton.disabled = false;
            processButton.innerHTML = '<i data-feather="refresh-cw" class="h-4 w-4 mr-2"></i> Processar e Validar Dados';
            feather.replace();
        }
    }

    /**
     * Pega as linhas processadas e insere no Supabase.
     */
    async function handleInsertData() {
        const insertButton = document.getElementById('insertButton');
        const statusEl = document.getElementById('insertStatus');

        if (globalRowsToInsert.length === 0) {
            statusEl.textContent = 'Não há linhas novas para inserir.';
            return;
        }

        insertButton.disabled = true;
        insertButton.innerHTML = '<i data-feather="refresh-cw" class="animate-spin h-4 w-4 mr-2"></i> Inserindo...';
        feather.replace();
        statusEl.textContent = `Enviando ${globalRowsToInsert.length} linhas para o Supabase...`;

        try {
            const { error } = await supabase.from('imob').insert(globalRowsToInsert);
            if (error) throw error;

            statusEl.textContent = `${globalRowsToInsert.length} linhas inseridas com sucesso!`;
            // Limpa tudo
            globalRowsToInsert = [];
            document.getElementById('dataInput').value = '';
            document.getElementById('previewSection').classList.add('hidden');

        } catch (error) {
            console.error('Erro na inserção:', error);
            statusEl.textContent = `Erro ao inserir: ${error.message}`;
        } finally {
            insertButton.disabled = false;
            insertButton.innerHTML = '<i data-feather="database" class="h-4 w-4 mr-2"></i> Confirmar e Inserir Linhas no Banco';
            feather.replace();
        }
    }

    // --- 4. FUNÇÕES UTILITÁRIAS (IMOB) ---

    function parsePastedData(text) {
        const rows = text.trim().split('\n');
        return rows.map(row => {
            const values = row.split('\t'); // Separador TAB
            let obj = {};
            COLUMN_MAP.forEach((colName, index) => {
                const value = values[index];
                obj[colName] = (value === "null" || value === undefined) ? null : value;
            });
            return obj;
        });
    }

    function formatBRLDateToISO(dateString) {
        if (!dateString) return null;
        const parts = dateString.match(/(\d{2})\/(\d{2})\/(\d{4})(?:[ T](\d{2}):(\d{2}):(\d{2}))?/);
        if (!parts) return null; // Formato não reconhecido

        const [_, day, month, year, hour = '00', minute = '00', second = '00'] = parts;
        const isoDate = `${year}-${month}-${day}T${hour}:${minute}:${second}`;
        
        if (isNaN(new Date(isoDate).getTime())) return null; // Data inválida
        
        return isoDate;
    }

    function renderPreview(rows, totalParsed) {
        const header = document.getElementById('previewHeader');
        const body = document.getElementById('previewBody');
        const summary = document.getElementById('previewSummary');
        
        header.innerHTML = '';
        body.innerHTML = '';

        const duplicateCount = totalParsed - rows.length;
        summary.textContent = `Encontradas ${totalParsed} linhas. ${duplicateCount} já existem no banco. ${rows.length} linhas novas prontas para inserir.`;

        if (rows.length === 0) {
            body.innerHTML = '<tr><td colspan="100%" class="p-4 text-center text-gray-500">Nenhuma linha nova para inserir.</td></tr>';
            return;
        }

        const columns = Object.keys(rows[0]);
        columns.forEach(col => {
            header.innerHTML += `<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">${col}</th>`;
        });

        rows.forEach(row => {
            let rowHtml = '<tr>';
            columns.forEach(col => {
                const isModified = (col === 'Emp' || col === 'Produto' || col === 'loja' || col === 'Segmento');
                rowHtml += `<td class="px-4 py-3 whitespace-nowrap text-sm ${isModified ? 'bg-yellow-100 font-medium' : 'text-gray-700'}">${row[col] !== null ? row[col] : ''}</td>`;
            });
            rowHtml += '</tr>';
            body.innerHTML += rowHtml;
        });
    }


    // --- 5. INICIALIZAÇÃO DO APP ---
    document.addEventListener('DOMContentLoaded', () => {
        initAppShell();
        initSupabase(); // Conecta ao Supabase ao carregar
        initImobUploader(); // Prepara os botões do uploader
        
        // Define a view inicial
        GG.showView('homeView', document.querySelector('a[href="#home"]'));
    });

})(window.GG);
