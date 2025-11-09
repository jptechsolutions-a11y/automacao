/**
 * ARQUIVO: login.js
 * DESCRIÇÃO: Controla a lógica da página de login.html.
 * - Conecta ao Supabase (via API Vercel)
 * - Trata Login (Email/Senha)
 * - Trata Solicitação de Acesso (Sign Up)
 * - Trata Recuperação de Senha
 */

(function() {
    "use strict";

    let supabase = null;

    // Elementos da UI
    const loginCard = document.getElementById('loginCard');
    const requestAccessCard = document.getElementById('requestAccessCard');
    const forgotCard = document.getElementById('forgotCard');

    const loginForm = document.getElementById('loginForm');
    const requestAccessForm = document.getElementById('requestAccessForm');
    const forgotForm = document.getElementById('forgotForm');

    const loginSubmitBtn = document.getElementById('loginSubmitBtn');
    const requestSubmitBtn = document.getElementById('requestSubmitBtn');
    const forgotSubmitBtn = document.getElementById('forgotSubmitBtn');
    
    // Links de Navegação
    document.getElementById('forgotLink').addEventListener('click', (e) => { e.preventDefault(); showCard('forgot'); });
    document.getElementById('requestLink').addEventListener('click', (e) => { e.preventDefault(); showCard('request'); });
    document.getElementById('loginLinkRequest').addEventListener('click', (e) => { e.preventDefault(); showCard('login'); });
    document.getElementById('loginLinkForgot').addEventListener('click', (e) => { e.preventDefault(); showCard('login'); });

    /**
     * Mostra o card de formulário correto
     * @param {'login'|'request'|'forgot'} cardName 
     */
    function showCard(cardName) {
        loginCard.style.display = 'none';
        requestAccessCard.style.display = 'none';
        forgotCard.style.display = 'none';
        
        if (cardName === 'login') {
            loginCard.style.display = 'block';
        } else if (cardName === 'request') {
            requestAccessCard.style.display = 'block';
        } else if (cardName === 'forgot') {
            forgotCard.style.display = 'block';
        }
    }

    /**
     * Mostra/Esconde a tela de Loading
     */
    function showLoading(show, text = 'Processando...') {
        const loadingEl = document.getElementById('loading');
        if (show) {
            loadingEl.querySelector('p').textContent = text;
            loadingEl.style.display = 'flex';
        } else {
            loadingEl.style.display = 'none';
        }
    }

    /**
     * Mostra um alerta em um container
     * @param {string} containerId (ex: 'loginAlert')
     * @param {string} message 
     * @param {'success'|'error'|'info'} type 
     */
    function showAlert(containerId, message, type = 'error') {
        const container = document.getElementById(containerId);
        // Usa as classes de estilo do style.css
        const alertTypeClass = `alert-${type}`; 
        container.innerHTML = `<div class="alert ${alertTypeClass}">${message}</div>`;
    }

    /**
     * Busca as chaves da API do Vercel e inicializa o Supabase.
     */
    async function initSupabase() {
        try {
            const response = await fetch('/api/config');
            if (!response.ok) {
                throw new Error('Falha ao buscar config. Status: ' + response.status);
            }
            const keys = await response.json();

            if (!keys.SUPABASE_URL || !keys.SUPABASE_ANON_KEY) {
                throw new Error('Chaves do Supabase não encontradas na API.');
            }

            supabase = window.supabase.createClient(keys.SUPABASE_URL, keys.SUPABASE_ANON_KEY);
            
            if (!supabase) {
                throw new Error("Falha ao inicializar o cliente Supabase.");
            }
            
            // Verifica se já está logado
            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
                console.log('Sessão ativa encontrada, redirecionando...');
                window.location.href = 'index.html'; // Redireciona para o app
            }

        } catch (error) {
            console.error('Erro de conexão:', error);
            showAlert('loginAlert', `Erro crítico de conexão: ${error.message}`);
        }
    }

    /**
     * Lógica de Login (Email/Senha)
     */
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        showLoading(true, 'Entrando...');
        loginSubmitBtn.disabled = true;

        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;

        try {
            const { error } = await supabase.auth.signInWithPassword({ email, password });
            
            if (error) throw error;

            // Sucesso! O Supabase guarda o token no localStorage
            window.location.href = 'app.html'; // Redireciona para o app

        } catch (error) {
            console.error('Erro de login:', error);
            showAlert('loginAlert', 'E-mail ou senha inválidos.');
        } finally {
            showLoading(false);
            loginSubmitBtn.disabled = false;
        }
    });

    /**
     * Lógica de Solicitação de Acesso (Sign Up)
     */
    requestAccessForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        showLoading(true, 'Enviando solicitação...');
        requestSubmitBtn.disabled = true;

        const email = document.getElementById('requestEmail').value;
        const password = document.getElementById('requestPassword').value;
        const nome = document.getElementById('requestNome').value;

        try {
            // Tenta criar o usuário. O Supabase enviará um e-mail de confirmação.
            const { error } = await supabase.auth.signUp({
                email: email,
                password: password,
                options: {
                    data: {
                        full_name: nome // Salva o nome no metadata
                    }
                }
            });
            
            if (error) throw error;

            showAlert('requestAlert', 'Solicitação enviada! Por favor, verifique seu e-mail para confirmar sua conta.', 'success');
            requestAccessForm.reset();

        } catch (error) {
            console.error('Erro na solicitação:', error);
            showAlert('requestAlert', `Erro: ${error.message}`);
        } finally {
            showLoading(false);
            requestSubmitBtn.disabled = false;
        }
    });

    /**
     * Lógica de Recuperação de Senha
     */
    forgotForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        showLoading(true, 'Enviando e-mail...');
        forgotSubmitBtn.disabled = true;

        const email = document.getElementById('forgotEmail').value;

        try {
            const { error } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: window.location.origin, // Link para onde o usuário volta
            });
            
            if (error) throw error;

            showAlert('forgotAlert', 'E-mail de redefinição enviado com sucesso! Verifique sua caixa de entrada.', 'success');
            forgotForm.reset();

        } catch (error) {
            console.error('Erro na redefinição:', error);
            showAlert('forgotAlert', `Erro: ${error.message}`);
        } finally {
            showLoading(false);
            forgotSubmitBtn.disabled = false;
        }
    });


    // --- INICIALIZAÇÃO ---
    document.addEventListener('DOMContentLoaded', () => {
        initSupabase();
    });

})();
