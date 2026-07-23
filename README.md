# EasyAnkiCards (v7.9.1) · by MarlitosDev

**Use agora, sem instalar nada:** https://marlitosdev.github.io/easyankicards/

Transforma texto no formato `Frente :: Verso` em baralhos prontos para o Anki, em `.apkg` (dois cliques/um toque e importa sozinho) e `.txt`. Interface em **Português e English**. Funciona no navegador, no celular (instalável como app, offline) e no desktop. Código aberto sob licença MIT.

> EasyAnkiCards turns plain text into ready-to-import Anki decks (.apkg/.txt). PWA — runs in the browser, installable on Android/iPhone, works offline. UI in Portuguese and English. Try it: https://marlitosdev.github.io/easyankicards/

## Formato do texto

Um cartão por linha; linha em branco separa cartões; `#` comenta.

```
Pergunta :: Resposta :: tags
A capital da França é {{c1::Paris}}. :: Observação :: geografia
[MC] Qual a correta? :: op1 | op2 correta * | op3 :: explicação :: tags
```

Metadados por cartão, cada um em sua própria linha:

```
@ Título no topo do cartão      (linha ACIMA do cartão)
Pergunta :: Resposta :: tags
+ Explicação "Saiba mais" (3 a 15 linhas). O app também aceita "*".
```

O texto é a única fonte de verdade: tudo o que você edita na tela é reescrito no texto, e vice-versa.

## Recursos

**Entrada de texto inteligente**
- Tolerante a texto colado de PDF/Word/IA: recupera quebras de linha no meio do cartão (inclusive respostas quebradas em várias linhas que começam com pontuação), une pares `Pergunta?` / `Resposta` sem `::`, e aceita o título `@` e a explicação `+`/`*` antes ou depois do cartão.
- **Destaque de sintaxe** por trás do texto (grifos em `::`, lacunas e `[MC]`), com o texto real editável por cima — a seleção do mouse fica sempre alinhada. Interruptor "Destaque colorido" para desligar quando quiser.
- **Análise automática enquanto digita**: faixa de sugestões com atalho **"Ver no texto"** (foca e seleciona a linha do problema) e o botão **"Corrigir erros"**, que fica destacado quando há algo a corrigir e desativado quando não há — abre o diálogo de revisão com antes/depois antes de aplicar qualquer coisa.
- Botões de **Selecionar tudo**, **Copiar tudo** e **Apagar tudo**.

**Tipos de cartão**
- Básico, **Cloze** (`{{c1::resposta}}`, com marcação de lacuna por seleção).
- **Múltipla escolha em lista** (`[MC]`) — no `.apkg`, ao revelar a resposta somente a alternativa correta permanece.
- **Múltipla escolha na frase** (`{{c1::correta::opção / opção}}`) — as opções aparecem dentro da frase; recomendada só para alternativas curtas (o app avisa quando ficam longas demais).
- Criação guiada por modelos (P&R, definição, lacuna, lei seca, jurisprudência, múltipla escolha) com **pré-visualização em tempo real**, correta marcada por rádio ⦿ e botão de embaralhar.

**Conferência e edição**
- Pré-visualização em cartões, com modo **"Como no Anki"** que renderiza o estilo visual escolhido (frente e verso, com botão "Ver/Ocultar resposta").
- Ao digitar, o cartão correspondente **pisca** na lista.
- Edição inline em **campos coloridos** por tipo (Frente, Verso, Saiba mais, Título, Tags), que crescem conforme o texto, com os campos secundários recolhíveis.
- **Conversão de tipo** na edição (Básico ↔ Cloze ↔ Múltipla escolha), sempre explicando a mudança antes de aplicar.
- Edição estruturada de lacunas: um painel por `cN`, com resposta correta, comportamento (ocultação/múltipla escolha) e posição da alternativa.
- **Modo revisão**: vire os cartões como no Anki antes de exportar.

