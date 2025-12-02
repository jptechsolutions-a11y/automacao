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
    let globalReconfRowsToInsert = []; // Novo
    let globalConfRowsToInsert = [];   // Novo
    let globalPanelConfig = new Map();

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

    // 3. RECONFERÊNCIA (Novo)
    const RECONFERENCIA_MAP = [
        'NROEMPRESA', 'EQUIPE', 'NOMEREDUZ', 'DATA', 'SEQTAREFA', 'QTDATIVIDADE', 'PESO',
        'METRAGEMCUBICA', 'QTDVOLUME', 'QTDITEM', 'ATIVIDADE', 'HORA_INICIO', 'HORA_FIM',
        'TIPO_MOV', 'SEQPRODUTO', 'DESCCOMPLETA', 'SEQPALETERF', 'NROCARGA', 'CARGA_MV'
    ];

    // 4. CONFERÊNCIA (Novo)
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

    // --- FUNÇÃO AUXILIAR PARA DATA (CORREÇÃO DO ERRO) ---
    function convertDateBRToISO(dateStr) {
        if (!dateStr || typeof dateStr !== 'string') return null;
        // Tenta encontrar formato DD/MM/YYYY com ou sem hora
        // Pega apenas a parte da data (3 grupos de digitos)
        const match = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
        if (match) {
            // Retorna YYYY-MM-DD
            return `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`;
        }
        return dateStr; // Retorna original se não casar (talvez já esteja em ISO ou nulo)
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
            ['imob', 'movimentacao', 'reconferencia', 'conferencia', 'vendas'].forEach(key => {
                const el = document.getElementById(key === 'movimentacao' ? 'settingLinkMov' : 
                                                 key === 'reconferencia' ? 'settingLinkReconf' :
                                                 key === 'conferencia' ? 'settingLinkConf' : 
                                                 `settingLink${key.charAt(0).toUpperCase() + key.slice(1)}`);
                if(el && globalPanelConfig.has(key)) el.value = globalPanelConfig.get(key).embedUrl || '';
            });
        }

        // Resets
        if (viewId !== 'imobView') resetImobView();
        if (viewId !== 'movimentacaoView') resetMovView();
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
            initReconferenciaUploader(); 
            initConferenciaUploader();  
            populateDropdowns(); 
            initSettingsPage();
            await loadGlobalConfig();
            
            GG.showView('homeView', document.querySelector('a[href="#home"]'));
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
        GG.showLoading(true);
        try {
            const parsed = parseGenericData(rawData, COLUMN_MAP);
            // Lógica IMOB (Mantida)
            // Aqui você deve recolocar sua lógica de PROCV se necessária
            globalRowsToInsert = parsed; 
            renderPreview(globalRowsToInsert, parsed.length, 'previewHeader', 'previewBody', 'previewSummary');
            document.getElementById('previewSection').classList.remove('hidden');
        } finally { GG.showLoading(false); }
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
            // Tratamentos específicos
            rows.forEach(row => {
               if (row['QTDE']) row['QTDE'] = parseFloat(row['QTDE']) || 0;
            });
            globalMovRowsToInsert = rows;
            renderPreview(rows, rows.length, 'movPreviewHeader', 'movPreviewBody', 'movPreviewSummary');
            document.getElementById('movInsertButton').disabled = false;
        }, 'movPreviewSection');
    }
    async function handleInsertMovimentacao() {
        insertBatch('movimentacao', globalMovRowsToInsert, 'movUploaderForm', 'movSuccessScreen', 'movInsertStatus');
    }

    
    // --- 5. UPLOADER RECONFERÊNCIA (CORRIGIDO DATA) ---
    function initReconferenciaUploader() {
        initGenericUploader('reconf', handleProcessReconferencia, handleInsertReconferencia);
    }
    function resetReconfView() { resetGenericView('reconf', 'reconfDataInput', 'reconfPreviewSection', 'reconfInsertStatus', globalReconfRowsToInsert); }
    
    function handleProcessReconferencia() {
        processGenericData('reconfDataInput', RECONFERENCIA_MAP, (rows) => {
             // Tratamentos numéricos e de DATA
             rows.forEach(r => {
                 if(r['QTDATIVIDADE']) r['QTDATIVIDADE'] = parseInt(r['QTDATIVIDADE']) || 0;
                 if(r['QTDVOLUME']) r['QTDVOLUME'] = parseInt(r['QTDVOLUME']) || 0;
                 
                 // CORREÇÃO: Converte Data "DD/MM/AAAA" para "AAAA-MM-DD"
                 if(r['DATA']) r['DATA'] = convertDateBRToISO(r['DATA']);
             });
             globalReconfRowsToInsert = rows;
             renderPreview(rows, rows.length, 'reconfPreviewHeader', 'reconfPreviewBody', 'reconfPreviewSummary');
             document.getElementById('reconfInsertButton').disabled = false;
        }, 'reconfPreviewSection');
    }

    async function handleInsertReconferencia() {
        insertBatch('reconferencia', globalReconfRowsToInsert, 'reconfUploaderForm', 'reconfSuccessScreen', 'reconfInsertStatus');
    }


    // --- 6. UPLOADER CONFERÊNCIA (NOVO) ---
    function initConferenciaUploader() {
        initGenericUploader('conf', handleProcessConferencia, handleInsertConferencia);
    }
    function resetConfView() { resetGenericView('conf', 'confDataInput', 'confPreviewSection', 'confInsertStatus', globalConfRowsToInsert); }
    
    function handleProcessConferencia() {
        processGenericData('confDataInput', CONFERENCIA_MAP, (rows) => {
             // Tratamentos
             rows.forEach(r => {
                 if(r['DIA']) r['DIA'] = parseInt(r['DIA']) || null;
                 if(r['NROCARGA']) r['NROCARGA'] = parseInt(r['NROCARGA']) || null;
                 
                 // Se houver campo de data aqui também, aplicamos:
                 if(r['DATA']) r['DATA'] = convertDateBRToISO(r['DATA']);
             });
             globalConfRowsToInsert = rows;
             renderPreview(rows, rows.length, 'confPreviewHeader', 'confPreviewBody', 'confPreviewSummary');
             document.getElementById('confInsertButton').disabled = false;
        }, 'confPreviewSection');
    }

    async function handleInsertConferencia() {
        insertBatch('conferencia', globalConfRowsToInsert, 'confUploaderForm', 'confSuccessScreen', 'confInsertStatus');
    }


    // --- HELPERS GENÉRICOS ---

    function initGenericUploader(prefix, processFn, insertFn) {
        // Injeção de UI foi movida para o HTML para simplificar
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

    // CORREÇÃO: Adicionada verificação de segurança (el && el.classList)
    function resetGenericView(prefix, inputId, sectionId, statusId, globalArray) {
        const form = document.getElementById(`${prefix}UploaderForm`);
        const success = document.getElementById(`${prefix}SuccessScreen`);
        const input = document.getElementById(inputId);
        const section = document.getElementById(sectionId);
        
        if(form) form.style.display = 'block';
        if(success) success.style.display = 'none';
        if(input) input.value = '';
        if(section) section.classList.add('hidden'); // Verifica se existe antes de acessar classList
        
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
            alert('Por favor, cole os dados primeiro.');
            return; 
        }
        GG.showLoading(true);
        const section = document.getElementById(sectionId);
        if(section) section.classList.remove('hidden');
        
        try {
            const rows = parseGenericData(rawData, map);
            callback(rows);
        } catch(e) { console.error(e); alert('Erro processamento: ' + e.message); }
        finally { GG.showLoading(false); }
    }

    async function insertBatch(table, rows, formId, successId, statusId) {
        if (rows.length === 0) return;
        const statusEl = statusId ? document.getElementById(statusId) : null;
        const CHUNK_SIZE = 500;
        
        try {
            for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
                const chunk = rows.slice(i, i + CHUNK_SIZE);
                GG.showLoading(true, `Enviando lote...`);
                if(statusEl) statusEl.textContent = `Enviando ${i + chunk.length}/${rows.length}...`;
                
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

    function renderPreview(rows, total, headerId, bodyId, summaryId) {
        const header = document.getElementById(headerId);
        const body = document.getElementById(bodyId);
        const summary = document.getElementById(summaryId);
        
        header.innerHTML = ''; body.innerHTML = '';
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
        const reconf = document.getElementById('settingLinkReconf').value;
        const conf = document.getElementById('settingLinkConf').value;
        const vendas = document.getElementById('settingLinkVendas').value;

        GG.showLoading(true, 'Salvando...');
        const updates = [
            { painel_key: 'imob', embed_url: imob, display_name: 'Painel IMOB' },
            { painel_key: 'movimentacao', embed_url: mov, display_name: 'Painel Movimentação' },
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
