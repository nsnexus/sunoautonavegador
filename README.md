# Suno Auto Navegador 🎵🤖

Automação local em **Node.js** para criação de músicas no [Suno](https://suno.com) utilizando a sua própria conta ativa em uma janela do navegador Google Chrome via **Chrome DevTools Protocol (CDP)**.

---

## 💡 Como Funciona

1. **Sessão Real Humana:** Você abre o Chrome usando o script `iniciar-chrome.bat` (que inicia o navegador com `--remote-debugging-port=9222` e um perfil dedicado salvo em `%LOCALAPPDATA%\ChromeSunoBot`).
2. **Login Persistente:** Você faz login uma única vez no Suno. Esse login fica salvo para sempre nesse perfil.
3. **Automação Segura:** O bot Node.js se conecta à porta 9222 da sua janela aberta. Como o navegador já está autenticado e com os cookies válidos, **o Cloudflare/Turnstile não bloqueia**, permitindo gerar músicas automaticamente.
4. **Captura dos Links:** O bot preenche a letra, estilo e título, clica em *Create*, aguarda as faixas terminarem de processar e captura os **links de compartilhamento** (`https://suno.com/song/<id>`) e os **links diretos do áudio** (`https://cdn1.suno.ai/<id>.mp3`).

---

## 🚀 Instalação e Configuração

### 1. Instalar as dependências
No terminal, entre na pasta do projeto e instale os pacotes:

```bash
npm install
```

### 2. Configurar o arquivo `.env`
Copie o arquivo de exemplo:

```bash
copy .env.example .env
```

Abra o arquivo `.env` e configure suas credenciais do Supabase (as mesmas que você já usa no NSMusic):

```env
CHROME_DEBUG_PORT=9222
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_SERVICE_ROLE_KEY=sua-service-role-key-aqui
POLL_INTERVAL_MS=5000
```

---

## 🎯 Como Usar

### Passo 1: Iniciar o Chrome
Dê um duplo clique no arquivo:
👉 **`iniciar-chrome.bat`**

Uma janela do Chrome se abrirá já acessando `https://suno.com/create`.
> **Importante:** Se for a primeira vez, faça o login na sua conta do Suno nessa janela.

---

### Passo 2: Executar um Teste Manual

#### Opção A: Gerar uma música a partir de um Pedido do Supabase
Basta passar o ID ou OrderNumber do pedido:
```bash
node src/index.js --order=NS-12345
```
*(O bot lerá a letra, o estilo e o homenageado cadastrados no pedido, preencherá o Suno, aguardará a geração e salvará os links de volta no pedido).*

#### Opção B: Gerar uma música avulsa direto pela linha de comando
```bash
node src/index.js --title="Minha Homenagem" --style="Sertanejo Acústico" --lyrics="[Verso]\nEssa é uma história especial...\n[Refrão]\nVocê é muito importante..."
```

---

### Passo 3: Modo Worker / Monitoramento Automático (Opcional)
Se quiser que o robô fique monitorando o banco de dados e gerando músicas conforme forem solicitadas:

```bash
npm start
# ou: node src/index.js --watch
```

Ele consultará o Supabase a cada 5 segundos buscando pedidos que estejam aguardando geração local.

---

## 🔒 Segurança e Isolamento

- Este projeto opera de forma **100% independente** da produção do NSMusic.
- A API da **Kie.ai permanece intacta** no sistema principal como fallback.
- Somente pedidos especificamente acionados serão gerados por esta automação local durante a fase de testes.
