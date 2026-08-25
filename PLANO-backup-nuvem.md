# Plano — botão "Salvar backup na nuvem"

Documento de planejamento. Nada aqui foi implementado.

---

## 1. O obstáculo que decide o desenho

Um botão "salvar no Google Drive" que funciona com um clique precisa de
**credencial OAuth**, e a credencial pertence a quem publica o aplicativo. Como
o EasyAnkiCards é servido do seu GitHub Pages, a conta do Google Cloud teria de
ser **sua**: criar projeto, configurar tela de consentimento, gerar um Client ID
e restringi-lo ao domínio `marlitosdev.github.io`.

Isso é viável — e está desenhado na fase C3 abaixo — mas tem custos que
precisam estar na mesa antes:

- o app deixa de ser um punhado de arquivos estáticos e passa a ter uma
  credencial para manter;
- enquanto não for verificado pelo Google, aparece a tela *"o Google não
  verificou este app"*, e só contas adicionadas como testadoras conseguem
  passar (limite de 100);
- se a credencial expirar ou o projeto for desativado, o botão morre — e ele
  morre justamente no dia em que você precisa do backup.

Por isso o plano começa por um caminho que **não precisa de credencial nenhuma
e funciona com qualquer nuvem**, e trata o OAuth como conveniência posterior.

---

## 2. O tamanho do problema

| | |
|---|---|
| seu `localStorage` hoje | 245 KB |
| backup `.json` completo | ~320 KB |
| comprimido com `CompressionStream('gzip')` | ~57 KB |

Cabe folgado em qualquer API (Drive aceita 5 MB em upload simples, Graph 4 MB).
**Tamanho não é restrição aqui** — o que decide é atrito e manutenção.

---

## 3. C1 — "Salvar na nuvem" sem credencial (recomendado para começar)

Um botão só, que se adapta ao aparelho. É o caminho que funciona hoje, em
qualquer nuvem, sem cadastro.

### No celular: a folha de compartilhamento do sistema

```js
const arq = new File([json], "easyankicards-2026-08-16.json",
                     { type: "application/json" });
if (navigator.canShare && navigator.canShare({ files: [arq] })) {
  await navigator.share({ files: [arq], title: "Backup EasyAnkiCards" });
}
```

Abre a folha nativa do Android/iOS com **Drive, OneDrive, Dropbox, WhatsApp,
e-mail** — tudo que estiver instalado. Zero configuração, funciona com a nuvem
que a pessoa já usa. É o melhor caminho no celular e nem sequer é um paliativo.

### No computador: a pasta sincronizada

```js
const h = await showSaveFilePicker({
  suggestedName: "easyankicards-backup.json",
  types: [{ description: "Backup", accept: { "application/json": [".json"] } }],
});
const w = await h.createWritable();
await w.write(json);
await w.close();          /* grava em temporário e troca no close: atômico */
```

Você escolhe **uma vez** a pasta do Google Drive ou do OneDrive; o handle vai
para o IndexedDB e nas próximas vezes é um clique só, sem diálogo. O programa
de sincronização da nuvem faz o resto — e faz melhor do que eu faria.

**Isto já é sincronização**: a pasta do Drive no computador A é a mesma no
computador B.

### Onde não houver nada disso

Firefox e Safari não têm `showSaveFilePicker`. Cai no download comum, e o
usuário arrasta para a nuvem. O botão nunca some; muda de comportamento.

### O que aparece na tela

```
Backup                                     último: há 3 dias ✓
[ Salvar na nuvem ]  [ Baixar arquivo ]  [ Restaurar de arquivo ]
Conectado a: Google Drive/EasyAnkiCards        [trocar pasta]
```

---

## 4. C2 — Backup automático na pasta escolhida

Com o handle guardado, o passo seguinte é não depender de você lembrar:

- grava **ao fechar a aba** e a cada 30 minutos de uso, se algo mudou;
- mantém **as 7 últimas cópias** com data no nome
  (`backup-2026-08-16.json`), e apaga as mais antigas — backup único é backup
  que você sobrescreve com a versão corrompida;
- se a permissão da pasta tiver caducado, o botão fica amarelo pedindo um
  clique para reconectar, sem perder nada.

O que **não** fazer: gravar a cada tecla. A pasta do Drive sincroniza a cada
alteração, e trezentas gravações por hora viram trezentas versões subindo.

---

## 5. C3 — Conta conectada (Drive ou OneDrive), quando valer a pena

Se depois de usar o C1 você quiser mesmo o clique único no celular também, aí
vale o OAuth. Desenho:

### Google Drive

- Escopo **`drive.file`** e nada além: dá acesso **só aos arquivos que o
  próprio app criou**. Não vê o resto do seu Drive. Isso importa por dois
  motivos: é o mínimo necessário, e escopos maiores exigem verificação anual
  com revisão de segurança.
- Biblioteca: **Google Identity Services** (`accounts.google.com/gsi/client`),
  token client, sem servidor.
- Envio:

```
POST https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart
Authorization: Bearer <token>
```

  com um `appProperties: { app: "easyankicards" }` para achar o arquivo depois
  e sobrescrever em vez de duplicar.

### OneDrive

- **MSAL.js** + Microsoft Graph, escopo `Files.ReadWrite.AppFolder`.
- A pasta especial do app resolve organização e permissão de uma vez:

```
PUT https://graph.microsoft.com/v1.0/me/drive/special/approot:/backup.json:/content
```

### A credencial fica onde?

Duas opções, e a segunda é a que eu escolheria:

1. **Embutida no código.** Client ID é público por natureza e fica restrito à
   origem `marlitosdev.github.io`. Simples, mas amarra o app à sua conta e
   quebra para qualquer pessoa que copie o repositório.
2. **Colada pelo usuário em Ferramentas → Nuvem.** O app funciona sem ela; quem
   quiser o clique único cria o seu próprio Client ID e cola. Mais trabalhoso
   uma vez, mas o app continua sendo estático, sem dono e sem credencial para
   manter.

---

## 6. O que precisa existir antes: o formato do backup

Nada disso vale sem um `.json` completo e restaurável — é a fase F1 do plano
anterior, e continua sendo o pré-requisito de tudo:

```json
{
  "app": "EasyAnkiCards",
  "formato": "backup/1",
  "gerado": "2026-08-16T10:00:00Z",
  "versao_app": "8.63.1",
  "cartoes":   { "texto": "...", "bandeja": [], "revisados": {} },
  "planos":    [{ "id": "p1", "nome": "...", "texto": "...", "progresso": {} }],
  "diario":    [],
  "resumos":   {},
  "preferencias": {}
}
```

Regras que sustentam a restauração:

- **`formato` versionado**: campo desconhecido é ignorado, campo ausente ganha
  padrão. É o que permite restaurar hoje um backup de dezembro.
- **Restaurar avisa antes**, com os números dos dois lados: *"o backup tem 231
  tópicos e 145 cartões; o app tem 232 e 3. Substituir?"* — e guarda o estado
  atual no histórico antes de trocar.
- **Nunca restaura pela metade**: ou entra tudo, ou nada. Restauração parcial
  deixa o app num estado que nem o backup nem o app conheciam.

---

## 7. Segurança e privacidade, em três linhas

- O `drive.file` e o `approot` garantem que o app **não enxerga** o resto da sua
  nuvem — só o que ele mesmo criou.
- O token vive na memória da aba, nunca em `localStorage`: aba fechada, token
  perdido, e isso é o comportamento certo.
- Nada trafega por servidor meu ou de terceiros: o navegador fala direto com o
  Google ou a Microsoft.

---

## 8. Ordem

| fase | entrega | esforço | depende de |
|---|---|---|---|
| **F1** | backup `.json` completo: gerar e restaurar, com conferência | meio dia | — |
| **C1** | botão "Salvar na nuvem": share sheet no celular, pasta no PC | meio dia | F1 |
| **C2** | gravação automática na pasta + 7 cópias com data | 1 dia | C1 |
| **C3** | conta conectada (Drive/OneDrive) com Client ID do usuário | 2–3 dias | F1 |

**C1 entrega quase tudo que o C3 entregaria**, sem credencial, sem manutenção e
funcionando em qualquer nuvem. Eu faria C3 só se o C1 se mostrasse incômodo na
prática — e a suspeita é que não vai.

---

## 9. Testes

| | regra |
|---|---|
| C-A | backup gerado e restaurado devolve exatamente o mesmo estado, em todos os modos |
| C-B | backup de versão anterior restaura sem quebrar |
| C-C | gravação interrompida no meio não destrói a cópia anterior |
| C-D | com 7 cópias na pasta, a oitava apaga a mais antiga — e nunca a mais nova |
| C-E | sem `navigator.share` e sem `showSaveFilePicker`, o botão ainda baixa o arquivo |
| C-F | permissão de pasta caducada mostra "reconectar" em vez de falhar em silêncio |

C-C é a que impede o sistema de segurança de virar causa de perda.
