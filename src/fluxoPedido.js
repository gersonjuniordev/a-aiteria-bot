const { cardapio } = require('./cardapio');
const { db } = require('./database');

class Pedido {
    constructor(clienteNumero) {
        this.clienteNumero = clienteNumero;
        this.nomeCliente = null;
        this.items = [];
        this.valorTotal = 0;
        this.formaPagamento = null;
        this.endereco = null;
        this.status = 'aguardando_nome';
        this.itemAtual = null;
    }

    adicionarItem(item) {
        this.items.push(item);
        this.calcularTotal();
    }

    calcularTotal() {
        this.valorTotal = this.items.reduce((total, item) => {
            let itemTotal = item.preco;
            if (item.adicionais) {
                itemTotal += item.adicionais.reduce((adicionalTotal, adicional) => 
                    adicionalTotal + adicional.preco, 0);
            }
            return total + itemTotal;
        }, 0);
    }
}

const pedidosEmAndamento = new Map();
const clientesConhecidos = new Map();
const ultimaMensagem = new Map();
const TEMPO_LIMITE = 4 * 60 * 60 * 1000; // Tempo limite de 4 horas para o bot enviar mensagem de boas vindas novamente para o mesmo cliente

async function gerenciarFluxo(message, novoFluxo = false, cancelar = false) {
    const clienteNumero = message.from;
    let pedido = pedidosEmAndamento.get(clienteNumero);

    if (cancelar) {
        if (pedido) {
            pedidosEmAndamento.delete(clienteNumero);
            await message.reply('Pedido cancelado. Digite *cardápio* para fazer um novo pedido.');
        }
        return;
    }

    if (novoFluxo || !pedido) {
        pedido = new Pedido(clienteNumero);
        pedidosEmAndamento.set(clienteNumero, pedido);
        
        const nomeConhecido = clientesConhecidos.get(clienteNumero);
        if (nomeConhecido) {
            pedido.nomeCliente = nomeConhecido;
            pedido.status = 'iniciado';
            const menu = `Olá novamente, ${nomeConhecido}! Seja bem-vindo(a) de volta à Açaiteria! 😊

*🍨 Cardápio:*

1. Açaí (Já incluso Leite Condensado, Granola, Leite em Pó e Banana)
2. Vitaminas (Já incluso Leite Condensado, Granola, Leite em Pó e Banana)
3. Bebidas
4. Lanches
5. Ver Carrinho

Digite o número da opção desejada:`;
            await message.reply(menu);
        } else {
            await message.reply('Por favor, digite seu nome para iniciarmos seu pedido:');
        }
        return;
    }

    try {
        const resposta = message.body.trim();

        if (resposta === '0') {
            await voltarEtapa(message, pedido);
            return;
        }

        switch (pedido.status) {
            case 'aguardando_nome':
                await processarNomeCliente(message, pedido);
                break;
            case 'iniciado':
                await processarEscolhaProduto(message, pedido);
                break;
            case 'escolhendo_tamanho':
                await processarEscolhaTamanho(message, pedido);
                break;
            case 'escolhendo_bebida':
                await processarEscolhaBebida(message, pedido);
                break;
            case 'escolhendo_lanche':
                await processarEscolhaLanche(message, pedido);
                break;
            case 'escolhendo_adicionais':
                await processarEscolhaAdicionais(message, pedido);
                break;
            case 'escolhendo_mais_itens':
                await processarEscolhaMaisItens(message, pedido);
                break;
            case 'informando_endereco':
                await processarEndereco(message, pedido);
                break;
            case 'escolhendo_pagamento':
                await processarFormaPagamento(message, pedido);
                break;
            case 'confirmando_adicionais':
                await processarConfirmacaoAdicionais(message, pedido);
                break;
            default:
                await enviarMenuPrincipal(message);
        }
    } catch (error) {
        console.error('Erro no fluxo:', error);
        await message.reply('Ops! Algo deu errado. Digite *cardápio* para recomeçar ou *ajuda* para ver as opções.');
        pedidosEmAndamento.delete(clienteNumero);
    }
}

