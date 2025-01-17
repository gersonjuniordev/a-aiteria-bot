const { atualizarStatusPedido, STATUS_PEDIDO, buscarPedidoAtivo, buscarPedidosAtivos } = require('./database');

// Números autorizados a usar comandos administrativos
const NUMEROS_ADMIN = [
    '553172466905@c.us',  // Número admin
    '553198537881@c.us'
];

let whatsappClient = null;

function inicializarAdmin(client) {
    whatsappClient = client;
    console.log('Sistema administrativo inicializado');
    console.log('Admins configurados:', NUMEROS_ADMIN);
}

const COMANDOS_ADMIN = {
    '/confirmar': STATUS_PEDIDO.CONFIRMADO,
    '/preparando': STATUS_PEDIDO.PREPARANDO,
    '/saiuentrega': STATUS_PEDIDO.SAIU_ENTREGA,
    '/entregue': STATUS_PEDIDO.ENTREGUE,
    '/cancelar': STATUS_PEDIDO.CANCELADO,
    '/pedidos': 'listar_pedidos' // Novo comando
};

async function processarComandoAdmin(message) {
    // Log para debug
    console.log('Verificando comando admin:', message.body);
    console.log('Remetente:', message.from);
    console.log('Número formatado:', formatarNumeroAdmin(message.from));
    console.log('É admin?', NUMEROS_ADMIN.includes(formatarNumeroAdmin(message.from)));

    // Verifica se é um número autorizado usando o número formatado
    if (!NUMEROS_ADMIN.includes(formatarNumeroAdmin(message.from))) {
        console.log('Acesso negado para:', message.from);
        return false;
    }

    const texto = message.body.toLowerCase().trim();
    const partes = texto.split(' ');
    const comando = partes[0];

    console.log('Comando recebido:', comando);

    // Comando para listar pedidos
    if (comando === '/pedidos') {
        await listarPedidosAtivos(message);
        return true;
    }

    const numeroPedido = partes[1];

    if (!COMANDOS_ADMIN[comando]) {
        console.log('Comando não reconhecido:', comando);
        await message.reply('❌ Comando não reconhecido. Digite /ajuda para ver os comandos disponíveis.');
        return true;
    }

    if (!numeroPedido) {
        console.log('Número do pedido não fornecido');
        await message.reply('❌ Por favor, informe o número do pedido. Exemplo: /confirmar 123');
        return true;
    }

    try {
        await atualizarStatusPedido(numeroPedido, COMANDOS_ADMIN[comando]);
        const mensagemConfirmacao = await gerarMensagemConfirmacao(numeroPedido, COMANDOS_ADMIN[comando]);
        await message.reply(mensagemConfirmacao);
        
        // Notifica o cliente sobre a atualização
        await notificarCliente(numeroPedido, COMANDOS_ADMIN[comando]);
        return true;
    } catch (error) {
        console.error('Erro ao processar comando admin:', error);
        await message.reply('❌ Erro ao atualizar status do pedido. Verifique o número do pedido.');
        return true;
    }
}

async function gerarMensagemConfirmacao(numeroPedido, status) {
    let mensagem = `*🔄 Status Atualizado*\n\n`;
    mensagem += `Pedido #${numeroPedido}\n`;
    
    switch (status) {
        case STATUS_PEDIDO.CONFIRMADO:
            mensagem += '✅ Pedido confirmado com sucesso';
            break;
        case STATUS_PEDIDO.PREPARANDO:
            mensagem += '👨‍🍳 Pedido em preparo';
            break;
        case STATUS_PEDIDO.SAIU_ENTREGA:
            mensagem += '🛵 Pedido saiu para entrega';
            break;
        case STATUS_PEDIDO.ENTREGUE:
            mensagem += '🎉 Pedido marcado como entregue';
            break;
        case STATUS_PEDIDO.CANCELADO:
            mensagem += '❌ Pedido cancelado';
            break;
    }

    return mensagem;
}

