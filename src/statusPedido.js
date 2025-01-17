const { buscarPedidoAtivo, STATUS_PEDIDO } = require('./database');

async function verificarStatus(message) {
    try {
        const pedido = await buscarPedidoAtivo(message.from);
        
        if (!pedido) {
            await message.reply('Você não possui pedidos ativos no momento. Digite *cardápio* para fazer um novo pedido! 😊');
            return;
        }

        const statusMensagem = gerarMensagemStatus(pedido);
        await message.reply(statusMensagem);
    } catch (error) {
        console.error('Erro ao verificar status:', error);
        await message.reply('Desculpe, não foi possível verificar o status do seu pedido no momento. Tente novamente em alguns instantes.');
    }
}

function gerarMensagemStatus(pedido) {
    const items = JSON.parse(pedido.items);
    let mensagem = `*🛵 Status do Pedido #${pedido.id}*\n\n`;
    
    mensagem += `*Cliente:* ${pedido.cliente_nome}\n`;
    mensagem += `*Valor Total:* R$ ${pedido.valor_total.toFixed(2)}\n`;
    mensagem += `*Endereço:* ${pedido.endereco}\n`;
    mensagem += `*Forma de Pagamento:* ${pedido.forma_pagamento}\n\n`;
    
    mensagem += '*Itens do Pedido:*\n';
    items.forEach((item, index) => {
        mensagem += `${index + 1}. ${item.nome}\n`;
        if (item.adicionais && item.adicionais.length > 0) {
            mensagem += '   *Adicionais:*\n';
            item.adicionais.forEach(adicional => {
                mensagem += `   • ${adicional.nome}\n`;
            });
        }
    });

    mensagem += '\n*Status Atual:*\n';
    
    switch (pedido.status) {
        case STATUS_PEDIDO.PENDENTE:
            mensagem += '📝 Pedido realizado, aguardando confirmação';
            break;
        case STATUS_PEDIDO.CONFIRMADO:
            mensagem += '✅ Pedido confirmado, entrará em preparo em breve';
            break;
        case STATUS_PEDIDO.PREPARANDO:
            mensagem += '👨‍🍳 Seu pedido está sendo preparado';
            break;
        case STATUS_PEDIDO.SAIU_ENTREGA:
            mensagem += '🛵 Saiu para entrega! Em breve chegará até você';
            break;
        case STATUS_PEDIDO.ENTREGUE:
            mensagem += '🎉 Pedido entregue! Bom apetite!';
            break;
        case STATUS_PEDIDO.CANCELADO:
            mensagem += '❌ Pedido cancelado';
            break;
        default:
            mensagem += '🕒 Status em atualização';
    }

    mensagem += '\n\n*Atualizações:*\n';
    mensagem += '• Você receberá uma mensagem a cada mudança de status\n';
    mensagem += '• Digite *status* a qualquer momento para verificar novamente';

    return mensagem;
}

module.exports = { verificarStatus }; 