async function enviarMenuPrincipal(message) {
    await message.reply('Por favor, digite seu nome para iniciarmos seu pedido:');
}

async function processarEscolhaProduto(message, pedido) {
    const opcao = message.body;

    switch (opcao) {
        case '1':
            pedido.itemAtual = { tipo: 'acai' };
            await enviarOpcoesTamanho(message, cardapio.acai);
            pedido.status = 'escolhendo_tamanho';
            break;
        case '2':
            pedido.itemAtual = { tipo: 'vitamina' };
            await enviarOpcoesTamanho(message, cardapio.vitaminas);
            pedido.status = 'escolhendo_tamanho';
            break;
        case '3':
            await enviarOpcoesBebidas(message);
            pedido.status = 'escolhendo_bebida';
            break;
        case '4':
            await enviarOpcoesLanches(message);
            pedido.status = 'escolhendo_lanche';
            break;
        case '5':
            if (pedido.items.length === 0) {
                await message.reply('Seu carrinho está vazio! Escolha alguns itens primeiro.');
            } else {
                await mostrarCarrinho(message, pedido);
                await enviarOpcoesContinuar(message);
                pedido.status = 'escolhendo_mais_itens';
            }
            break;
        default:
            await message.reply('❌ Opção inválida. Por favor, escolha uma opção de 1 a 5.');
            break;
    }
}

async function enviarOpcoesTamanho(message, opcoes) {
    let menu = '*Escolha o tamanho:*\n\n';
    Object.entries(opcoes).forEach(([tamanho, preco], index) => {
        if (tamanho === '2 Litros') {
            menu += `${index + 1}. ${tamanho} (Pote de Açaí Puro) - R$ ${preco.toFixed(2)}\n`;
        } else {
            menu += `${index + 1}. ${tamanho} - R$ ${preco.toFixed(2)}\n`;
        }
    });
    menu += '\n0. Voltar ao menu principal';
    await message.reply(menu);
}

async function processarEscolhaTamanho(message, pedido) {
    const resposta = message.body.trim();

    if (resposta === '0') {
        pedido.status = 'iniciado';
        await enviarMenuPrincipal(message);
        return;
    }

    const opcoes = pedido.itemAtual.tipo === 'acai' ? cardapio.acai : cardapio.vitaminas;
    const tamanhos = Object.entries(opcoes);
    const escolha = parseInt(resposta) - 1;

    if (escolha >= 0 && escolha < tamanhos.length) {
        const [tamanho, preco] = tamanhos[escolha];
        pedido.itemAtual.tamanho = tamanho;
        pedido.itemAtual.preco = preco;
        pedido.itemAtual.nome = `${pedido.itemAtual.tipo} ${tamanho}`;

        if (pedido.itemAtual.tipo === 'acai') {
            await message.reply(`*Deseja adicionar complementos ao seu açaí?*

1. Sim, quero adicionar complementos
2. Não, apenas o açaí tradicional

0. Voltar ao menu principal`);
            pedido.status = 'confirmando_adicionais';
        } else {
            pedido.adicionarItem(pedido.itemAtual);
            await message.reply(`✅ ${pedido.itemAtual.nome} adicionado ao carrinho!`);
            await mostrarCarrinho(message, pedido);
            await enviarOpcoesContinuar(message);
            pedido.status = 'escolhendo_mais_itens';
        }
    } else {
        await message.reply('❌ Opção inválida. Por favor, escolha um tamanho válido ou 0 para voltar.');
        await enviarOpcoesTamanho(message, opcoes);
    }
}

