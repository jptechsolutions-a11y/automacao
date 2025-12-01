/**
 * ARQUIVO: app.js
 * DESCRIÇÃO: Controla toda a lógica do "App Shell" de Atualização.
 */

window.GG = {};

(function(GG) {
    "use strict";

    // --- VARIÁVEIS GLOBAIS ---
    let supabase = null;
    let globalRowsToInsert = [];
    let globalMovRowsToInsert = []; // Array específico para Movimentação
    let globalPanelConfig = new Map();

    // --- MAPAS DE COLUNAS ---
    
    // 1. IMOB (Antigo)
    const COLUMN_MAP = [
        'SEQMOVIMENTAÇÃO', 'DATA', 'TIPO', 'DOC', 'QUANTIDADE', 'LOCAL', 'SALDO', 'OPERAÇÃO', 
        'ID - Fornecedor', 'data2', 'usuario'
    ];
    const COLUMN_TYPES = {
        'SEQMOVIMENTAÇÃO': 'bigint', 'DOC': 'bigint', 'QUANTIDADE': 'bigint', 'SALDO': 'bigint',
        'ID': 'bigint', 'Emp': 'bigint', 'ano': 'bigint', 'DATA': 'timestamp', 'data2': 'timestamp',
        'codigo_produto': 'bigint', 'custo_unitario': 'numeric'
    };

    // 2. MOVIMENTAÇÃO (Novo)
    const MOVIMENTACAO_MAP = [
        'NROEMPRESA', 'DTAHORMOVTO', 'ATIVIDADE', 'MOVIMENTACAO', 'STATUS_ATIV', 'ENTRADA_SAIDA',
        'DTAHORMOVTO_1', 'SEQPRODUTO', 'DESCCOMPLETA', 'QTDE', 'EMBALAGEM', 'NROCARGA',
        'DTAHORINITAREFA', 'DTAHORFIMTAREFA', 'CODPRODUTIVO', 'PRODUTIVO', 'USUARIO_GER'
    ];

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

    function initAppShell() {
        const sidebar = document.querySelector('.sidebar');
        const sidebarToggle = document.getElementById('sidebarToggle');
        const sidebarOverlay = document.getElementById('sidebarOverlay');

        sidebarToggle.addEventListener('click', () => {
            if (window.innerWidth <= 768) {
                document.body.classList.add('sidebar-open');
                sidebarToggle.querySelector('i').setAttribute('data-feather', 'x');
            } else {
                sidebar.classList.toggle('collapsed');
            }
            feather.replace();
        });

        sidebarOverlay.addEventListener('click', () => {
            document.body.classList.remove('sidebar-open');
            sidebarToggle.querySelector('i').setAttribute('data-feather', 'menu');
            feather.replace();
        });

        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                if (item.classList.contains('disabled')) { e.preventDefault(); return; }
                if (window.innerWidth <= 768) {
                    document.body.classList.remove('sidebar-open');
                    sidebarToggle.querySelector('i').setAttribute('data-feather', 'menu');
                    feather.replace();
                }
            });
        });

        feather.replace();
        initSubTabs(); // Inicializa abas (Imob e Mov)
    }

    function initSubTabs() {
        // Abas IMOB
        setupSubTabs('imobSubTab_Update', 'imobSubTab_Panel', 'imobSubPanel_Update', 'imobSubPanel_Panel', loadImobPanelIntoIframe);
        
        // Abas MOVIMENTAÇÃO (Novo)
        setupSubTabs('movSubTab_Update', 'movSubTab_Panel', 'movSubPanel_Update', 'movSubPanel_Panel', loadMovPanelIntoIframe);
    }

    function setupSubTabs(btnUpdateId, btnPanelId, panelUpdateId, panelPanelId, loadCallback) {
        const btnUpdate = document.getElementById(btnUpdateId);
        const btnPanel = document.getElementById(btnPanelId);
        const panelUpdate = document.getElementById(panelUpdateId);
        const panelPanel = document.getElementById(panelPanelId);

        if (btnUpdate && btnPanel) {
            btnUpdate.addEventListener('click', () => {
                btnUpdate.classList.add('active');
                btnPanel.classList.remove('active');
                panelUpdate.classList.add('active');
                panelPanel.classList.remove('active');
            });

            btnPanel.addEventListener('click', () => {
                btnPanel.classList.add('active');
                btnUpdate.classList.remove('active');
                panelPanel.classList.add('active');
                panelUpdate.classList.remove('active');
                if (loadCallback) loadCallback();
            });
        }
    }

    GG.showView = (viewId, clickedItem, panelKey = null) => {
        document.querySelectorAll('.view-content').forEach(view => view.classList.remove('active'));
        const viewToShow = document.getElementById(viewId);
        if (viewToShow) viewToShow.classList.add('active');

        document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
        if (clickedItem) clickedItem.classList.add('active');

        // Lógica Looker Genérico
        if (viewId === 'lookerView' && panelKey) {
            const iframe = document.getElementById('lookerIframe');
            const title = document.getElementById('lookerTitle');
            if (globalPanelConfig.has(panelKey)) {
                const panelData = globalPanelConfig.get(panelKey);
                title.textContent = panelData.displayName;
                if (iframe.src !== panelData.embedUrl) {
                    iframe.src = panelData.embedUrl;
                }
            } else {
                title.textContent = "Erro: Painel não configurado";
                iframe.src = "";
            }
        }

        // Lógica Configurações (Populate)
        if (viewId === 'settingsView') {
            const imobInput = document.getElementById('settingLinkImob');
            const movInput = document.getElementById('settingLinkMov'); // Novo
            const vendasInput = document.getElementById('settingLinkVendas');

            if (imobInput && globalPanelConfig.has('imob')) imobInput.value = globalPanelConfig.get('imob').embedUrl || '';
            if (movInput && globalPanelConfig.has('movimentacao')) movInput.value = globalPanelConfig.get('movimentacao').embedUrl || '';
            if (vendasInput && globalPanelConfig.has('vendas')) vendasInput.value = globalPanelConfig.get('vendas').embedUrl || '';
        }

        // Resets
        if (viewId === 'imobView') document.getElementById('imobSubTab_Update')?.click();
        if (viewId === 'movimentacaoView') document.getElementById('movSubTab_Update')?.click();

        if (viewId !== 'imobView') resetImobView();
        if (viewId !== 'movimentacaoView') resetMovView();
    };

    GG.logout = async () => {
        if (!supabase) return;
        GG.showLoading(true, 'Saindo...');
        await supabase.auth.signOut();
        window.location.href = 'index.html';
    };


    // --- 2. LÓGICA DE CONEXÃO (SUPABASE) ---

    async function initSupabase() {
        try {
            const response = await fetch('/api/config');
            if (!response.ok) throw new Error('Falha ao buscar config.');
            const keys = await response.json();

            supabase = window.supabase.createClient(keys.SUPABASE_URL, keys.SUPABASE_ANON_KEY);
            return checkAuthSession();

        } catch (error) {
            console.error('Erro de conexão:', error);
            window.location.href = `index.html?error=${encodeURIComponent(error.message)}`;
        }
    }

    async function checkAuthSession() {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
            window.location.href = 'index.html';
        } else {
            document.getElementById('textoStatus').innerHTML = '<i data-feather="check-circle" class="h-4 w-4 mr-2"></i> Conectado!';
            document.getElementById('statusConexao').setAttribute('data-status', 'conectado');
            
            // Habilita botões
            document.querySelectorAll('button[disabled]').forEach(b => b.disabled = false);

            initAppShell();
            initImobUploader();
            initMovUploader();
            populateDropdowns(); // <<< AGORA VAI FUNCIONAR
            initSettingsPage();
            await loadGlobalConfig();
            
            GG.showView('homeView', document.querySelector('a[href="#home"]'));
        }
    }


    // --- 3. LÓGICA DO UPLOADER IMOB ---

    function initImobUploader() {
        const processButton = document.getElementById('processButton');
        const insertButton = document.getElementById('insertButton');
        if(processButton) processButton.addEventListener('click', handleProcessData);
        if(insertButton) insertButton.addEventListener('click', handleInsertData);

        document.getElementById('imobSuccessHomeBtn')?.addEventListener('click', () => GG.showView('homeView'));
        document.getElementById('imobSuccessAgainBtn')?.addEventListener('click', resetImobView);

        // Abas internas (Colar/Arquivo)
        const pasteTab = document.getElementById('imobPasteTab');
        const uploadTab = document.getElementById('imobUploadTab');
        if(pasteTab && uploadTab) {
            pasteTab.addEventListener('click', () => { 
                pasteTab.classList.add('active'); uploadTab.classList.remove('active');
                document.getElementById('pastePanel').style.display = 'block';
                document.getElementById('uploadPanel').style.display = 'none';
            });
            uploadTab.addEventListener('click', () => {
                uploadTab.classList.add('active'); pasteTab.classList.remove('active');
                document.getElementById('uploadPanel').style.display = 'block';
                document.getElementById('pastePanel').style.display = 'none';
            });
        }
        
        // Input Arquivo Imob
        const fileInput = document.getElementById('imobFileInput');
        if(fileInput) fileInput.addEventListener('change', (e) => handleFileRead(e, 'dataInput', 'fileStatus'));
    }

    function handleFileRead(event, targetTextareaId, statusId) {
        const file = event.target.files[0];
        if (!file) return;
        GG.showLoading(true, 'Lendo...');
        const reader = new FileReader();
        reader.onload = (e) => {
            document.getElementById(targetTextareaId).value = e.target.result;
            GG.showLoading(false);
            document.getElementById(statusId).textContent = `Carregado: ${file.name}`;
        };
        reader.readAsText(file);
    }

    function resetImobView() {
        document.getElementById('imobUploaderForm').style.display = 'block';
        document.getElementById('imobSuccessScreen').style.display = 'none';
        document.getElementById('dataInput').value = '';
        
        // Reset dropdowns
        const filterEmpresa = document.getElementById('filterEmpresa');
        const filterProduto = document.getElementById('filterProduto');
        if(filterEmpresa) filterEmpresa.value = '';
        if(filterProduto) filterProduto.value = '';

        document.getElementById('previewSection').classList.add('hidden');
        globalRowsToInsert = [];
    }

    async function handleProcessData() {
        // Leitura dos filtros
        const empresaSelect = document.getElementById('filterEmpresa');
        const produtoSelect = document.getElementById('filterProduto');
        const rawData = document.getElementById('dataInput').value;
        const previewSummary = document.getElementById('previewSummary');

        if (!rawData) {
            previewSummary.textContent = 'Nenhum dado inserido.';
            return;
        }

        // Validação dos filtros
        if (!empresaSelect.value || !produtoSelect.value) {
            previewSummary.textContent = 'Selecione a Empresa e o Produto nos filtros acima.';
            return;
        }

        const selectedEmpresaOption = empresaSelect.options[empresaSelect.selectedIndex];
        const selectedProdutoOption = produtoSelect.options[produtoSelect.selectedIndex];

        GG.showLoading(true, 'Processando...');
        document.getElementById('previewSection').classList.remove('hidden');

        try {
            const parsedRows = parseGenericData(rawData, COLUMN_MAP);
            
            // Simulação de verificação de duplicados e PROCV (Simplificado)
            // Aqui você deve manter sua lógica original de verificação de SEQMOVIMENTAÇÃO
            // e preenchimento com os dados dos filtros.

            const enrichedRows = parsedRows.map(row => {
                // Aplica filtros
                row['Emp'] = empresaSelect.value;
                row['nome_empresa'] = selectedEmpresaOption.dataset.nome;
                row['uf_empresa'] = selectedEmpresaOption.dataset.uf;
                
                row['codigo_produto'] = produtoSelect.value;
                row['Produto'] = selectedProdutoOption.dataset.nome;
                row['custo_unitario'] = selectedProdutoOption.dataset.custo;

                // (Lógica SEERRO/PROCV simplificada aqui...)
                // ...
                return row;
            });
            
            globalRowsToInsert = enrichedRows;
            renderPreview(globalRowsToInsert, parsedRows.length, 'previewHeader', 'previewBody', 'previewSummary');

        } catch (error) {
            console.error(error);
            previewSummary.textContent = `Erro: ${error.message}`;
        } finally {
            GG.showLoading(false);
        }
    }

    async function handleInsertData() {
        if (globalRowsToInsert.length === 0) return;
        GG.showLoading(true, 'Inserindo...');
        try {
            const { error } = await supabase.from('imob').insert(globalRowsToInsert);
            if (error) throw error;
            document.getElementById('imobUploaderForm').style.display = 'none';
            document.getElementById('imobSuccessScreen').style.display = 'flex';
        } catch (e) {
            console.error(e);
            alert('Erro: ' + e.message);
        } finally {
            GG.showLoading(false);
        }
    }


    // --- 4. LÓGICA DO UPLOADER MOVIMENTAÇÃO (NOVO) ---

    function initMovUploader() {
        const btnProcess = document.getElementById('movProcessButton');
        const btnInsert = document.getElementById('movInsertButton');
        
        // Injeção da UI de Abas (se não existir)
        const movDataInput = document.getElementById('movDataInput');
        if (movDataInput && !document.getElementById('movUploadTab')) {
            const card = movDataInput.closest('.info-card');
            if (card) {
                card.innerHTML = `
                    <h2 class="text-xl font-semibold mb-4 text-gray-700">1. Inserir Dados de Movimentação</h2>
                    <div class="imob-tab-nav mb-4">
                        <button id="movPasteTab" class="imob-tab-btn active"><i data-feather="clipboard" class="h-4 w-4 mr-2"></i> Colar Dados</button>
                        <button id="movUploadTab" class="imob-tab-btn"><i data-feather="upload" class="h-4 w-4 mr-2"></i> Importar Arquivo</button>
                    </div>
                    <div id="movPastePanel" class="tab-panel active">
                        <p class="text-sm text-gray-600 mb-4">Cole os dados (NROEMPRESA, DTAHORMOVTO...).</p>
                        <textarea id="movDataInput" rows="10" class="form-input font-mono" placeholder="Cole os dados aqui..."></textarea>
                    </div>
                    <div id="movUploadPanel" class="tab-panel" style="display: none;">
                        <p class="text-sm text-gray-600 mb-4">Faça upload de um arquivo .txt ou .csv.</p>
                        <input type="file" id="movFileInput" class="form-input" accept=".txt,.csv,.tsv,.log">
                        <p id="movFileStatus" class="text-xs text-gray-500 mt-2"></p>
                    </div>
                    <button id="movProcessButton" class="btn btn-primary w-full mt-6"><i data-feather="refresh-cw" class="h-4 w-4 mr-2"></i> Processar Dados</button>
                `;
                if (typeof feather !== 'undefined') feather.replace();
            }
        }

        const newBtnProcess = document.getElementById('movProcessButton');
        const newBtnInsert = document.getElementById('movInsertButton'); 
        
        if (newBtnProcess) newBtnProcess.addEventListener('click', handleProcessMovimentacao);
        if (newBtnInsert) newBtnInsert.addEventListener('click', handleInsertMovimentacao);

        // Abas Movimentação
        const movPasteTab = document.getElementById('movPasteTab');
        const movUploadTab = document.getElementById('movUploadTab');
        if (movPasteTab && movUploadTab) {
            movPasteTab.addEventListener('click', () => {
                movPasteTab.classList.add('active'); movUploadTab.classList.remove('active');
                document.getElementById('movPastePanel').style.display = 'block';
                document.getElementById('movUploadPanel').style.display = 'none';
            });
            movUploadTab.addEventListener('click', () => {
                movUploadTab.classList.add('active'); movPasteTab.classList.remove('active');
                document.getElementById('movUploadPanel').style.display = 'block';
                document.getElementById('movPastePanel').style.display = 'none';
            });
        }

        const movFileInput = document.getElementById('movFileInput');
        if (movFileInput) {
            movFileInput.addEventListener('change', (e) => handleFileRead(e, 'movDataInput', 'movFileStatus'));
        }

        document.getElementById('movSuccessHomeBtn')?.addEventListener('click', () => GG.showView('homeView'));
        document.getElementById('movSuccessAgainBtn')?.addEventListener('click', resetMovView);
    }

    function resetMovView() {
        document.getElementById('movUploaderForm').style.display = 'block';
        document.getElementById('movSuccessScreen').style.display = 'none';
        const dataInput = document.getElementById('movDataInput');
        if (dataInput) dataInput.value = '';
        document.getElementById('movPreviewSection').classList.add('hidden');
        globalMovRowsToInsert = [];
        document.getElementById('movPasteTab')?.click();
    }

    function handleProcessMovimentacao() {
        const rawData = document.getElementById('movDataInput').value;
        const previewSummary = document.getElementById('movPreviewSummary');

        if (!rawData) {
            previewSummary.textContent = 'Cole os dados primeiro.';
            return;
        }

        GG.showLoading(true);
        document.getElementById('movPreviewSection').classList.remove('hidden');

        try {
            const rows = parseGenericData(rawData, MOVIMENTACAO_MAP);
            // Tratamento básico
            rows.forEach(row => {
                if (row['QTDE']) row['QTDE'] = parseFloat(row['QTDE']) || 0;
                if (row['EMBALAGEM']) row['EMBALAGEM'] = parseFloat(row['EMBALAGEM']) || 0;
                if (row['SEQPRODUTO']) row['SEQPRODUTO'] = parseInt(row['SEQPRODUTO']) || null;
                if (row['NROEMPRESA']) row['NROEMPRESA'] = parseInt(row['NROEMPRESA']) || null;
            });
            globalMovRowsToInsert = rows;
            renderPreview(globalMovRowsToInsert, rows.length, 'movPreviewHeader', 'movPreviewBody', 'movPreviewSummary');
            document.getElementById('movInsertButton').disabled = globalMovRowsToInsert.length === 0;
        } catch (error) {
            console.error(error);
            previewSummary.textContent = `Erro: ${error.message}`;
        } finally {
            GG.showLoading(false);
        }
    }

    async function handleInsertMovimentacao() {
        if (globalMovRowsToInsert.length === 0) return;
        const statusEl = document.getElementById('movInsertStatus');
        const CHUNK_SIZE = 500;
        
        try {
            for (let i = 0; i < globalMovRowsToInsert.length; i += CHUNK_SIZE) {
                const chunk = globalMovRowsToInsert.slice(i, i + CHUNK_SIZE);
                GG.showLoading(true, `Enviando lote...`);
                const { error } = await supabase.from('movimentacao').insert(chunk);
                if (error) throw error;
            }
            document.getElementById('movUploaderForm').style.display = 'none';
            document.getElementById('movSuccessScreen').style.display = 'flex';
            feather.replace();
            globalMovRowsToInsert = [];
        } catch (error) {
            console.error(error);
            statusEl.textContent = `Erro: ${error.message}`;
        } finally {
            GG.showLoading(false);
        }
    }


    // --- 5. CONFIGURAÇÕES E UTILITÁRIOS ---

    function parseGenericData(text, map) {
        const rows = text.trim().split('\n');
        let separator = '\t';
        if (rows.length > 0) {
            const tabs = (rows[0].match(/\t/g) || []).length;
            const semis = (rows[0].match(/;/g) || []).length;
            if (semis > tabs) separator = ';';
        }
        return rows.map(rowStr => {
            const values = rowStr.split(separator);
            let obj = {};
            map.forEach((colName, index) => {
                let val = values[index] ? values[index].trim() : null;
                if (val === 'null' || val === '') val = null;
                obj[colName] = val;
            });
            return obj;
        });
    }

    function renderPreview(rows, total, headerId, bodyId, summaryId) {
        const header = document.getElementById(headerId);
        const body = document.getElementById(bodyId);
        const summary = document.getElementById(summaryId);
        
        header.innerHTML = '';
        body.innerHTML = '';
        summary.textContent = `Total de ${total} linhas.`;

        if (rows.length === 0) return;

        const columns = Object.keys(rows[0]);
        columns.forEach(col => {
            header.innerHTML += `<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">${col}</th>`;
        });

        const rowsToRender = rows.slice(0, 50);
        rowsToRender.forEach(row => {
            let tr = '<tr>';
            columns.forEach(col => {
                tr += `<td class="px-4 py-3 whitespace-nowrap text-sm text-gray-700">${row[col] !== null ? row[col] : ''}</td>`;
            });
            tr += '</tr>';
            body.innerHTML += tr;
        });
    }

    function loadImobPanelIntoIframe() { loadPanelGeneric('imob', 'imobLookerIframe'); }
    function loadMovPanelIntoIframe() { loadPanelGeneric('movimentacao', 'movLookerIframe'); }

    function loadPanelGeneric(key, iframeId) {
        const iframe = document.getElementById(iframeId);
        if (!iframe) return;
        if (globalPanelConfig.has(key)) {
            const url = globalPanelConfig.get(key).embedUrl;
            if (url && iframe.src !== url) iframe.src = url;
        }
    }

    async function loadGlobalConfig() {
        if (!supabase) return;
        const { data, error } = await supabase.from('painel_links').select('*');
        if (error) return console.error(error);
        globalPanelConfig.clear();
        data.forEach(p => globalPanelConfig.set(p.painel_key, { displayName: p.display_name, embedUrl: p.embed_url }));
    }

    function initSettingsPage() {
        document.getElementById('saveSettingsBtn')?.addEventListener('click', handleSaveSettings);
    }

    async function handleSaveSettings() {
        const imob = document.getElementById('settingLinkImob').value;
        const mov = document.getElementById('settingLinkMov').value;
        const vendas = document.getElementById('settingLinkVendas').value;

        GG.showLoading(true, 'Salvando...');
        const updates = [
            { painel_key: 'imob', embed_url: imob, display_name: 'Painel IMOB' },
            { painel_key: 'movimentacao', embed_url: mov, display_name: 'Painel Movimentação' },
            { painel_key: 'vendas', embed_url: vendas, display_name: 'Painel Vendas' }
        ];
        const { error } = await supabase.from('painel_links').upsert(updates, { onConflict: 'painel_key' });
        if (!error) await loadGlobalConfig();
        GG.showLoading(false);
        // (Opcional) Alerta de sucesso
    }

    // --- CORREÇÃO AQUI: Restaurada a função populateDropdowns ---
    async function populateDropdowns() {
        const empresaSelect = document.getElementById('filterEmpresa');
        const produtoSelect = document.getElementById('filterProduto');

        // Se não existir na tela, sai (evita erro se estiver em outra view que não use)
        if (!empresaSelect || !produtoSelect) return;

        try {
            // Buscar Empresas
            const { data: empresas, error: empError } = await supabase
                .from('empresas')
                .select('codigo_empresa, nome_empresa, uf')
                .order('nome_empresa');

            if (empError) throw empError;

            empresaSelect.innerHTML = '<option value="">Selecione uma Empresa</option>';
            empresas.forEach(emp => {
                const opt = document.createElement('option');
                opt.value = emp.codigo_empresa;
                opt.textContent = `${emp.codigo_empresa} - ${emp.nome_empresa}`;
                opt.dataset.nome = emp.nome_empresa;
                opt.dataset.uf = emp.uf;
                empresaSelect.appendChild(opt);
            });

            // Buscar Produtos
            const { data: produtos, error: prodError } = await supabase
                .from('produtos')
                .select('codigo_produto, nome_produto, custo_unitario')
                .order('nome_produto');

            if (prodError) throw prodError;

            produtoSelect.innerHTML = '<option value="">Selecione um Produto</option>';
            produtos.forEach(prod => {
                const opt = document.createElement('option');
                opt.value = prod.codigo_produto;
                opt.textContent = `${prod.codigo_produto} - ${prod.nome_produto}`;
                opt.dataset.nome = prod.nome_produto;
                opt.dataset.custo = prod.custo_unitario;
                produtoSelect.appendChild(opt);
            });

        } catch (err) {
            console.error('Erro ao popular dropdowns:', err);
            empresaSelect.innerHTML = '<option value="">Erro ao carregar</option>';
            produtoSelect.innerHTML = '<option value="">Erro ao carregar</option>';
        }
    }

    document.addEventListener('DOMContentLoaded', () => {
        document.getElementById('appShell').style.display = 'flex';
        initSupabase();
    });

})(window.GG);
