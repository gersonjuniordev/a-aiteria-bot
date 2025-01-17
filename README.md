AÇAITERIA BOT - Sistema de Atendimento via WhatsApp
==================================================

DESCRIÇÃO
---------
Bot automatizado para atendimento de pedidos de açaí via WhatsApp. O sistema permite que clientes façam pedidos, acompanhem status e recebam atualizações automáticas.

FUNCIONALIDADES PRINCIPAIS
-------------------------
- Cardápio digital interativo
- Sistema de carrinho de compras
- Acompanhamento de status do pedido
- Notificações automáticas
- Painel administrativo para gerenciamento de pedidos
- Integração com banco de dados SQLite
- Sistema de clientes conhecidos

REQUISITOS DO SISTEMA
--------------------
- Node.js 14.0 ou superior
- NPM (Node Package Manager)
- WhatsApp instalado no celular para primeira autenticação
- Sistema operacional: Windows, Linux ou MacOS

DEPENDÊNCIAS
-----------
- whatsapp-web.js: ^1.22.1
- qrcode-terminal: ^0.12.0 
- sqlite3: ^5.1.6

INSTALAÇÃO
----------
1. Clone o repositório:
   git clone https://github.com/gersonjuniordev/acaiteria-bot.git

2. Entre na pasta do projeto:
   cd acaiteria-bot

3. Instale as dependências:
   npm install

4. Execute o bot:
   node src/index.js

PRIMEIRA EXECUÇÃO
----------------
1. Ao executar pela primeira vez, será gerado um QR Code no terminal
2. Abra o WhatsApp no seu celular
3. Acesse Configurações > WhatsApp Web/Desktop
4. Escaneie o QR Code
5. Aguarde a autenticação

COMANDOS DO CLIENTE
------------------
- cardápio: Exibe o menu principal
- status: Verifica status do pedido atual
- cancelar: Cancela o pedido em andamento
- ajuda: Exibe comandos disponíveis
- atendente: Solicita atendimento humano

COMANDOS ADMINISTRATIVOS
-----------------------
- /confirmar [número]: Confirma pedido
- /preparando [número]: Marca pedido como em preparo
- /saiuentrega [número]: Marca como saiu para entrega
- /entregue [número]: Finaliza pedido como entregue
- /cancelar [número]: Cancela pedido
- /pedidos: Lista todos pedidos ativos

ESTRUTURA DE ARQUIVOS
--------------------
src/
  ├── index.js           # Arquivo principal
  ├── adminComandos.js   # Comandos administrativos
  ├── cardapio.js        # Configuração do cardápio
  ├── database.js        # Conexão com banco de dados
  ├── fluxoPedido.js     # Fluxo do pedido
  └── statusPedido.js    # Gerenciamento de status

CONFIGURAÇÃO
-----------
1. Edite src/adminComandos.js para configurar números de administradores
2. Ajuste o cardápio em src/cardapio.js
3. Configure mensagens em src/fluxoPedido.js

BANCO DE DADOS
-------------
- O sistema utiliza SQLite3
- Banco criado automaticamente como acaiteria.db
- Tabelas:
  * pedidos: Armazena pedidos
  * clientes: Armazena clientes conhecidos

SEGURANÇA
---------
- Apenas números autorizados podem usar comandos administrativos
- Autenticação via QR Code do WhatsApp
- Dados armazenados localmente

SUPORTE
-------
Para suporte ou dúvidas:
- Abra uma issue no GitHub
- Entre em contato via WhatsApp: (XX) XXXX-XXXX

CONTRIBUIÇÃO
-----------
1. Faça um Fork do projeto
2. Crie uma branch para sua feature
3. Commit suas mudanças
4. Push para a branch
5. Abra um Pull Request

AUTOR
-----
[Gerson Junior]
[gersonjuniordev@gmail.com]
[+55 31 9 7246-6905]

NOTAS
-----
- Mantenha o WhatsApp conectado para funcionamento do bot
- Faça backup regular do banco de dados
- Monitore uso de recursos do servidor
- Atualize dependências regularmente

VERSÃO
------
1.0.0 - Janeiro 2024 