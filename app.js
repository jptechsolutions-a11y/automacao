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
    let globalMovRowsToInsert = []; 
    let globalSepRowsToInsert = [];
    let globalReconfRowsToInsert = [];
    let globalConfRowsToInsert = [];   
    let globalPanelConfig = new Map();
    let globalLojasMap = new Map(); // NOVO: Mapa para simular PROCV na tabela 'lojas'

    // --- MAPAS DE COLUNAS ---
    
    // 1. IMOB
    const COLUMN_MAP = [
        'SEQMOVIMENTAÇÃO', 'DATA', 'TIPO', 'DOC', 'QUANTIDADE', 'LOCAL', 'SALDO', 'OPERAÇÃO', 
        'ID - Fornecedor', 'data2', 'usuario'
    ];

    // 2. MOVIMENTAÇÃO
    const MOVIMENTACAO_MAP = [
        'NROEMPRESA', 'DTAHORMOVTO', 'ATIVIDADE', 'MOVIMENTACAO', 'STATUS_ATIV', 'ENTRADA_SAIDA',
        'DTAHORMOVTO_1', 'SEQPRODUTO', 'DESCCOMPLETA', 'QTDE', 'EMBALAGEM', 'NROCARGA',
        'DTAHORINITAREFA', 'DTAHORFIMTAREFA', 'CODPRODUTIVO', 'PRODUTIVO', 'USUARIO_GER'
    ];

    // 3. SEPARAÇÃO
    const SEPARACAO_MAP = [
        'NROEMPRESA', 'CODPRODUTIVO', 'PRODUTIVO', 'CODRH', 'CODEQUIPE', 'EQUIPE', 
        'QTDITEM', 'QTDVOLUME', 'DTAINICIO', 'Hora Inicio', 'DTA Fim', 'HORAFIM', 
        'NROCARGA', 'SEQLOTE', 'PESO', 'METRAGEMCUBICA', 'Distribuição', 'LINHA_SEPARACAO', 
        'QTD_VISITAS', 'QTD_SEPARADA', 'QTD_CANCELADA', 'PERC_SEPARADA', 'ATIVIDADE'
    ];

    // 4. RECONFERÊNCIA
    const RECONFERENCIA_MAP = [
        'NROEMPRESA', 'EQUIPE', 'NOMEREDUZ', 'DATA', 'SEQTAREFA', 'QTDATIVIDADE', 'PESO',
        'METRAGEMCUBICA', 'QTDVOLUME', 'QTDITEM', 'ATIVIDADE', 'HORA_INICIO', 'HORA_FIM',
        'TIPO_MOV', 'SEQPRODUTO', 'DESCCOMPLETA', 'SEQPALETERF', 'NROCARGA', 'CARGA_MV'
    ];

    // 5. CONFERÊNCIA
    const CONFERENCIA_MAP = [
        'NROEMPRESA', 'DATA', 'HORA', 'MES_ANO', 'DIA', 'NROCARGA', 'SEQPALETERF',
        'SEQPRODUTO', 'DESCCOMPLETA', 'CATEGORIA_1', 'NORMA_PULMAO', 'PALETIZACAO',
        'SITUACAO', 'VOLUMES', 'MODALIDADE', 'FORNECEDORES', 'CODPRODUTIVO', 'NOMEREDUZ',
        'INICIO_CR', 'FIM_CR'
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

    // --- FUNÇÕES AUXILIARES DE FORMATAÇÃO ---

    function convertDateBRToISO(dateStr) {
        if (!dateStr || typeof dateStr !== 'string') return null;
        const match = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
        if (match) {
            return `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`;
        }
        return dateStr; 
    }

    /**
     * Converte strings numéricas brasileiras (ex: "2,5") para float padrão (2.5)
     * Remove pontos de milhar se houver, e troca vírgula por ponto.
     */
    function parsePtBrFloat(val) {
        if (!val && val !== 0) return null;
        if (typeof val === 'number') return val;
        
        let str = String(val).trim();
        if (str === '') return null;

        // Tenta limpar pontos de milhar e substitui a vírgula por ponto decimal
        // Ex: "1.000,50" -> "1000.50"
        str = str.replace(/\./g, '').replace(',', '.');
        
        const num = parseFloat(str);
        return isNaN(num) ? null : num;
    }

    // --- 1. LÓGICA DO APP SHELL (UI) ---

    function initAppShell() {
        const sidebar = document.querySelector('.sidebar');
        const sidebarToggle = document.getElementById('sidebarToggle');
        const sidebarOverlay = document.getElementById('sidebarOverlay');

        if(sidebarToggle) {
            sidebarToggle.addEventListener('click', () => {
                if (window.innerWidth <= 768) {
                    document.body.classList.add('sidebar-open');
                    sidebarToggle.querySelector('i').setAttribute('data-feather', 'x');
                } else {
                    sidebar.classList.toggle('collapsed');
                }
                feather.replace();
            });
        }

        if(sidebarOverlay) {
            sidebarOverlay.addEventListener('click', () => {
                document.body.classList.remove('sidebar-open');
                sidebarToggle.querySelector('i').setAttribute('data-feather', 'menu');
                feather.replace();
            });
        }

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
        initSubTabs(); 
    }

    function initSubTabs() {
        setupSubTabs('imobSubTab_Update', 'imobSubTab_Panel', 'imobSubPanel_Update', 'imobSubPanel_Panel', loadImobPanelIntoIframe);
        setupSubTabs('movSubTab_Update', 'movSubTab_Panel', 'movSubPanel_Update', 'movSubPanel_Panel', loadMovPanelIntoIframe);
        setupSubTabs('sepSubTab_Update', 'sepSubTab_Panel', 'sepSubPanel_Update', 'sepSubPanel_Panel', loadSepPanelIntoIframe); 
        setupSubTabs('reconfSubTab_Update', 'reconfSubTab_Panel', 'reconfSubPanel_Update', 'reconfSubPanel_Panel', loadReconfPanelIntoIframe);
        setupSubTabs('confSubTab_Update', 'confSubTab_Panel', 'confSubPanel_Update', 'confSubPanel_Panel', loadConfPanelIntoIframe);
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
            loadPanelGeneric(panelKey, 'lookerIframe', 'lookerTitle');
        }

        // Populate Configs
        if (viewId === 'settingsView') {
            ['imob', 'movimentacao', 'separacao', 'reconferencia', 'conferencia', 'vendas'].forEach(key => {
                const el = document.getElementById(
                    key === 'movimentacao' ? 'settingLinkMov' : 
                    key === 'separacao' ? 'settingLinkSeparacao' :
                    key === 'reconferencia' ? 'settingLinkReconf' :
                    key === 'conferencia' ? 'settingLinkConf' : 
                    `settingLink${key.charAt(0).toUpperCase() + key.slice(1)}`
                );
                if(el && globalPanelConfig.has(key)) el.value = globalPanelConfig.get(key).embedUrl || '';
            });
        }

        // Resets
        if (viewId !== 'imobView') resetImobView();
        if (viewId !== 'movimentacaoView') resetMovView();
        if (viewId !== 'separacaoView') resetSepView();
        if (viewId !== 'reconferenciaView') resetReconfView();
        if (viewId !== 'conferenciaView') resetConfView();
    };

    GG.logout = async () => {
        if (!supabase) return;
        GG.showLoading(true, 'Saindo...');
        await supabase.auth.signOut();
        window.location.href = 'index.html';
    };


    // --- 2. LÓGICA DE CONEXÃO ---
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
            document.querySelectorAll('button[disabled]').forEach(b => b.disabled = false);

            initAppShell();
            initImobUploader();
            initMovUploader();
            initSeparacaoUploader();
            initReconferenciaUploader(); 
            initConferenciaUploader();  
            populateDropdowns(); 
            initSettingsPage();
            await loadGlobalConfig();
            await loadLojasMap(); // NOVO: Carrega o mapa de lojas para PROCV
            
            GG.showView('homeView', document.querySelector('a[href="#home"]'));
        }
    }

    /**
     * NOVO: Função para carregar o mapa de lojas (para simular PROCV)
     */
    async function loadLojasMap() {
        if (!supabase) return;
        try {
            // Assumindo que a tabela é 'lojas' e que ela tem colunas 'id', 'nome_loja' e 'segmento'
            const { data: lojas, error } = await supabase.from('lojas').select('id, nome_loja, segmento');
            if (error) throw error;
            
            globalLojasMap.clear();
            lojas.forEach(loja => {
                // A chave é o ID do fornecedor, que é usado no "PROCV". Convertemos para string para garantir
                globalLojasMap.set(String(loja.id), { loja: loja.nome_loja, segmento: loja.segmento });
            });
            console.log(`[IMOB] Mapa de Lojas carregado com ${globalLojasMap.size} itens.`);
        } catch (error) {
            console.error('[IMOB] Erro ao carregar mapa de lojas para PROCV:', error);
        }
    }


    // --- 3. UPLOADER IMOB ---
    function initImobUploader() {
        const processButton = document.getElementById('processButton');
        const insertButton = document.getElementById('insertButton');
        if(processButton) processButton.addEventListener('click', handleProcessData);
        if(insertButton) insertButton.addEventListener('click', handleInsertData);
        
        setupPasteUploadTabs('imobPasteTab', 'imobUploadTab', 'pastePanel', 'uploadPanel');
        
        const fileInput = document.getElementById('imobFileInput');
        if(fileInput) fileInput.addEventListener('change', (e) => handleFileRead(e, 'dataInput', 'fileStatus'));

        document.getElementById('imobSuccessHomeBtn')?.addEventListener('click', () => GG.showView('homeView'));
    }

    function resetImobView() {
        document.getElementById('imobUploaderForm').style.display = 'block';
        document.getElementById('imobSuccessScreen').style.display = 'none';
        document.getElementById('dataInput').value = '';
        document.getElementById('previewSection').classList.add('hidden');
        globalRowsToInsert = [];
    }
    
    async function handleProcessData() {
        const rawData = document.getElementById('dataInput').value;
        if (!rawData) return;
        GG.showLoading(true, 'Processando e Validando Dados IMOB...');
        
        try {
            // 1. Parseia os dados brutos
            let parsed = parseGenericData(rawData, COLUMN_MAP);
            let rowsToInsert = [];
            let duplicates = 0;
            
            // 1.1 Coletar todas as SEQMOVIMENTAÇÃO (limpas) existentes no batch
            const currentSequences = parsed.map(row => {
                let cleanedSeq = String(row['SEQMOVIMENTAÇÃO'] || '').replace(/\./g, '').replace(/,/g, '');
                return parseInt(cleanedSeq) || null;
            }).filter(seq => seq !== null);

            // 1.2 Fetch das sequências que JÁ existem no Supabase
            let existingSequences = new Set();
            if (currentSequences.length > 0) {
                 const { data: existingData, error: fetchError } = await supabase
                    .from('imob')
                    .select('SEQMOVIMENTAÇÃO')
                    .in('SEQMOVIMENTAÇÃO', currentSequences);

                if (fetchError) throw fetchError;
                
                existingSequences = new Set(existingData.map(d => d.SEQMOVIMENTAÇÃO));
            }


            // 2. Aplicar Tratamento de Formatação, PROCV e Filtro
            parsed.forEach(row => {
               // A) Limpeza e Conversão
               
               // SEQMOVIMENTAÇÃO (Inteiro/BigInt Limpo - Resolve o erro '73,000')
               let cleanedSeq = String(row['SEQMOVIMENTAÇÃO'] || '').replace(/\./g, '').replace(/,/g, '');
               const seqMov = parseInt(cleanedSeq) || null; 
               row['SEQMOVIMENTAÇÃO'] = seqMov;
               
               // NUMÉRICOS (Decimais)
               row['QUANTIDADE'] = parsePtBrFloat(row['QUANTIDADE']);
               row['SALDO'] = parsePtBrFloat(row['SALDO']);
               
               // DATA (ISO)
               const dataStr = row['DATA'];
               row['DATA'] = convertDateBRToISO(dataStr);
               
               // B) Campos Gerados
               
               // NOVO CAMPO: ANO
               if (row['DATA']) {
                   row['ano'] = new Date(row['DATA']).getFullYear();
               } else {
                   row['ano'] = null;
               }

               // C) Split e PROCV (Lojas/Segmento)
               const idFornecedorFull = row['ID - Fornecedor'] || '';
               const parts = idFornecedorFull.split('-');
               const idKey = parts[0].trim();
               const fornecedorName = parts.slice(1).join('-').trim() || null;
               
               // Novas colunas (a serem inseridas no banco, se a tabela imob as tiver)
               row['ID'] = parseInt(idKey) || null;
               row['fornecedor'] = fornecedorName;
               row['loja'] = fornecedorName; // Valor default (SEERRO/IFERROR)
               row['Segmento'] = null; // Valor default

               // Simulação PROCV (VLOOKUP) - Usando o mapa carregado globalmente
               if (globalLojasMap.has(idKey)) {
                   const lojaData = globalLojasMap.get(idKey);
                   row['loja'] = lojaData.loja || fornecedorName; 
                   row['Segmento'] = lojaData.segmento;
               } 

               // D) Filtro de Duplicados
               if (seqMov !== null && existingSequences.has(seqMov)) {
                   duplicates++;
                   return; // Ignora duplicados
               }
               
               // E) Adicionar linha processada
               rowsToInsert.push(row);
            });

            globalRowsToInsert = rowsToInsert; 
            
            // Monta o resumo
            const totalLines = parsed.length;
            const newLines = rowsToInsert.length;
            const summary = `Total de ${totalLines} linhas processadas. ${duplicates} já existem no banco. ${newLines} linhas novas prontas para inserção.`;

            renderPreview(globalRowsToInsert, newLines, 'previewHeader', 'previewBody', 'previewSummary', summary);
            
            document.getElementById('previewSection').classList.remove('hidden');
            document.getElementById('insertButton').disabled = newLines === 0;

        } catch (error) { 
            console.error('Erro no processamento IMOB:', error);
            alert(`Erro ao processar/validar dados: ${error.message}`);
        } finally { 
            GG.showLoading(false); 
        }
    }
    
    // ATUALIZADO: RenderPreview para aceitar a mensagem de resumo
    function renderPreview(rows, total, headerId, bodyId, summaryId, customSummary) {
        const header = document.getElementById(headerId);
        const body = document.getElementById(bodyId);
        const summary = document.getElementById(summaryId);
        
        header.innerHTML = ''; body.innerHTML = '';
        // Usa a mensagem de resumo customizada
        summary.textContent = customSummary || `Total de ${total} linhas processadas.`;
        
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

    async function handleInsertData() {
         insertBatch('imob', globalRowsToInsert, 'imobUploaderForm', 'imobSuccessScreen');
    }


    // --- 4. UPLOADER MOVIMENTAÇÃO ---
    function initMovUploader() {
        initGenericUploader('mov', handleProcessMovimentacao, handleInsertMovimentacao);
    }
    function resetMovView() { resetGenericView('mov', 'movDataInput', 'movPreviewSection', 'movInsertStatus', globalMovRowsToInsert); }
    
    function handleProcessMovimentacao() {
        processGenericData('movDataInput', MOVIMENTACAO_MAP, (rows) => {
            rows.forEach(row => {
               // Converte campos numéricos que podem vir com vírgula (ex: "2,5")
               row['QTDE'] = parsePtBrFloat(row['QTDE']);
               row['EMBALAGEM'] = parsePtBrFloat(row['EMBALAGEM']);
               
               // Opcional: Garantir que BigInts vazios virem null
               if (row['SEQPRODUTO'] === '') row['SEQPRODUTO'] = null;
               if (row['NROEMPRESA'] === '') row['NROEMPRESA'] = null;
            });
            
            globalMovRowsToInsert = rows;
            const summary = `Total de ${rows.length} linhas processadas e prontas para inserção.`;
            renderPreview(rows, rows.length, 'movPreviewHeader', 'movPreviewBody', 'movPreviewSummary', summary);
            document.getElementById('movInsertButton').disabled = false;
        }, 'movPreviewSection');
    }
    
    async function handleInsertMovimentacao() {
        insertBatch('movimentacao', globalMovRowsToInsert, 'movUploaderForm', 'movSuccessScreen', 'movInsertStatus');
    }

    // --- 5. UPLOADER SEPARAÇÃO ---
    function initSeparacaoUploader() {
        initGenericUploader('sep', handleProcessSeparacao, handleInsertSeparacao);
    }
    function resetSepView() { resetGenericView('sep', 'sepDataInput', 'sepPreviewSection', 'sepInsertStatus', globalSepRowsToInsert); }
    
    function handleProcessSeparacao() {
        processGenericData('sepDataInput', SEPARACAO_MAP, (rows) => {
            rows.forEach(r => {
                if(r['NROEMPRESA']) r['NROEMPRESA'] = parseInt(r['NROEMPRESA']) || null;
                if(r['CODPRODUTIVO']) r['CODPRODUTIVO'] = parseInt(r['CODPRODUTIVO']) || null;
                if(r['CODEQUIPE']) r['CODEQUIPE'] = parseInt(r['CODEQUIPE']) || null;
                if(r['QTDITEM']) r['QTDITEM'] = parseInt(r['QTDITEM']) || null;
                if(r['NROCARGA']) r['NROCARGA'] = parseInt(r['NROCARGA']) || null;
                if(r['SEQLOTE']) r['SEQLOTE'] = parseInt(r['SEQLOTE']) || null;
                if(r['QTD_VISITAS']) r['QTD_VISITAS'] = parseInt(r['QTD_VISITAS']) || null;
                if(r['QTD_SEPARADA']) r['QTD_SEPARADA'] = parseInt(r['QTD_SEPARADA']) || null;
                
                // Tratamento de decimais na Separação também
                if(r['PESO']) r['PESO'] = parsePtBrFloat(r['PESO']);
                if(r['METRAGEMCUBICA']) r['METRAGEMCUBICA'] = parsePtBrFloat(r['METRAGEMCUBICA']);
            });
            globalSepRowsToInsert = rows;
            const summary = `Total de ${rows.length} linhas processadas e prontas para inserção.`;
            renderPreview(rows, rows.length, 'sepPreviewHeader', 'sepPreviewBody', 'sepPreviewSummary', summary);
            document.getElementById('sepInsertButton').disabled = false;
        }, 'sepPreviewSection');
    }

    async function handleInsertSeparacao() {
        insertBatch('separacao', globalSepRowsToInsert, 'sepUploaderForm', 'sepSuccessScreen', 'sepInsertStatus');
    }

    
    // --- 6. UPLOADER RECONFERÊNCIA ---
    function initReconferenciaUploader() {
        initGenericUploader('reconf', handleProcessReconferencia, handleInsertReconferencia);
    }
    function resetReconfView() { resetGenericView('reconf', 'reconfDataInput', 'reconfPreviewSection', 'reconfInsertStatus', globalReconfRowsToInsert); }
    
    function handleProcessReconferencia() {
        processGenericData('reconfDataInput', RECONFERENCIA_MAP, (rows) => {
             rows.forEach(r => {
                 if(r['QTDATIVIDADE']) r['QTDATIVIDADE'] = parseInt(r['QTDATIVIDADE']) || 0;
                 if(r['QTDVOLUME']) r['QTDVOLUME'] = parseInt(r['QTDVOLUME']) || 0;
                 if(r['DATA']) r['DATA'] = convertDateBRToISO(r['DATA']);

                 // Decimais Reconferência
                 if(r['PESO']) r['PESO'] = parsePtBrFloat(r['PESO']);
                 if(r['METRAGEMCUBICA']) r['METRAGEMCUBICA'] = parsePtBrFloat(r['METRAGEMCUBICA']);
             });
             globalReconfRowsToInsert = rows;
             const summary = `Total de ${rows.length} linhas processadas e prontas para inserção.`;
             renderPreview(rows, rows.length, 'reconfPreviewHeader', 'reconfPreviewBody', 'reconfPreviewSummary', summary);
             document.getElementById('reconfInsertButton').disabled = false;
        }, 'reconfPreviewSection');
    }

    async function handleInsertReconferencia() {
        insertBatch('reconferencia', globalReconfRowsToInsert, 'reconfUploaderForm', 'reconfSuccessScreen', 'reconfInsertStatus');
    }


    // --- 7. UPLOADER CONFERÊNCIA ---
    function initConferenciaUploader() {
        initGenericUploader('conf', handleProcessConferencia, handleInsertConferencia);
    }
    function resetConfView() { resetGenericView('conf', 'confDataInput', 'confPreviewSection', 'confInsertStatus', globalConfRowsToInsert); }
    
    function handleProcessConferencia() {
        processGenericData('confDataInput', CONFERENCIA_MAP, (rows) => {
             rows.forEach(r => {
                 if(r['DIA']) r['DIA'] = parseInt(r['DIA']) || null;
                 if(r['NROCARGA']) r['NROCARGA'] = parseInt(r['NROCARGA']) || null;
                 if(r['DATA']) r['DATA'] = convertDateBRToISO(r['DATA']);
             });
             globalConfRowsToInsert = rows;
             const summary = `Total de ${rows.length} linhas processadas e prontas para inserção.`;
             renderPreview(rows, rows.length, 'confPreviewHeader', 'confPreviewBody', 'confPreviewSummary', summary);
             document.getElementById('confInsertButton').disabled = false;
        }, 'confPreviewSection');
    }

    async function handleInsertConferencia() {
        insertBatch('conferencia', globalConfRowsToInsert, 'confUploaderForm', 'confSuccessScreen', 'confInsertStatus');
    }


    // --- HELPERS GENÉRICOS ---

    function initGenericUploader(prefix, processFn, insertFn) {
        const btnProcess = document.getElementById(`${prefix}ProcessButton`);
        const btnInsert = document.getElementById(`${prefix}InsertButton`);
        
        if (btnProcess) btnProcess.addEventListener('click', processFn);
        if (btnInsert) btnInsert.addEventListener('click', insertFn);
        
        setupPasteUploadTabs(`${prefix}PasteTab`, `${prefix}UploadTab`, `${prefix}PastePanel`, `${prefix}UploadPanel`);
        
        const fInput = document.getElementById(`${prefix}FileInput`);
        if(fInput) fInput.addEventListener('change', (e) => handleFileRead(e, `${prefix}DataInput`, `${prefix}FileStatus`));

        document.getElementById(`${prefix}SuccessHomeBtn`)?.addEventListener('click', () => GG.showView('homeView'));
        document.getElementById(`${prefix}SuccessAgainBtn`)?.addEventListener('click', () => {
             if(prefix === 'mov') resetMovView();
             if(prefix === 'sep') resetSepView();
             if(prefix === 'reconf') resetReconfView();
             if(prefix === 'conf') resetConfView();
        });
    }

    function setupPasteUploadTabs(pasteTabId, uploadTabId, pastePanelId, uploadPanelId) {
        const pTab = document.getElementById(pasteTabId);
        const uTab = document.getElementById(uploadTabId);
        const pPanel = document.getElementById(pastePanelId);
        const uPanel = document.getElementById(uploadPanelId);

        if(pTab && uTab) {
            pTab.addEventListener('click', () => {
                pTab.classList.add('active'); uTab.classList.remove('active');
                pPanel.style.display = 'block'; uPanel.style.display = 'none';
            });
            uTab.addEventListener('click', () => {
                uTab.classList.add('active'); pTab.classList.remove('active');
                uPanel.style.display = 'block'; pPanel.style.display = 'none';
            });
        }
    }

    function resetGenericView(prefix, inputId, sectionId, statusId, globalArray) {
        const form = document.getElementById(`${prefix}UploaderForm`);
        const success = document.getElementById(`${prefix}SuccessScreen`);
        const input = document.getElementById(inputId);
        const section = document.getElementById(sectionId);
        
        if(form) form.style.display = 'block';
        if(success) success.style.display = 'none';
        if(input) input.value = '';
        if(section) section.classList.add('hidden'); 
        
        if(statusId) {
            const status = document.getElementById(statusId);
            if(status) status.textContent = '';
        }
        
        globalArray.length = 0; 
        document.getElementById(`${prefix}PasteTab`)?.click();
    }

    function processGenericData(inputId, map, callback, sectionId) {
        const rawData = document.getElementById(inputId).value;
        if (!rawData) {
            // Em vez de alert(), apenas seta o texto no preview se for necessário
            document.getElementById(sectionId)?.classList.remove('hidden');
            document.getElementById(`${sectionId.replace('Section', 'Summary')}`).textContent = 'Por favor, cole os dados primeiro.';
            return; 
        }
        GG.showLoading(true);
        const section = document.getElementById(sectionId);
        if(section) section.classList.remove('hidden');
        
        try {
            const rows = parseGenericData(rawData, map);
            callback(rows);
        } catch(e) { 
            console.error(e); 
            // Usa o Summary para mostrar o erro sem alert
            document.getElementById(`${sectionId.replace('Section', 'Summary')}`).textContent = `Erro processamento: ${e.message}`;
        }
        finally { GG.showLoading(false); }
    }

    async function insertBatch(table, rows, formId, successId, statusId) {
        if (rows.length === 0) return;
        const statusEl = statusId ? document.getElementById(statusId) : null;
        const CHUNK_SIZE = 500;
        
        try {
            for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
                const chunk = rows.slice(i, i + CHUNK_SIZE);
                
                const currentCount = Math.min(i + CHUNK_SIZE, rows.length);
                const msg = `Enviando linhas ${i + 1} a ${currentCount} de ${rows.length}...`;
                
                // Atualiza o Loading Screen
                GG.showLoading(true, msg);
                
                // Atualiza o texto abaixo do botão (se existir)
                if(statusEl) statusEl.textContent = msg;
                
                const { error } = await supabase.from(table).insert(chunk);
                if (error) throw error;
            }
            document.getElementById(formId).style.display = 'none';
            document.getElementById(successId).style.display = 'flex';
            feather.replace();
            rows.length = 0; // Limpa array global
        } catch (error) {
            console.error(error);
            if(statusEl) statusEl.textContent = `Erro: ${error.message}`;
            alert('Erro ao inserir: ' + error.message);
        } finally {
            GG.showLoading(false);
        }
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


    function loadImobPanelIntoIframe() { loadPanelGeneric('imob', 'imobLookerIframe'); }
    function loadMovPanelIntoIframe() { loadPanelGeneric('movimentacao', 'movLookerIframe'); }
    function loadSepPanelIntoIframe() { loadPanelGeneric('separacao', 'sepLookerIframe'); }
    function loadReconfPanelIntoIframe() { loadPanelGeneric('reconferencia', 'reconfLookerIframe'); }
    function loadConfPanelIntoIframe() { loadPanelGeneric('conferencia', 'confLookerIframe'); }

    function loadPanelGeneric(key, iframeId, titleId=null) {
        const iframe = document.getElementById(iframeId);
        if (!iframe) return;
        if (globalPanelConfig.has(key)) {
            const config = globalPanelConfig.get(key);
            if (iframe.src !== config.embedUrl) iframe.src = config.embedUrl;
            if (titleId) document.getElementById(titleId).textContent = config.displayName;
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
        const sep = document.getElementById('settingLinkSeparacao').value; 
        const reconf = document.getElementById('settingLinkReconf').value;
        const conf = document.getElementById('settingLinkConf').value;
        const vendas = document.getElementById('settingLinkVendas').value;

        GG.showLoading(true, 'Salvando...');
        const updates = [
            { painel_key: 'imob', embed_url: imob, display_name: 'Painel IMOB' },
            { painel_key: 'movimentacao', embed_url: mov, display_name: 'Painel Movimentação' },
            { painel_key: 'separacao', embed_url: sep, display_name: 'Painel Separação' }, 
            { painel_key: 'reconferencia', embed_url: reconf, display_name: 'Painel Reconferência' },
            { painel_key: 'conferencia', embed_url: conf, display_name: 'Painel Conferência' },
            { painel_key: 'vendas', embed_url: vendas, display_name: 'Painel Vendas' }
        ];
        const { error } = await supabase.from('painel_links').upsert(updates, { onConflict: 'painel_key' });
        if (!error) await loadGlobalConfig();
        GG.showLoading(false);
    }

    async function populateDropdowns() {
        const empresaSelect = document.getElementById('filterEmpresa');
        const produtoSelect = document.getElementById('filterProduto');
        if (!empresaSelect || !produtoSelect) return;
        try {
            const { data: empresas } = await supabase.from('empresas').select('codigo_empresa, nome_empresa, uf').order('nome_empresa');
            if(empresas) {
                empresaSelect.innerHTML = '<option value="">Selecione...</option>';
                empresas.forEach(emp => {
                    const opt = document.createElement('option');
                    opt.value = emp.codigo_empresa;
                    opt.textContent = `${emp.codigo_empresa} - ${emp.nome_empresa}`;
                    opt.dataset.nome = emp.nome_empresa;
                    opt.dataset.uf = emp.uf;
                    empresaSelect.appendChild(opt);
                });
            }
            const { data: produtos } = await supabase.from('produtos').select('codigo_produto, nome_produto, custo_unitario').order('nome_produto');
            if(produtos) {
                produtoSelect.innerHTML = '<option value="">Selecione...</option>';
                produtos.forEach(prod => {
                    const opt = document.createElement('option');
                    opt.value = prod.codigo_produto;
                    opt.textContent = `${prod.codigo_produto} - ${prod.nome_produto}`;
                    opt.dataset.nome = prod.nome_produto;
                    opt.dataset.custo = prod.custo_unitario;
                    produtoSelect.appendChild(opt);
                });
            }
        } catch (err) { console.error('Erro dropdowns', err); }
    }

    document.addEventListener('DOMContentLoaded', () => {
        document.getElementById('appShell').style.display = 'flex';
        initSupabase();
    });

})(window.GG);