async function processarConfirmacaoAdicionais(message, pedido) {
    const resposta = message.body.trim();

    switch (resposta) {
        case '0':
            pedido.status = 'iniciado';
            await enviarMenuPrincipal(message);
            break;
        case '1':
            await enviarOpcoesAdicionais(message);
            pedido.status = 'escolhendo_adicionais';
            break;
        case '2':
            pedido.adicionarItem(pedido.itemAtual);
            await message.reply(`✅ ${pedido.itemAtual.nome} adicionado ao carrinho sem complementos!`);
            await mostrarCarrinho(message, pedido);
            await enviarOpcoesContinuar(message);
            pedido.status = 'escolhendo_mais_itens';
            break;
        default:
            await message.reply('❌ Opção inválida. Por favor, escolha 1 para adicionar complementos, 2 para não adicionar ou 0 para voltar.');
            break;
    }
}

async function processarEscolhaBebida(message, pedido) {
    const resposta = message.body.trim();

    if (resposta === '0') {
        pedido.status = 'iniciado';
        await enviarMenuPrincipal(message);
        return;
    }

    const bebidas = Object.entries(cardapio.bebidas);
    const escolha = parseInt(resposta) - 1;

    if (escolha >= 0 && escolha < bebidas.length) {
        const [nome, preco] = bebidas[escolha];
        pedido.itemAtual = {
            tipo: 'bebida',
            nome: nome,
            preco: preco
        };
        pedido.adicionarItem(pedido.itemAtual);
        await message.reply(`✅ ${nome} adicionado ao carrinho!`);
        await mostrarCarrinho(message, pedido);
        await enviarOpcoesContinuar(message);
        pedido.status = 'escolhendo_mais_itens';
    } else {
        await message.reply('❌ Opção inválida. Por favor, escolha uma bebida válida ou 0 para voltar.');
        await enviarOpcoesBebidas(message);
    }
}

async function processarEscolhaLanche(message, pedido) {
    const resposta = message.body.trim();

    if (resposta === '0') {
        pedido.status = 'iniciado';
        await enviarMenuPrincipal(message);
        return;
    }

    const lanches = Object.entries(cardapio.lanches);
    const escolha = parseInt(resposta) - 1;

    if (escolha >= 0 && escolha < lanches.length) {
        const [nome, preco] = lanches[escolha];
        pedido.itemAtual = {
            tipo: 'lanche',
            nome: nome,
            preco: preco
        };
        pedido.adicionarItem(pedido.itemAtual);
        await message.reply(`✅ ${nome} adicionado ao carrinho!`);
        await mostrarCarrinho(message, pedido);
        await enviarOpcoesContinuar(message);
        pedido.status = 'escolhendo_mais_itens';
    } else {
        await message.reply('❌ Opção inválida. Por favor, escolha um lanche válido ou 0 para voltar.');
        await enviarOpcoesLanches(message);
    }
}

async function enviarOpcoesAdicionais(message) {
    let menu = '*Escolha seus complementos adicionais:*\n\n';
    Object.entries(cardapio.adicionais).forEach(([nome, preco], index) => {
        menu += `${index + 1}. ${nome} - R$ ${preco.toFixed(2)}\n`;
    });
    menu += '\nDigite os números separados por vírgula (ex: 1,2,3) ou envie qualquer texto para não adicionar mais complementos.';
    await message.reply(menu);
}

async function processarEscolhaAdicionais(message, pedido) {
    const resposta = message.body.trim();
    
    // Se não for um número, considera que não quer mais adicionais
    if (!/^[\d,\s]+$/.test(resposta)) {
        pedido.adicionarItem(pedido.itemAtual);
        await message.reply(`✅ ${pedido.itemAtual.nome} adicionado ao carrinho!`);
        await mostrarCarrinho(message, pedido);
        await enviarOpcoesContinuar(message);
        pedido.status = 'escolhendo_mais_itens';
        return;
    }

    try {
        const escolhas = resposta.split(',').map(n => parseInt(n.trim()) - 1);
        const adicionais = Object.entries(cardapio.adicionais);
        pedido.itemAtual.adicionais = [];

        let adicionaisValidos = false;
        for (const escolha of escolhas) {
            if (escolha >= 0 && escolha < adicionais.length) {
                const [nome, preco] = adicionais[escolha];
                pedido.itemAtual.adicionais.push({ nome, preco });
                adicionaisValidos = true;
            }
        }

        if (!adicionaisValidos) {
            await message.reply('❌ Nenhum adicional válido selecionado. Por favor, escolha números válidos ou envie qualquer texto para não adicionar mais complementos.');
            await enviarOpcoesAdicionais(message);
            return;
        }

        pedido.adicionarItem(pedido.itemAtual);
        await message.reply(`✅ ${pedido.itemAtual.nome} com adicionais adicionado ao carrinho!`);
        await mostrarCarrinho(message, pedido);
        await enviarOpcoesContinuar(message);
        pedido.status = 'escolhendo_mais_itens';
    } catch (error) {
        await message.reply('❌ Formato inválido. Digite os números separados por vírgula (ex: 1,2,3) ou envie qualquer texto para não adicionar mais complementos.');
        await enviarOpcoesAdicionais(message);
    }
}

