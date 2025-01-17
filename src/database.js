const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('acaiteria.db');

// Adicionar constantes de status
const STATUS_PEDIDO = {
    PENDENTE: 'pendente',
    CONFIRMADO: 'confirmado',
    PREPARANDO: 'preparando',
    SAIU_ENTREGA: 'saiu_para_entrega',
    ENTREGUE: 'entregue',
    CANCELADO: 'cancelado'
};

function inicializarDB() {
    db.serialize(() => {
        // Tabela de pedidos
        db.run(`CREATE TABLE IF NOT EXISTS pedidos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            cliente_numero TEXT,
            cliente_nome TEXT,
            items TEXT,
            valor_total REAL,
            forma_pagamento TEXT,
            endereco TEXT,
            status TEXT,
            data DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // Tabela para clientes conhecidos
        db.run(`CREATE TABLE IF NOT EXISTS clientes (
            numero TEXT PRIMARY KEY,
            nome TEXT,
            ultimo_acesso INTEGER,
            ultimo_pedido DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);
    });
}

function salvarCliente(numero, nome) {
    const query = `
        INSERT OR REPLACE INTO clientes (numero, nome, ultimo_acesso)
        VALUES (?, ?, ?)
    `;
    db.run(query, [numero, nome, Date.now()]);
}

function atualizarUltimoAcesso(numero) {
    const query = `
        UPDATE clientes 
        SET ultimo_acesso = ? 
        WHERE numero = ?
    `;
    db.run(query, [Date.now(), numero]);
}

function carregarClientesConhecidos(clientesMap, ultimaMensagemMap) {
    return new Promise((resolve, reject) => {
        db.all('SELECT numero, nome, ultimo_acesso FROM clientes', [], (err, rows) => {
            if (err) {
                reject(err);
                return;
            }
            rows.forEach(row => {
                clientesMap.set(row.numero, row.nome);
                if (row.ultimo_acesso) {
                    ultimaMensagemMap.set(row.numero, parseInt(row.ultimo_acesso));
                }
            });
            resolve();
        });
    });
}

function buscarPedidoAtivo(clienteNumero) {
    return new Promise((resolve, reject) => {
        const query = `
            SELECT * FROM pedidos 
            WHERE cliente_numero = ? 
            AND status NOT IN ('entregue', 'cancelado')
            ORDER BY id DESC LIMIT 1
        `;
        
        db.get(query, [clienteNumero], (err, row) => {
            if (err) {
                reject(err);
                return;
            }
            resolve(row);
        });
    });
}

function atualizarStatusPedido(pedidoId, novoStatus) {
    const query = `
        UPDATE pedidos 
        SET status = ? 
        WHERE id = ?
    `;
    return db.run(query, [novoStatus, pedidoId]);
}

function buscarPedidosAtivos() {
    return new Promise((resolve, reject) => {
        const query = `
            SELECT * FROM pedidos 
            WHERE status NOT IN ('entregue', 'cancelado')
            ORDER BY id DESC
        `;
        
        db.all(query, [], (err, rows) => {
            if (err) {
                reject(err);
                return;
            }
            resolve(rows);
        });
    });
}

module.exports = { 
    db, 
    inicializarDB,
    salvarCliente,
    atualizarUltimoAcesso,
    carregarClientesConhecidos,
    buscarPedidoAtivo,
    atualizarStatusPedido,
    STATUS_PEDIDO,
    buscarPedidosAtivos,
}; 