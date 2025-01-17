const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const { inicializarDB, carregarClientesConhecidos } = require('./database');
const { gerenciarFluxo, clientesConhecidos, ultimaMensagem, TEMPO_LIMITE } = require('./fluxoPedido');
const { verificarStatus } = require('./statusPedido');
const { processarComandoAdmin, enviarAjudaAdmin, NUMEROS_ADMIN, inicializarAdmin } = require('./adminComandos');

// Comandos aceitos em diferentes variações
const COMANDOS = {
    INICIAR: [
        'oi', 'olá', 'ola', 'hello', 'hey', 'inicio', 'início', 
        'começar', 'comecar', 'start', 'cardápio', 'cardapio', 
        '!cardapio', '!cardápio', 'menu', 'cardapio', 'menu', 'ei', 'pedido', 'fazer pedido'
    ],
    AJUDA: [
        'ajuda', 'help', 'socorro', 'duvida', 'dúvida', 'duvidas',
        'dúvidas', 'opcoes', 'opções', '?', '/help', '/ajuda'
    ],
    CANCELAR: [
        'cancelar', 'cancela', 'cancel', 'cancele', 'cancelar pedido',
        'desistir', 'parar', 'sair', 'x'
    ],
    STATUS: [
        'status', 'andamento', 'pedido', 'meu pedido', 'onde está',
        'onde esta', 'acompanhar', 'rastrear'
    ],
    ATENDENTE: [
        'atendente', 'humano', 'pessoa', 'falar com alguem', 
        'falar com alguém', 'atendimento'
    ]
};

// Configurar o cliente com autenticação local
const client = new Client({
    authStrategy: new LocalAuth({
        clientId: "acaiteria_bot",
        dataPath: "./whatsapp_auth"
    }),
    puppeteer: {
        args: ['--no-sandbox']
    }
});

// Evento quando precisar do QR code
client.on('qr', (qr) => {
    console.log('QR Code recebido, escaneie-o no WhatsApp');
    qrcode.generate(qr, {small: true});
});

client.on('loading_screen', (percent, message) => {
    console.log('Carregando...', percent, message);
});

client.on('authenticated', () => {
    console.log('Autenticado com sucesso!');
});

client.on('auth_failure', (msg) => {
    console.error('Falha na autenticação:', msg);
});

client.on('ready', () => {
    console.log('Bot está online e pronto para uso!');
});

// Função para normalizar texto (remover acentos, converter para minúsculo)
function normalizarTexto(texto) {
    return texto.toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim();
}

// Função para verificar se o texto corresponde a algum comando
function identificarComando(texto) {
    const textoNormalizado = normalizarTexto(texto);
    
    for (const [tipo, variacoes] of Object.entries(COMANDOS)) {
        if (variacoes.some(cmd => textoNormalizado === normalizarTexto(cmd))) {
            return tipo;
        }
    }
    return null;
}

async function enviarMensagemBoasVindas(message) {
    const boasVindas = `🍨 *Bem-vindo(a) à Açaiteria Supreme!* 🍨

Olá! Que bom ter você por aqui! 😊

*Nossos Produtos:*
🌟 Açaí cremoso
🥤 Vitaminas
🥤 Bebidas
🥪 Lanches

*Facilidades:*
💳 Várias formas de pagamento
🏠 Entrega em toda cidade
⚡ Pedido rápido e fácil

*Horário de Funcionamento:*
📅 Segunda a Sexta
⏰ 8:00 às 21:00
📅 Sábado e Domingo
⏰ 8:00 às 19:00

*Precisa de ajuda?*
Digite *ajuda* a qualquer momento para ver as opções disponíveis.

*Dicas:*
• Você pode escolher vários adicionais para seu açaí
• Acompanhe seu pedido em tempo real
• Pagamento via PIX com desconto especial

*Comece agora mesmo!*
Digite *cardápio* para fazer seu pedido 🛍️`;

    await message.reply(boasVindas);
}

async function deveEnviarBoasVindas(clienteNumero) {
    const ultimoAcesso = ultimaMensagem.get(clienteNumero);
    const agora = Date.now();
    
    // Se não tem último acesso ou se passaram mais de 4 horas
    if (!ultimoAcesso || (agora - ultimoAcesso > TEMPO_LIMITE)) {
        ultimaMensagem.set(clienteNumero, agora);
        return true;
    }
    return false;
}

client.on('message', async (message) => {
    if (message.type !== 'chat') return;

    try {
        // Verifica primeiro se é um comando administrativo
        if (message.body.startsWith('/')) {
            console.log('Comando admin detectado:', message.body);
            const isComandoAdmin = await processarComandoAdmin(message);
            if (isComandoAdmin) {
                console.log('Comando admin processado com sucesso');
                return;
            }
        }

        // Verifica se é pedido de ajuda administrativa
        if (message.body.toLowerCase() === '/ajuda' && NUMEROS_ADMIN.includes(message.from)) {
            const isAjudaAdmin = await enviarAjudaAdmin(message);
            if (isAjudaAdmin) return;
        }

        // Continua com o fluxo normal do bot
        const comando = identificarComando(message.body);

        switch (comando) {
            case 'INICIAR':
                const deveEnviar = await deveEnviarBoasVindas(message.from);
                if (deveEnviar) {
                    await enviarMensagemBoasVindas(message);
                }
                await gerenciarFluxo(message, true);
                break;

            case 'AJUDA':
                const ajuda = `*📱 Comandos Disponíveis:*

*cardápio* - Ver menu e fazer pedido
*ajuda* - Ver esta mensagem
*status* - Acompanhar seu pedido
*cancelar* - Cancelar pedido atual
*horario* - Ver horário de funcionamento
*endereco* - Ver nossa localização
*contato* - Falar com atendente

*💡 Durante seu pedido:*
• Use números para selecionar opções
• Digite 0 para voltar
• Digite X para cancelar

*🛍️ No carrinho:*
• Confira seus itens
• Adicione ou remova produtos
• Escolha forma de pagamento

*Precisa de mais ajuda?*
Digite *atendente* para falar com uma pessoa real.`;

                await message.reply(ajuda);
                break;

            case 'CANCELAR':
                await gerenciarFluxo(message, false, true);
                break;

            case 'STATUS':
                await verificarStatus(message);
                break;

            case 'ATENDENTE':
                await message.reply('👨‍💼 Um atendente entrará em contato em breve. Por favor, aguarde alguns instantes.');
                break;

            default:
                await gerenciarFluxo(message);
                break;
        }
    } catch (error) {
        console.error('Erro ao processar mensagem:', error);
        await message.reply('Ops! Algo deu errado. Digite *ajuda* para ver as opções disponíveis.');
    }
});

// Tratamento de erros para manter o bot sempre online
client.on('disconnected', (reason) => {
    console.log('Cliente desconectado:', reason);
    client.initialize();
});

process.on('uncaughtException', (err) => {
    console.log('Erro não tratado:', err);
});

// Inicialização
async function inicializar() {
    try {
        console.log('Iniciando sistema...');
        inicializarDB();
        console.log('Banco de dados inicializado');
        
        await carregarClientesConhecidos(clientesConhecidos);
        console.log('Clientes conhecidos carregados');
        
        // Inicializa o admin antes do cliente
        inicializarAdmin(client);
        console.log('Sistema admin inicializado');
        
        // Inicializa o cliente do WhatsApp
        client.initialize();
        console.log('Cliente WhatsApp inicializado');
    } catch (error) {
        console.error('Erro na inicialização:', error);
    }
}

inicializar();

module.exports = { normalizarTexto }; // Exporta para uso em outros arquivos 