async function enviarOpcoesContinuar(message) {
    const menu = `*Deseja mais alguma coisa?*

1. Sim, continuar pedindo
2. Não, finalizar pedido
0. Voltar ao menu principal`;
    await message.reply(menu);
}

async function processarEscolhaMaisItens(message, pedido) {
    const resposta = message.body.trim();

    switch (resposta) {
        case '0':
            const menuPrincipal = `*🍨 Cardápio:*

1. Açaí (Já incluso Leite Condensado, Granola, Leite em Pó e Banana)
2. Vitaminas (Já incluso Leite Condensado, Granola, Leite em Pó e Banana)
3. Bebidas
4. Lanches
5. Ver Carrinho

Digite o número da opção desejada:`;
            await message.reply(menuPrincipal);
            pedido.status = 'iniciado';
            break;
        case '1':
            const menu = `*🍨 Cardápio:*

1. Açaí (Já incluso Leite Condensado, Granola, Leite em Pó e Banana)
2. Vitaminas (Já incluso Leite Condensado, Granola, Leite em Pó e Banana)
3. Bebidas
4. Lanches
5. Ver Carrinho

Digite o número da opção desejada:`;
            await message.reply(menu);
            pedido.status = 'iniciado';
            break;
        case '2':
            if (pedido.items.length === 0) {
                await message.reply('❌ Seu carrinho está vazio! Adicione alguns itens antes de finalizar.');
                const menuVazio = `*🍨 Cardápio:*

1. Açaí (Já incluso Leite Condensado, Granola, Leite em Pó e Banana)
2. Vitaminas (Já incluso Leite Condensado, Granola, Leite em Pó e Banana)
3. Bebidas
4. Lanches
5. Ver Carrinho

Digite o número da opção desejada:`;
                await message.reply(menuVazio);
                pedido.status = 'iniciado';
            } else {
                await message.reply(`${pedido.nomeCliente}, por favor, digite seu endereço completo para entrega:`);
                pedido.status = 'informando_endereco';
            }
            break;
        default:
            await message.reply('❌ Opção inválida. Por favor, escolha 0 para voltar, 1 para continuar ou 2 para finalizar.');
            await enviarOpcoesContinuar(message);
    }
}

async function processarEndereco(message, pedido) {
    const endereco = message.body.trim();
    
    if (endereco.length < 10) {
        await message.reply('❌ Por favor, forneça um endereço mais detalhado para garantir a entrega correta.');
        return;
    }

    pedido.endereco = endereco;
    await message.reply(`*Escolha a forma de pagamento:*

1. PIX
2. Dinheiro
3. Cartão de Crédito
4. Cartão de Débito`);
    pedido.status = 'escolhendo_pagamento';
}

async function processarFormaPagamento(message, pedido) {
    const opcoes = {
        '1': 'PIX',
        '2': 'Dinheiro',
        '3': 'Cartão de Crédito',
        '4': 'Cartão de Débito'
    };

    const escolha = message.body;

    if (opcoes[escolha]) {
        pedido.formaPagamento = opcoes[escolha];
        await finalizarPedido(message, pedido);
    } else {
        await message.reply('❌ Opção inválida. Por favor, escolha uma forma de pagamento válida (1 a 4).');
    }
}

