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

    /**
     * Mostra/Esconde a tela de Loading
     */
    GG.showLoading = (show, text = 'Processando...') => {
        const loadingEl = document.getElementById('loading');
        if (show) {
            loadingEl.querySelector('p').textContent = text;
            loadingEl.style.display = 'flex';
        } else {
            loadingEl.style.display = 'none';
        }
    };

    // --- 1. LÓGICA DO APP SHELL (UI) ---

    /**
     * Inicializa a UI do App Shell (sidebar, etc.)
     */
    function initAppShell() {
        const sidebar = document.querySelector('.sidebar');
        const sidebarToggle = document.getElementById('sidebarToggle');
        const sidebarOverlay = document.getElementById('sidebarOverlay');

        // ATUALIZADO: Lógica de Toggle (Mobile e Desktop)
        sidebarToggle.addEventListener('click', () => {
            const icon = sidebarToggle.querySelector('i');
            if (window.innerWidth <= 768) {
                // Lógica Mobile (Slide)
                document.body.classList.add('sidebar-open');
                icon.setAttribute('data-feather', 'x'); // Mudar para 'x'
            } else {
                // Lógica Desktop (Collapse)
                sidebar.classList.toggle('collapsed');
            }
            feather.replace(); // Atualiza o ícone
        });

        // ATUALIZADO: Fechar sidebar mobile ao clicar no overlay
        sidebarOverlay.addEventListener('click', () => {
            document.body.classList.remove('sidebar-open');
            sidebarToggle.querySelector('i').setAttribute('data-feather', 'menu'); // Mudar de volta
            feather.replace();
        });

        // Lógica de Navegação (clique nos links)
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                if (item.classList.contains('disabled')) {
                    e.preventDefault();
                    return;
                }
                // Fecha a sidebar no mobile ao clicar num item
                if (window.innerWidth <= 768) {
                    document.body.classList.remove('sidebar-open');
                    sidebarToggle.querySelector('i').setAttribute('data-feather', 'menu');
                    feather.replace();
                }
                // A troca de view é feita pelo atributo onclick no HTML
            });
        });

        // Habilita ícones do Feather (inicial)
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
        const viewToShow = document.getElementById(viewId);
        if (viewToShow) {
            viewToShow.classList.add('active');
        }

        // Atualiza o estado 'active' no menu
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
        });
        if (clickedItem) {
            clickedItem.classList.add('active');
        }

        // Reseta a view do IMOB se sair dela
        if (viewId !== 'imobView') {
            resetImobView();
        }
    };

    /**
     * Função de Logout
     */
    GG.logout = async () => {
        if (!supabase) return;
        GG.showLoading(true, 'Saindo...');
        await supabase.auth.signOut();
        window.location.href = 'login.html';
    };


    // --- 2. LÓGICA DE CONEXÃO E API (SUPABASE) ---

    /**
     * Busca as chaves da API do Vercel e inicializa o Supabase.
     */
    async function initSupabase() {
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
                console.log('Supabase client inicializado.');
                // Retorna a promessa da verificação de sessão
                return checkAuthSession(); 
            } else {
                throw new Error("Falha ao inicializar o cliente Supabase.");
            }

        } catch (error) {
            // Erro crítico (API Vercel fora do ar, etc.)
            // Não podemos checar auth, então redirecionamos para o login com erro
            console.error('Erro de conexão:', error);
            window.location.href = `login.html?error=${encodeURIComponent(error.message)}`;
        }
    }

    /**
     * Verifica se o usuário tem uma sessão ativa.
     */
    async function checkAuthSession() {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
            // Não há sessão, manda para o login
            window.location.href = 'login.html';
        } else {
            // Usuário está logado, pode carregar o app
            console.log('Sessão autenticada encontrada.', session.user.email);
            
            const statusEl = document.getElementById('textoStatus');
            const statusContainer = document.getElementById('statusConexao');
            statusEl.innerHTML = '<i data-feather="check-circle" class="h-4 w-4 mr-2"></i> Conectado ao B.I. com sucesso!';
            statusContainer.setAttribute('data-status', 'conectado');
            document.getElementById('processButton').disabled = false;

            // INICIALIZA O APP SHELL
            initAppShell();
            initImobUploader();
            GG.showView('homeView', document.querySelector('a[href="#home"]'));
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

        // Botões da tela de sucesso
        document.getElementById('imobSuccessHomeBtn').addEventListener('click', () => {
            GG.showView('homeView', document.querySelector('a[href="#home"]'));
            // resetImobView() é chamado pelo showView
        });

        document.getElementById('imobSuccessAgainBtn').addEventListener('click', () => {
            // Apenas reseta a view do IMOB
            resetImobView();
        });
    }

    /**
     * Reseta a view do uploader para o estado inicial.
     */
    function resetImobView() {
        document.getElementById('imobUploaderForm').style.display = 'block';
        document.getElementById('imobSuccessScreen').style.display = 'none';
        document.getElementById('dataInput').value = '';
        document.getElementById('previewSection').classList.add('hidden');
        document.getElementById('insertStatus').textContent = '';
        globalRowsToInsert = [];
    }

    /**
     * Pega os dados colados, processa, valida e prepara a prévia.
     */
    async function handleProcessData() {
        const previewSummary = document.getElementById('previewSummary');
        const rawData = document.getElementById('dataInput').value;
        const selectedEmpresa = document.getElementById('filterEmpresa').value;
        const selectedProduto = document.getElementById('filterProduto').value;

        if (!rawData) {
            previewSummary.textContent = 'Nenhum dado colado.';
            return;
        }
        if (!selectedEmpresa || !selectedProduto) {
            previewSummary.textContent = 'Preencha a Empresa e o Produto.';
            return;
        }

        GG.showLoading(true, 'Processando e validando...');
        previewSummary.textContent = 'Lendo dados e validando no banco...';
        document.getElementById('previewSection').classList.remove('hidden');
        document.getElementById('insertStatus').textContent = '';

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
            GG.showLoading(false);
            feather.replace();
        }
    }

    /**
     * Pega as linhas processadas e insere no Supabase.
     */
    async function handleInsertData() {
        const statusEl = document.getElementById('insertStatus');

        if (globalRowsToInsert.length === 0) {
            statusEl.textContent = 'Não há linhas novas para inserir.';
            return;
        }

        GG.showLoading(true, `Inserindo ${globalRowsToInsert.length} linhas...`);
        statusEl.textContent = `Enviando ${globalRowsToInsert.length} linhas para o Supabase...`;

        try {
            const { error } = await supabase.from('imob').insert(globalRowsToInsert);
            if (error) throw error;

            // ATUALIZADO: Mostrar tela de sucesso
            document.getElementById('imobUploaderForm').style.display = 'none';
            document.getElementById('imobSuccessScreen').style.display = 'flex';
            feather.replace(); // Para os ícones dos botões de sucesso

            // Limpa tudo (agora feito pelo resetImobView)
            globalRowsToInsert = [];
            document.getElementById('dataInput').value = '';
            document.getElementById('previewSection').classList.add('hidden');
            statusEl.textContent = '';


        } catch (error) {
            console.error('Erro na inserção:', error);
            statusEl.textContent = `Erro ao inserir: ${error.message}`;
        } finally {
            GG.showLoading(false);
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

        // Usa as colunas do primeiro objeto de dados, que inclui as colunas geradas
        const columns = Object.keys(rows[0]);
        columns.forEach(col => {
            header.innerHTML += `<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">${col}</th>`;
        });

        rows.forEach(row => {
            let rowHtml = '<tr>';
            columns.forEach(col => {
                // Colunas modificadas/adicionadas
                const isModified = (col === 'Emp' || col === 'Produto' || col === 'loja' || col === 'Segmento' || col === 'ano' || col === 'ID' || col === 'fornecedor');
                rowHtml += `<td class="px-4 py-3 whitespace-nowrap text-sm ${isModified ? 'bg-yellow-100 font-medium' : 'text-gray-700'}">${row[col] !== null ? row[col] : ''}</td>`;
            });
            rowHtml += '</tr>';
            body.innerHTML += rowHtml;
        });
    }


    // --- 5. INICIALIZAÇÃO DO APP ---
    document.addEventListener('DOMContentLoaded', () => {
        // Apenas inicia o processo de auth. O resto é chamado por checkAuthSession()
        // Oculta o app shell até o auth ser verificado
        document.getElementById('appShell').style.display = 'flex';
        initSupabase();
    });

})(window.GG);
