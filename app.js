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

    // ======================================================
    // <<< ATUALIZAÇÃO: Bloco de Configuração Removido >>>
    // ======================================================
    // O objeto LOOKER_PANELS foi removido.
    // Vamos usar uma variável global para carregar do banco.
    let globalPanelConfig = new Map();
    // ======================================================
    // <<< FIM DA ATUALIZAÇÃO >>>
    // ======================================================


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

        // ======================================================
        // <<< ATUALIZAÇÃO: Lógica das Sub-Abas IMOB >>>
        // ======================================================
        const imobSubTab_Update = document.getElementById('imobSubTab_Update');
        const imobSubTab_Panel = document.getElementById('imobSubTab_Panel');
        const imobSubPanel_Update = document.getElementById('imobSubPanel_Update');
        const imobSubPanel_Panel = document.getElementById('imobSubPanel_Panel');

        if (imobSubTab_Update) {
            imobSubTab_Update.addEventListener('click', () => {
                imobSubTab_Update.classList.add('active');
                imobSubTab_Panel.classList.remove('active');
                imobSubPanel_Update.classList.add('active');
                imobSubPanel_Panel.classList.remove('active');
            });
        }
        
        if (imobSubTab_Panel) {
            imobSubTab_Panel.addEventListener('click', () => {
                imobSubTab_Panel.classList.add('active');
                imobSubTab_Update.classList.remove('active');
                imobSubPanel_Panel.classList.add('active');
                imobSubPanel_Update.classList.remove('active');
                
                // Carrega o painel ao clicar
                loadImobPanelIntoIframe(); 
            });
        }
        // ======================================================
        // <<< FIM DA ATUALIZAÇÃO >>>
        // ======================================================
    }

    /**
     * Troca a view (tela) visível no app.
     * @param {string} viewId - O ID da view para mostrar (ex: 'homeView')
     * @param {HTMLElement} clickedItem - O item de menu que foi clicado
     * @param {string} panelKey - A chave do painel (ex: 'imob', 'vendas')
     */
    GG.showView = (viewId, clickedItem, panelKey = null) => {
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

        // ======================================================
        // <<< INÍCIO DA ATUALIZAÇÃO: Lógica para carregar Iframe >>>
        // ======================================================
        // Lógica específica para carregar o painel do Looker correto
        if (viewId === 'lookerView') {
            const iframe = document.getElementById('lookerIframe');
            const title = document.getElementById('lookerTitle');
            
            // <<< ATUALIZAÇÃO: Lendo do globalPanelConfig (Map) >>>
            if (panelKey && globalPanelConfig.has(panelKey) && iframe && title) {
                const panelData = globalPanelConfig.get(panelKey);
                title.textContent = panelData.displayName; // Atualiza o título da página
                
                // Só carrega se for diferente, para não recarregar à toa
                if (iframe.src !== panelData.embedUrl) {
                    GG.showLoading(true, 'Carregando painel...');
                    iframe.src = panelData.embedUrl;
                    
                    // Esconde o loading depois de um tempo
                    setTimeout(() => GG.showLoading(false), 2000); 
                }
            } else if (iframe && title) {
                // Se não encontrar a chave (ex: link quebrado)
                title.textContent = "Erro: Painel não encontrado ou não configurado";
                iframe.src = "";
            }
        }
        // ======================================================
        // <<< FIM DA ATUALIZAÇÃO >>>
        // ======================================================

        // ======================================================
        // <<< INÍCIO DA ATUALIZAÇÃO: Popular tela de Configurações >>>
        // ======================================================
        if (viewId === 'settingsView') {
            // Popula os campos de input com os valores atuais do Map
            const imobInput = document.getElementById('settingLinkImob');
            const vendasInput = document.getElementById('settingLinkVendas');

            if (imobInput && globalPanelConfig.has('imob')) {
                imobInput.value = globalPanelConfig.get('imob').embedUrl || '';
            }
            if (vendasInput && globalPanelConfig.has('vendas')) {
                vendasInput.value = globalPanelConfig.get('vendas').embedUrl || '';
            }
        }
        // ======================================================
        // <<< FIM DA ATUALIZAÇÃO >>>
        // ======================================================
        
        // ======================================================
        // <<< ATUALIZAÇÃO: Resetar Sub-Abas ao mostrar imobView >>>
        // ======================================================
        if (viewId === 'imobView') {
            // Garante que a aba "Atualizar" seja a padrão
            const updateTab = document.getElementById('imobSubTab_Update');
            if (updateTab) {
                updateTab.click();
            }
        }
        // ======================================================
        // <<< FIM DA ATUALIZAÇÃO >>>
        // ======================================================

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

        // Limpa o iframe principal do lookerView
        const iframe = document.getElementById('lookerIframe');
        if (iframe) {
            iframe.src = ""; // Limpa o iframe
        }
        // ======================================================
        // <<< ATUALIZAÇÃO: Limpar iframe do IMOB no logout >>>
        // ======================================================
        const imobIframe = document.getElementById('imobLookerIframe');
        if (imobIframe) {
            imobIframe.src = "";
        }
        // ======================================================
        // <<< FIM DA ATUALIZAÇÃO >>>
        // ======================================================

        await supabase.auth.signOut();
        window.location.href = 'index.html'; // Corrigido de login.html para index.html (onde está o login)
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
            window.location.href = `index.html?error=${encodeURIComponent(error.message)}`; // Corrigido de login.html
        }
    }

    /**
     * Verifica se o usuário tem uma sessão ativa.
     */
    async function checkAuthSession() {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
            // Não há sessão, manda para o login
            window.location.href = 'index.html'; // Corrigido de login.html
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
            
            // <<< ADICIONADO: Popula os dropdowns de filtro >>>
            populateDropdowns(); 

            // ======================================================
            // <<< INÍCIO DA ATUALIZAÇÃO: Carregar configs e iniciar settings >>>
            // ======================================================
            initSettingsPage(); // Prepara os botões da página de config
            await loadGlobalConfig(); // Carrega os links do Supabase
            // ======================================================
            // <<< FIM DA ATUALIZAÇÃO >>>
            // ======================================================
            
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

        if(processButton) processButton.addEventListener('click', handleProcessData);
        if(insertButton) insertButton.addEventListener('click', handleInsertData);

        // Botões da tela de sucesso
        const successHomeBtn = document.getElementById('imobSuccessHomeBtn');
        const successAgainBtn = document.getElementById('imobSuccessAgainBtn');

        if(successHomeBtn) successHomeBtn.addEventListener('click', () => {
            GG.showView('homeView', document.querySelector('a[href="#home"]'));
            // resetImobView() é chamado pelo showView
        });

        if(successAgainBtn) successAgainBtn.addEventListener('click', () => {
            // Apenas reseta a view do IMOB
            resetImobView();
        });

        // ======================================================
        // <<< INÍCIO DA ADIÇÃO: LÓGICA DAS ABAS E UPLOAD >>>
        // ======================================================
        const pasteTab = document.getElementById('imobPasteTab');
        const uploadTab = document.getElementById('imobUploadTab');
        const pastePanel = document.getElementById('pastePanel');
        const uploadPanel = document.getElementById('uploadPanel');
        const fileInput = document.getElementById('imobFileInput');
        const fileStatus = document.getElementById('fileStatus');
        const dataInput = document.getElementById('dataInput');

        // Controla a troca de abas
        if(pasteTab) pasteTab.addEventListener('click', () => {
            pasteTab.classList.add('active');
            uploadTab.classList.remove('active');
            pastePanel.style.display = 'block';
            uploadPanel.style.display = 'none';
        });

        if(uploadTab) uploadTab.addEventListener('click', () => {
            uploadTab.classList.add('active');
            pasteTab.classList.remove('active');
            uploadPanel.style.display = 'block';
            pastePanel.style.display = 'none';
        });

        // Controla a leitura do arquivo
        if(fileInput) fileInput.addEventListener('change', (event) => {
            const file = event.target.files[0];
            if (!file) {
                fileStatus.textContent = 'Nenhum arquivo selecionado.';
                return;
            }

            GG.showLoading(true, 'Lendo arquivo...');
            fileStatus.textContent = `Lendo arquivo: ${file.name} ...`;

            const reader = new FileReader();

            reader.onload = (e) => {
                // Coloca o conteúdo do arquivo na <textarea>
                dataInput.value = e.target.result; 
                
                GG.showLoading(false);
                fileStatus.textContent = `Arquivo "${file.name}" carregado. ${e.target.result.length} caracteres. Clique em "Processar" para validar.`;
                
                // Opcional: Mudar para a aba de "Colar" para mostrar o texto
                pasteTab.click(); 
            };

            reader.onerror = (e) => {
                GG.showLoading(false);
                fileStatus.textContent = 'Erro ao ler o arquivo.';
                console.error('Erro de FileReader:', e);
            };

            reader.readAsText(file);
        });
        // ======================================================
        // <<< FIM DA ADIÇÃO >>>
        // ======================================================
    }

    /**
     * Reseta a view do uploader para o estado inicial.
     */
    function resetImobView() {
        const uploaderForm = document.getElementById('imobUploaderForm');
        const successScreen = document.getElementById('imobSuccessScreen');
        const dataInput = document.getElementById('dataInput');
        const filterEmpresa = document.getElementById('filterEmpresa');
        const filterProduto = document.getElementById('filterProduto');
        const previewSection = document.getElementById('previewSection');
        const insertStatus = document.getElementById('insertStatus');

        if(uploaderForm) uploaderForm.style.display = 'block';
        if(successScreen) successScreen.style.display = 'none';
        if(dataInput) dataInput.value = '';
        
        // <<< ADICIONADO: Reseta os dropdowns >>>
        if(filterEmpresa) filterEmpresa.value = '';
        if(filterProduto) filterProduto.value = '';
        
        if(previewSection) previewSection.classList.add('hidden');
        if(insertStatus) insertStatus.textContent = '';
        globalRowsToInsert = [];

        // ======================================================
        // <<< INÍCIO DA ADIÇÃO: RESETAR ABAS E UPLOAD >>>
        // ======================================================
        // Reseta o input de arquivo
        const fileInput = document.getElementById('imobFileInput');
        if (fileInput) {
            fileInput.value = ''; // Limpa o arquivo selecionado
        }
        if (document.getElementById('fileStatus')) {
            document.getElementById('fileStatus').textContent = '';
        }
        
        // Garante que a aba "Colar" seja a padrão
        const pasteTab = document.getElementById('imobPasteTab');
        if (pasteTab) {
            pasteTab.click();
        }
        // ======================================================
        // <<< FIM DA ADIÇÃO >>>
        // ======================================================

        // ======================================================
        // <<< ATUALIZAÇÃO (Turn 29): Resetar sub-aba >>>
        // ======================================================
        // Garante que a sub-aba "Atualizar" seja a padrão
        const updateTab = document.getElementById('imobSubTab_Update');
        if (updateTab) {
            updateTab.click();
        }
        // ======================================================
        // <<< FIM DA ATUALIZAÇÃO >>>
        // ======================================================
    }

    /**
     * Pega os dados colados, processa, valida e prepara a prévia.
     */
    async function handleProcessData() {
        const previewSummary = document.getElementById('previewSummary');
        // Pega os dados da <textarea> (que agora recebe do 'colar' ou 'importar')
        const rawData = document.getElementById('dataInput').value; 
        const selectedEmpresa = document.getElementById('filterEmpresa').value;
        const selectedProduto = document.getElementById('filterProduto').value;

        if (!rawData) {
            previewSummary.textContent = 'Nenhum dado inserido (colado ou importado).';
            return;
        }
        if (!selectedEmpresa || !selectedProduto) {
            previewSummary.textContent = 'Selecione a Empresa e o Produto.'; // Mensagem atualizada
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

            // ======================================================
            // <<< MUDANÇA: Verificação de duplicados em paralelo (Promise.all) >>>
            // ======================================================
            GG.showLoading(true, 'Verificando duplicados no banco...');
            const existingSeqSet = new Set();
            const CHUNK_SIZE = 500; // Define o tamanho do lote
            
            // 1. Criar um array de promessas
            const duplicateCheckPromises = [];
            for (let i = 0; i < seqList.length; i += CHUNK_SIZE) {
                const chunk = seqList.slice(i, i + CHUNK_SIZE);
                
                // Atualiza o status para o usuário (só o primeiro)
                if (i === 0) {
                    GG.showLoading(true, `Verificando duplicados... (Enviando ${Math.ceil(seqList.length / CHUNK_SIZE)} lotes)`);
                }

                duplicateCheckPromises.push(
                    supabase
                        .from('imob')
                        .select('SEQMOVIMENTAÇÃO')
                        .in('SEQMOVIMENTAÇÃO', chunk)
                );
            }

            // 2. Executar todas as promessas em paralelo
            const results = await Promise.all(duplicateCheckPromises);

            // 3. Processar os resultados
            for (const { data: existingRows, error } of results) {
                if (error) throw error; // Se qualquer lote falhar, o processo para
                
                // Adiciona os IDs encontrados ao Set
                existingRows.forEach(row => {
                    existingSeqSet.add(String(row['SEQMOVIMENTAÇÃO']));
                });
            }
            // ======================================================
            // <<< FIM DA MUDANÇA >>>
            // ======================================================
            
            // 3. Filtrar novos
            GG.showLoading(true, 'Filtrando dados...');
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
                GG.showLoading(true, 'Buscando lojas e segmentos...'); // <<< Feedback adicionado
                
                // ======================================================
                // <<< MUDANÇA: PROCV agora é em paralelo (Promise.all) >>>
                // ======================================================
                const lojaLookupPromises = [];
                for (let i = 0; i < uniqueIds.length; i += CHUNK_SIZE) {
                    const chunk = uniqueIds.slice(i, i + CHUNK_SIZE);
                    lojaLookupPromises.push(
                        supabase
                            .from('lojas')
                            .select('id, nome_loja, segmento')
                            .in('id', chunk)
                    );
                }

                // Executa todas as buscas de "lojas" em paralelo
                const lojaResults = await Promise.all(lojaLookupPromises);

                // Processa os resultados
                for (const { data: lojasData, error: lojasError } of lojaResults) {
                    if (lojasError) throw new Error(`Erro ao buscar 'lojas': ${lojasError.message}`);
                    
                    lojasData.forEach(item => {
                        lojaLookup.set(String(item.id), { loja: item.nome_loja, segmento: item.segmento });
                    });
                }
                // ======================================================
                // <<< FIM DA MUDANÇA >>>
                // ======================================================
            }

            // 5. Aplicar Fórmulas e Tipos
            GG.showLoading(true, 'Aplicando fórmulas e tratando dados...'); // <<< Feedback adicionado
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

    // ======================================================
    // <<< INÍCIO DA ATUALIZAÇÃO: Novas Funções de Configuração >>>
    // ======================================================

    /**
     * Carrega o painel IMOB no seu iframe específico.
     */
    function loadImobPanelIntoIframe() {
        const iframe = document.getElementById('imobLookerIframe');
        if (!iframe) return; // Sai se o iframe não existir

        // ======================================================
        // <<< CORREÇÃO DO BUG (REMOÇÃO) >>>
        // A verificação abaixo estava impedindo o iframe de recarregar
        // caso a primeira tentativa falhasse. Foi removida.
        /*
        if (iframe.src && iframe.src !== "" && iframe.src !== "about:blank") {
            return; // Já carregado, não faz nada
        }
        */
        // ======================================================

        if (globalPanelConfig.has('imob')) {
            const panelData = globalPanelConfig.get('imob');
            if (panelData.embedUrl) {
                GG.showLoading(true, 'Carregando painel...');
                iframe.src = panelData.embedUrl;
                // Esconde o loading depois de 2s
                setTimeout(() => GG.showLoading(false), 2000);
            } else {
                // Se o link estiver em branco nas configs
                iframe.src = "about:blank";
                console.warn("Link do painel IMOB não configurado em Configurações.");
            }
        } else {
            console.warn("Chave 'imob' não encontrada nas configurações.");
        }
    }

    /**
     * Carrega os links dos painéis do Supabase para a memória (globalPanelConfig).
     */
    async function loadGlobalConfig() {
        if (!supabase) return;
        GG.showLoading(true, 'Carregando configurações...');
        
        const { data, error } = await supabase
            .from('painel_links')
            .select('*');

        if (error) {
            console.error('Erro ao carregar links dos painéis:', error);
            GG.showLoading(false);
            return;
        }

        // Limpa o mapa e recarrega
        globalPanelConfig.clear();
        data.forEach(panel => {
            globalPanelConfig.set(panel.painel_key, {
                displayName: panel.display_name,
                embedUrl: panel.embed_url
            });
        });

        console.log('Configuração de painéis carregada:', globalPanelConfig);
        GG.showLoading(false);
    }

    /**
     * Inicializa a lógica da página de Configurações (botão Salvar).
     */
    function initSettingsPage() {
        const saveButton = document.getElementById('saveSettingsBtn');
        if (saveButton) {
            saveButton.addEventListener('click', handleSaveSettings);
        }
    }

    /**
     * Pega os valores dos inputs da página de Configurações e salva no Supabase.
     */
    async function handleSaveSettings() {
        if (!supabase) return;
        GG.showLoading(true, 'Salvando configurações...');

        const imobLink = document.getElementById('settingLinkImob').value;
        const vendasLink = document.getElementById('settingLinkVendas').value;

        // Prepara os dados para o 'upsert'.
        // 'upsert' atualiza se 'painel_key' existir, ou insere se não existir.
        const dataToSave = [
            { 
                painel_key: 'imob', 
                embed_url: imobLink,
                display_name: 'Visualização do Painel IMOB' // O nome pode ser salvo aqui tbm
            },
            { 
                painel_key: 'vendas', 
                embed_url: vendasLink,
                display_name: 'Visualização do Painel Vendas'
            }
        ];

        const { error } = await supabase
            .from('painel_links')
            .upsert(dataToSave, { onConflict: 'painel_key' }); // Chave de conflito

        if (error) {
            console.error('Erro ao salvar configurações:', error);
            GG.showLoading(false);
            // (Opcional: mostrar alerta de erro)
            return;
        }

        // Sucesso! Atualiza o mapa local para não precisar recarregar a página.
        dataToSave.forEach(panel => {
            globalPanelConfig.set(panel.painel_key, {
                displayName: panel.display_name,
                embedUrl: panel.embed_url
            });
        });

        GG.showLoading(false);
        console.log('Configurações salvas e mapa local atualizado.');

        // Mostra um alerta de sucesso
        const alertContainer = document.getElementById('settingsAlertContainer');
        if(alertContainer) {
            alertContainer.innerHTML = `<div class="alert alert-success">Configurações salvas com sucesso!</div>`;
            // Limpa o alerta depois de 3 segundos
            setTimeout(() => { alertContainer.innerHTML = ''; }, 3000);
        }
    }

    // ======================================================
    // <<< FIM DA ATUALIZAÇÃO >>>
    // ======================================================


    /**
     * Pega as linhas processadas e insere no Supabase.
     */
    async function handleInsertData() {
        const statusEl = document.getElementById('insertStatus');

        if (globalRowsToInsert.length === 0) {
            statusEl.textContent = 'Não há linhas novas para inserir.';
            return;
        }

        // ======================================================
        // <<< MUDANÇA: Inserção em Lotes (Chunking) >>>
        // ======================================================
        const CHUNK_SIZE = 500; // Tamanho do lote de inserção
        const totalLotes = Math.ceil(globalRowsToInsert.length / CHUNK_SIZE);
        
        statusEl.textContent = `Preparando para inserir ${globalRowsToInsert.length} linhas em ${totalLotes} lotes...`;

        try {
            for (let i = 0; i < globalRowsToInsert.length; i += CHUNK_SIZE) {
                const chunk = globalRowsToInsert.slice(i, i + CHUNK_SIZE);
                const loteAtual = (i / CHUNK_SIZE) + 1;

                // Atualiza o loading com o progresso
                GG.showLoading(true, `Enviando lote ${loteAtual} de ${totalLotes}... (${chunk.length} linhas)`);
                statusEl.textContent = `Enviando lote ${loteAtual} de ${totalLotes}...`;

                const { error } = await supabase.from('imob').insert(chunk);
                
                if (error) {
                    // Se der erro, joga o erro e para o loop
                    throw new Error(`Erro no lote ${loteAtual}: ${error.message}`);
                }
            }
            // ======================================================
            // <<< FIM DA MUDANÇA >>>
            // ======================================================

            // Se o loop terminar sem erros, mostra a tela de sucesso
            document.getElementById('imobUploaderForm').style.display = 'none';
            document.getElementById('imobSuccessScreen').style.display = 'flex';
            feather.replace(); // Para os ícones dos botões de sucesso

            // Limpa tudo
            globalRowsToInsert = [];
            document.getElementById('dataInput').value = '';
            document.getElementById('previewSection').classList.add('hidden');
            statusEl.textContent = 'Inserção concluída com sucesso!'; // Mensagem final


        } catch (error) {
            console.error('Erro na inserção:', error);
            statusEl.textContent = `Erro ao inserir: ${error.message}`;
        } finally {
            GG.showLoading(false);
            feather.replace();
        }
    }

    // --- 4. FUNÇÕES UTILITÁRIAS (IMOB) ---

    // ======================================================
    // <<< NOVA FUNÇÃO ADICIONADA >>>
    // ======================================================
    /**
     * Busca dados das tabelas 'empresas' e 'produtos' e popula os dropdowns.
     */
    async function populateDropdowns() {
        const empresaSelect = document.getElementById('filterEmpresa');
        const produtoSelect = document.getElementById('filterProduto');

        // Se os selects não existirem nesta view, não faz nada
        if (!empresaSelect || !produtoSelect) return;

        try {
            // Buscar Empresas
            const { data: empresas, error: empresaError } = await supabase
                .from('empresas')
                .select('codigo_empresa, nome_empresa')
                .order('nome_empresa', { ascending: true }); // Ordena alfabeticamente

            if (empresaError) throw empresaError;

            empresaSelect.innerHTML = '<option value="">Selecione uma Empresa</option>'; // Limpa o "Carregando..."
            empresas.forEach(empresa => {
                const option = document.createElement('option');
                option.value = empresa.codigo_empresa; // Ex: "101"
                option.textContent = empresa.nome_empresa; // Ex: "101 - Filial Cuiabá"
                empresaSelect.appendChild(option);
            });

            // Buscar Produtos
            const { data: produtos, error: produtoError } = await supabase
                .from('produtos')
                .select('nome_produto')
                .order('nome_produto', { ascending: true }); // Ordena alfabeticamente

            if (produtoError) throw produtoError;

            produtoSelect.innerHTML = '<option value="">Selecione um Produto</option>'; // Limpa o "Carregando..."
            produtos.forEach(produto => {
                const option = document.createElement('option');
                option.value = produto.nome_produto; // Ex: "PALLET"
                option.textContent = produto.nome_produto; // Ex: "PALLET"
                produtoSelect.appendChild(option);
            });

        } catch (error) {
            console.error('Erro ao popular dropdowns:', error);
            // Informa o usuário sobre o erro nos próprios selects
            empresaSelect.innerHTML = `<option value="">Erro ao carregar empresas</option>`;
            produtoSelect.innerHTML = `<option value="">Erro ao carregar produtos</option>`;
        }
    }
    // ======================================================
    // <<< FIM DA NOVA FUNÇÃO >>>
    // ======================================================

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
        
        // ======================================================
        // <<< INÍCIO DA ATUALIZAÇÃO: LIMITAR PRÉVIA >>>
        // ======================================================
        const PREVIEW_LIMIT = 100; // Limita a prévia a 100 linhas
        // ======================================================
        // <<< FIM DA ATUALIZAÇÃO >>>
        // ======================================================
        
        header.innerHTML = '';
        body.innerHTML = '';

        const duplicateCount = totalParsed - rows.length;
        summary.textContent = `Encontradas ${totalParsed} linhas. ${duplicateCount} já existem no banco. ${rows.length} linhas novas prontas para inserir.`;

        if (rows.length === 0) {
            body.innerHTML = '<tr><td colspan="100%" class="p-4 text-center text-gray-500">Nenhuma linha nova para inserir.</td></tr>';
            return;
        }

        // ======================================================
        // <<< INÍCIO DA ATUALIZAÇÃO: Avisar sobre limite >>>
        // ======================================================
        if (rows.length > PREVIEW_LIMIT) {
            summary.textContent += ` (Mostrando as primeiras ${PREVIEW_LIMIT} na prévia).`;
        }
        // ======================================================
        // <<< FIM DA ATUALIZAÇÃO >>>
        // ======================================================

        // Usa as colunas do primeiro objeto de dados, que inclui as colunas geradas
        const columns = Object.keys(rows[0]);
        columns.forEach(col => {
            header.innerHTML += `<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">${col}</th>`;
        });

        // ======================================================
        // <<< INÍCIO DA ATUALIZAÇÃO: Aplicar Limite >>>
        // ======================================================
        const rowsToRender = rows.slice(0, PREVIEW_LIMIT);
        // ======================================================
        // <<< FIM DA ATUALIZAÇÃO >>>
        // ======================================================

        rowsToRender.forEach(row => { // <<< ATUALIZADO: usa rowsToRender
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