async function mostrarCarrinho(message, pedido) {
    let resumo = '*🛒 Seu Carrinho:*\n\n';
    
    pedido.items.forEach((item, index) => {
        resumo += `${index + 1}. ${item.nome} - R$ ${item.preco.toFixed(2)}\n`;
        if (item.adicionais && item.adicionais.length > 0) {
            resumo += '*Adicionais:*\n';
            item.adicionais.forEach(adicional => {
                resumo += `   • ${adicional.nome} - R$ ${adicional.preco.toFixed(2)}\n`;
            });
        }
    });

    resumo += `\n*Total: R$ ${pedido.valorTotal.toFixed(2)}*`;
    await message.reply(resumo);
}

async function finalizarPedido(message, pedido) {
    const resumo = gerarResumoPedido(pedido);
    await message.reply(resumo);

    if (pedido.formaPagamento === 'PIX') {
        await message.reply(`*💰 Dados para pagamento PIX:*
        
*Chave PIX:* 31998537881
*Nome: Wellington Rodrigo Brasilino*
*Valor:* R$ ${pedido.valorTotal.toFixed(2)}

Por favor, envie o comprovante do PIX.`);
    }

    salvarPedido(pedido);
    pedidosEmAndamento.delete(message.from);

    await message.reply(`*✅ Pedido finalizado com sucesso!*

🕒 Seu pedido chegará em aproximadamente 30 minutos.
📱 Acompanhe o status do seu pedido digitando *status*.
🛵 Você receberá uma mensagem quando o entregador sair para entrega.

Para fazer um novo pedido, digite *cardápio*.`);
}

function gerarResumoPedido(pedido) {
    let resumo = '*📝 Resumo do Pedido:*\n\n';
    
    resumo += `*Cliente:* ${pedido.nomeCliente}\n\n`;
    
    pedido.items.forEach((item, index) => {
        resumo += `${index + 1}. ${item.nome} - R$ ${item.preco.toFixed(2)}\n`;
        if (item.adicionais && item.adicionais.length > 0) {
            resumo += '*Adicionais:*\n';
            item.adicionais.forEach(adicional => {
                resumo += `   • ${adicional.nome} - R$ ${adicional.preco.toFixed(2)}\n`;
            });
        }
    });

    resumo += `\n*Valor Total: R$ ${pedido.valorTotal.toFixed(2)}*`;
    resumo += `\n*Endereço de entrega:* ${pedido.endereco}`;
    resumo += `\n*Forma de pagamento:* ${pedido.formaPagamento}`;
    resumo += `\n\n*Pedido feito por:* ${pedido.nomeCliente}`;
    
    return resumo;
}

