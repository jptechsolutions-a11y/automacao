/**
 * ARQUIVO: api/config.js
 * DESCRIÇÃO: API Serverless do Vercel.
 * * COMO USAR:
 * 1. Coloque este arquivo na pasta /api do seu projeto Vercel.
 * 2. Defina as Environment Variables no painel do Vercel:
 * - SUPABASE_URL (ex: https://seu-projeto.supabase.co)
 * - SUPABASE_ANON_KEY (ex: eyJ...)
 *
 * O app (app.js) vai chamar este endpoint (/api/config) para
 * buscar as chaves com segurança.
 */

export default function handler(request, response) {
    // Pega as variáveis de ambiente definidas no Vercel
    const { SUPABASE_URL, SUPABASE_ANON_KEY } = process.env;

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
        response.status(500).json({ 
            error: 'Variáveis de ambiente (SUPABASE_URL, SUPABASE_ANON_KEY) não estão configuradas no Vercel.' 
        });
        return;
    }

    // Envia as chaves como JSON
    response.status(200).json({
        SUPABASE_URL,
        SUPABASE_ANON_KEY
    });
}