async function listarPedidosAtivos(message) {
    try {
        const pedidos = await buscarPedidosAtivos();
        
        if (pedidos.length === 0) {
            await message.reply('📝 Não há pedidos ativos no momento.');
            return;
        }

        let mensagem = '*📋 Pedidos Ativos:*\n\n';
        
        for (const pedido of pedidos) {
            const items = JSON.parse(pedido.items);
            mensagem += `*Pedido #${pedido.id}*\n`;
            mensagem += `📱 Cliente: ${pedido.cliente_nome}\n`;
            mensagem += `📞 Contato: ${formatarNumero(pedido.cliente_numero)}\n`;
            mensagem += `💰 Valor: R$ ${pedido.valor_total.toFixed(2)}\n`;
            mensagem += `📍 Endereço: ${pedido.endereco}\n`;
            mensagem += `💳 Pagamento: ${pedido.forma_pagamento}\n`;
            mensagem += `🕒 Status: ${formatarStatus(pedido.status)}\n`;
            
            mensagem += '\n*Itens:*\n';
            items.forEach((item, index) => {
                mensagem += `${index + 1}. ${item.nome}\n`;
                if (item.adicionais && item.adicionais.length > 0) {
                    item.adicionais.forEach(adicional => {
                        mensagem += `   • ${adicional.nome}\n`;
                    });
                }
            });
            
            mensagem += '\n-------------------\n\n';
        }

        mensagem += `*Total de pedidos ativos:* ${pedidos.length}\n\n`;
        mensagem += '*Comandos disponíveis:*\n';
        mensagem += '• /confirmar [número]\n';
        mensagem += '• /preparando [número]\n';
        mensagem += '• /saiuentrega [número]\n';
        mensagem += '• /entregue [número]\n';
        mensagem += '• /cancelar [número]';

        await message.reply(mensagem);
    } catch (error) {
        console.error('Erro ao listar pedidos:', error);
        await message.reply('❌ Erro ao buscar pedidos ativos.');
    }
}

function formatarNumero(numero) {
    // Remove o @c.us do final do número
    return numero.replace('@c.us', '');
}

function formatarStatus(status) {
    switch (status) {
        case STATUS_PEDIDO.PENDENTE:
            return '📝 Pendente';
        case STATUS_PEDIDO.CONFIRMADO:
            return '✅ Confirmado';
        case STATUS_PEDIDO.PREPARANDO:
            return '👨‍🍳 Em preparo';
        case STATUS_PEDIDO.SAIU_ENTREGA:
            return '🛵 Saiu para entrega';
        case STATUS_PEDIDO.ENTREGUE:
            return '🎉 Entregue';
        case STATUS_PEDIDO.CANCELADO:
            return '❌ Cancelado';
        default:
            return '❓ Desconhecido';
    }
}

async function enviarAjudaAdmin(message) {
    if (!NUMEROS_ADMIN.includes(message.from)) {
        return false;
    }

    const ajuda = `*🔧 Comandos Administrativos:*

/pedidos - Ver todos os pedidos ativos
/confirmar [número] - Confirmar pedido
/preparando [número] - Marcar como em preparo
/saiuentrega [número] - Marcar como saiu para entrega
/entregue [número] - Marcar como entregue
/cancelar [número] - Cancelar pedido

*Exemplo:* /confirmar 123

*Observações:*
• Use /pedidos para ver todos os pedidos ativos
• Substitua [número] pelo número real do pedido
• Os comandos são irreversíveis
• Use com atenção`;

    await message.reply(ajuda);
    return true;
}

async function notificarCliente(numeroPedido, status) {
    try {
        if (!whatsappClient) {
            console.error('Cliente WhatsApp não inicializado');
            return;
        }

        const pedido = await buscarPedidoAtivo(numeroPedido);
        if (!pedido) return;

        let mensagem = `*🔔 Atualização do Pedido #${numeroPedido}*\n\n`;
        
        switch (status) {
            case STATUS_PEDIDO.CONFIRMADO:
                mensagem += '✅ Seu pedido foi confirmado e em breve entrará em preparo!';
                break;
            case STATUS_PEDIDO.PREPARANDO:
                mensagem += '👨‍🍳 Seu pedido está sendo preparado com muito carinho!';
                break;
            case STATUS_PEDIDO.SAIU_ENTREGA:
                mensagem += '🛵 Oba! Seu pedido saiu para entrega e logo chegará até você!';
                break;
            case STATUS_PEDIDO.ENTREGUE:
                mensagem += '🎉 Pedido entregue! Bom apetite!\n\nAgradecemos a preferência! Para fazer um novo pedido, digite *cardápio*.';
                break;
            case STATUS_PEDIDO.CANCELADO:
                mensagem += '❌ Seu pedido foi cancelado. Em caso de dúvidas, digite *atendente* para falar com nossa equipe.';
                break;
        }

        await whatsappClient.sendMessage(pedido.cliente_numero, mensagem);
    } catch (error) {
        console.error('Erro ao notificar cliente:', error);
    }
}

// Função para formatar o número no padrão correto
function formatarNumeroAdmin(numero) {
    // Remove qualquer formatação existente
    let numeroLimpo = numero.replace(/\D/g, '');
    
    // Se o número não começar com 55, adiciona
    if (!numeroLimpo.startsWith('55')) {
        numeroLimpo = '55' + numeroLimpo;
    }
    
    // Adiciona o sufixo @c.us
    return numeroLimpo + '@c.us';
}

module.exports = {
    processarComandoAdmin,
    enviarAjudaAdmin,
    NUMEROS_ADMIN,
    inicializarAdmin
}; 