function salvarPedido(pedido) {
    const query = `
        INSERT INTO pedidos (
            cliente_numero,
            cliente_nome,
            items,
            valor_total,
            forma_pagamento,
            endereco,
            status
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    db.run(query, [
        pedido.clienteNumero,
        pedido.nomeCliente,
        JSON.stringify(pedido.items),
        pedido.valorTotal,
        pedido.formaPagamento,
        pedido.endereco,
        'pendente'
    ]);
}

async function enviarOpcoesBebidas(message) {
    let menu = '*Escolha sua bebida:*\n\n';
    Object.entries(cardapio.bebidas).forEach(([nome, preco], index) => {
        menu += `${index + 1}. ${nome} - R$ ${preco.toFixed(2)}\n`;
    });
    menu += '\n0. Voltar ao menu principal';
    await message.reply(menu);
}

async function enviarOpcoesLanches(message) {
    let menu = '*Escolha seu lanche:*\n\n';
    Object.entries(cardapio.lanches).forEach(([nome, preco], index) => {
        menu += `${index + 1}. ${nome} - R$ ${preco.toFixed(2)}\n`;
    });
    menu += '\n0. Voltar ao menu principal';
    await message.reply(menu);
}

async function voltarEtapa(message, pedido) {
    switch (pedido.status) {
        case 'aguardando_nome':
            await message.reply('Por favor, digite seu nome para iniciarmos seu pedido:');
            break;
        case 'iniciado':
            const menu = `*🍨 Cardápio:*

1. Açaí (Já incluso Leite Condensado, Granola, Leite em Pó e Banana)
2. Vitaminas (Já incluso Leite Condensado, Granola, Leite em Pó e Banana)
3. Bebidas
4. Lanches
5. Ver Carrinho

Digite o número da opção desejada:`;
            await message.reply(menu);
            break;
        case 'escolhendo_tamanho':
        case 'escolhendo_bebida':
        case 'escolhendo_lanche':
            const menuVoltar = `*🍨 Cardápio:*

1. Açaí (Já incluso Leite Condensado, Granola, Leite em Pó e Banana)
2. Vitaminas (Já incluso Leite Condensado, Granola, Leite em Pó e Banana)
3. Bebidas
4. Lanches
5. Ver Carrinho

Digite o número da opção desejada:`;
            await message.reply(menuVoltar);
            pedido.status = 'iniciado';
            break;
        case 'escolhendo_adicionais':
            pedido.status = 'escolhendo_tamanho';
            await enviarOpcoesTamanho(message, cardapio.acai);
            break;
        case 'escolhendo_mais_itens':
            const menuMaisItens = `*🍨 Cardápio:*

1. Açaí (Já incluso Leite Condensado, Granola, Leite em Pó e Banana)
2. Vitaminas (Já incluso Leite Condensado, Granola, Leite em Pó e Banana)
3. Bebidas
4. Lanches
5. Ver Carrinho

Digite o número da opção desejada:`;
            await message.reply(menuMaisItens);
            pedido.status = 'iniciado';
            break;
        case 'confirmando_adicionais':
            pedido.status = 'escolhendo_tamanho';
            await enviarOpcoesTamanho(message, cardapio.acai);
            break;
        default:
            if (pedido.nomeCliente) {
                const menuDefault = `*🍨 Cardápio:*

1. Açaí (Já incluso Leite Condensado, Granola, Leite em Pó e Banana)
2. Vitaminas (Já incluso Leite Condensado, Granola, Leite em Pó e Banana)
3. Bebidas
4. Lanches
5. Ver Carrinho

Digite o número da opção desejada:`;
                await message.reply(menuDefault);
                pedido.status = 'iniciado';
            } else {
                await message.reply('Por favor, digite seu nome para iniciarmos seu pedido:');
                pedido.status = 'aguardando_nome';
            }
    }
}

async function processarNomeCliente(message, pedido) {
    const nome = message.body.trim();
    
    if (nome.length < 3) {
        await message.reply('Por favor, digite seu nome completo.');
        return;
    }

    pedido.nomeCliente = nome;
    pedido.status = 'iniciado';
    
    clientesConhecidos.set(pedido.clienteNumero, nome);
    ultimaMensagem.set(pedido.clienteNumero, Date.now());
    
    const menu = `Olá, ${nome}! Seja bem-vindo(a) à Açaiteria! 😊

*🍨 Cardápio:*

1. Açaí 
(Já incluso Leite Condensado, Granola, Leite em Pó e Banana)
2. Vitaminas 
(Já incluso Leite Condensado, Granola, Leite em Pó e Banana)
3. Bebidas
4. Lanches
5. Ver Carrinho

Digite o número da opção desejada:`;

    await message.reply(menu);
}

async function mostrarCardapio(message) {
    const menu = `*🍨 Cardápio:*

1. Açaí 
(Já incluso Leite Condensado, Granola, Leite em Pó e Banana)
2. Vitaminas 
(Já incluso Leite Condensado, Granola, Leite em Pó e Banana)
3. Bebidas
4. Lanches
5. Ver Carrinho

Digite o número da opção desejada:`;
    await message.reply(menu);
}

module.exports = { 
    gerenciarFluxo,
    clientesConhecidos,
    ultimaMensagem,
    TEMPO_LIMITE
}; 