**Exportação**
- Nome do baralho e **título do topo** são definidos na hora de exportar; subpastas via `::`, com destino e demonstração do cabeçalho em tempo real.
- Quatro **estilos visuais** (Clássico, Esquematizado, Escuro, Papel), aplicados a todos os cartões do `.apkg`.
- Campos **"Saiba mais"** (link expansível no Anki) e **Título** presentes nos cartões gerados.
- `.apkg` gerado no próprio aparelho (SQLite/WebAssembly); no celular, abre a folha de compartilhamento → AnkiDroid importa direto. Reexportar o mesmo baralho atualiza, não duplica.
- `.txt` com coluna de deck (Anki 23.10+): a pasta é criada na importação.
- **Prompts prontos para IA** (completo e curto para Gemini Notebook), editáveis e salvos, com botão de copiar na tela principal.

**Aparência e conforto**
- Temas Auto / Claro / Escuro / Preto (alto contraste) e seletor de **cor da letra**.
- Dicas em todos os botões (hover no desktop, toque longo no celular).
- Avisos curtos de confirmação a cada ação.

**PWA e atualizações**
- Instalável e offline após a primeira visita (service worker "rede primeiro": o app sempre carrega a versão mais recente quando há internet).
- **Aviso de atualização inteligente**: só aparece quando há de fato uma versão nova (o app compara a versão em espera com a que está rodando), evitando avisos repetidos.

## Estrutura do projeto

```
easy-anki-cards/
├── docs/                  # PWA (web/celular) — servida pelo GitHub Pages
│   ├── index.html · app.js · parser.js · anki.js · i18n.js
│   └── manifest.webmanifest · sw.js · icon-192/512.png · .nojekyll
├── src/easyankicards/     # desktop (janela nativa que carrega docs/) + CLI
├── scripts/build_exe.bat  # gera release\EasyAnkiCards.exe
├── examples/exemplo.txt
├── iniciar_app.bat · requirements.txt · README.md · LICENSE · .gitignore
```

Cada módulo tem um cabeçalho "MAPA DO ARQUIVO" e "regras de ouro" de manutenção. Regra principal: o **texto do editor é a fonte única**; lógica de negócio em `parser.js`/`anki.js`; tela só em `app.js`; todos os textos visíveis em `i18n.js` (Português e English, com teste de paridade de chaves).

### Uma base de código para tudo

Desde a v6.4 o aplicativo de desktop é uma **janela nativa que carrega os mesmos arquivos de `docs/`** (via pywebview): mesma interface, mesmos recursos, tudo offline e local. Cada melhoria da versão web chega ao desktop automaticamente, sem reescrita. O `core.py`/`cli.py` em Python seguem disponíveis para automação por linha de comando.

## Como usar

- **Web/celular (recomendado)**: abra o link, cole o resultado do prompt de IA (ou digite) e exporte. No celular, use "Adicionar à tela inicial" para instalar.
- **Desktop**: `pip install -r requirements.txt` e dois cliques em `iniciar_app.bat`. Executável: `scripts\build_exe.bat` → `release\EasyAnkiCards.exe` (arquivo único, com a interface embutida, sem Python).
- **Linha de comando**: `python src/easyankicards/cli.py examples/exemplo.txt --deck "Meu Baralho"`.

## Publicação (GitHub Pages)

A pasta `docs/` é servida pelo GitHub Pages. Ao atualizar, suba os arquivos de `docs/` no repositório (mantendo o `.nojekyll`). Como o service worker guarda a versão anterior, na primeira vez após publicar pode ser preciso Ctrl+Shift+R (ou desregistrar o service worker em DevTools → Application) uma única vez; depois, o próprio app avisa das novidades.

## Licença

**MIT** — uso, cópia, modificação e distribuição livres, mantendo o aviso de copyright (veja `LICENSE`). Contribuições são bem-vindas via pull request.
