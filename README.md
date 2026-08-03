# EasyAnkiCards (v8.24.0) · by MarlitosDev

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

Metadados de cada cartão, em linhas próprias:

```
@ Título no topo do cartão      (linha ACIMA do cartão)
Pergunta :: Resposta :: tags
+ Explicação "Saiba mais" (3 a 15 linhas). O app também aceita "*".
```

O **texto é a única fonte de verdade**: o que você edita na tela é reescrito no texto, e vice-versa.

## Recursos

**Entrada de texto**
- Cole o resultado do prompt de IA ou digite. Botões **Selecionar tudo**, **Copiar tudo**, **Apagar tudo**, **Colar mais texto** (anexa ao final, rola e destaca a primeira linha nova) e **Desfazer última colagem**.
- **Auto-save**: o texto é salvo automaticamente no navegador e recuperado ao reabrir — recarregar/fechar não perde nada.
- **Numeração de linhas** ao lado do editor, com os números das linhas problemáticas em vermelho/laranja.
- **Destaque de sintaxe** (grifos em `::`, lacunas e `[MC]`) com o texto real editável por cima — seleção do mouse sempre alinhada; interruptor para desligar.
- Tolerante a texto colado de PDF/Word/IA: recupera quebras de linha no meio do cartão, une pares `Pergunta?` / `Resposta` sem `::`, aceita `@` e `+`/`*` antes ou depois do cartão e separa títulos grudados.
- **Análise automática** enquanto digita, com **"Ver no texto"** (foca a linha do problema) e o botão **"Corrigir erros"**, que só acende quando há algo a corrigir e abre revisão com antes/depois.
- **"Prompt de correção"**: quando o texto da IA vem torto de um jeito que o app não conserta sozinho (resposta quebrada em várias linhas, markdown, cartão sem `::`), gera um prompt com cada problema ancorado no número da linha + o trecho literal + as regras do formato. Cole na IA, traga a resposta de volta.
- **"Copiar diagnóstico"**: um clique copia versão, ambiente, o que a última correção fez (antes/depois) e o texto da tela — o suficiente para reproduzir um problema sem print nem explicação.

**Tipos de cartão**
- Básico, **Cloze** (`{{c1::resposta}}`, com marcação de lacuna por seleção), **múltipla escolha em lista** (`[MC]`) e **múltipla escolha na frase** (`{{c1::correta::opção / opção}}`, opções curtas).
- Criação guiada por modelos (P&R, definição, lacuna, lei seca, jurisprudência, múltipla escolha) com **pré-visualização em tempo real**, correta marcada por rádio ⦿ e embaralhar.

**Conferência e edição**
- Prévia sempre no estilo **"Como no Anki"**, com **múltiplas colunas** (opcional, telas largas), altura ajustável e botão "Ver/Ocultar resposta" por cartão.
- Título do cartão editável direto no cabeçalho da prévia (edição **cirúrgica**: mexe só naquele cartão, grava `@` acima e rola/destaca a linha alterada). Selo em cada cartão indicando se usa **título próprio**, o **título geral** ou nenhum.
- Edição inline em **campos coloridos** por tipo (frente, verso, saiba mais, título, tags), que crescem com o texto, com os secundários recolhíveis; **conversão de tipo** (básico ↔ cloze ↔ múltipla escolha) com confirmação.

**Revisão de conteúdo** (botão "Revisar cartões")
- Liga o modo de marcação: **caixa "marcar p/ revisão"** por cartão e botões de seleção automática — **Curtos, Sem resposta, Sem pergunta, Longos, Frente repetida** e **Com números/datas/artigos** (maior risco factual).
- Filtro **"Mostrar só os marcados"** para focar e editar no lugar (nada é movido nem apagado).
- Filtro **"Ocultar já revisados"**: some da tela o que já passou por uma rodada (selo verde), deixando visível só o que ainda falta conferir. A marca é por frente do cartão e fica salva no navegador, então sobrevive a edições e ao recarregar; **"Limpar 'já revisados'"** recomeça o ciclo.
- **"Copiar os marcados"** abre uma janela **editável** com o prompt + cartões, em duas versões: *Corrigir forma* (ChatGPT/Claude/Gemini) e *Verificar nas fontes* (Gemini Notebook, prompt curto). Os prompts pedem para **aprimorar os cartões existentes, sem criar novos**.
- **"Colar correção"** substitui os cartões marcados pela versão corrigida da IA (remove os antigos e insere os novos, sem duplicar), com confirmação e possibilidade de desfazer.

**Exportação**
- Nome do baralho e **título geral** definidos na hora de exportar (o geral também aparece no topo do painel direito); subpastas via `::` com destino em tempo real.
- Três **estilos visuais** (Esquematizado, Escuro, Papel) aplicados a todos os cartões do `.apkg`, com campos **"Saiba mais"** (link expansível) e **Título**.
- `.apkg` gerado no aparelho (SQLite/WebAssembly); no celular abre a folha de compartilhamento → AnkiDroid importa direto. Reexportar o mesmo baralho atualiza, não duplica.
- `.txt` com coluna de deck (Anki 23.10+): a pasta é criada na importação.
- **Prompts prontos para IA** (completo e curto para Gemini Notebook), editáveis e salvos.

**Aparência, conforto e confiabilidade**
- Temas Auto / Claro / Escuro / Preto (alto contraste) e seletor de **cor da letra**; controles do cabeçalho padronizados.
- **Diálogos animados** (sem os avisos nativos que travam a aba); confirmação antes de ações destrutivas.
- Dicas em todos os botões (hover no desktop, toque longo no celular) e avisos curtos após cada ação, dizendo o próximo passo.
- Instalável e offline (service worker "rede primeiro": sempre carrega a versão mais recente com internet). **Aviso de atualização inteligente**: só aparece quando há de fato uma versão nova.

## Estrutura do projeto

```
easy-anki-cards/
├── docs/                  # PWA (web/celular) — servida pelo GitHub Pages
│   ├── index.html · app.js · parser.js · anki.js · i18n.js
│   └── manifest.webmanifest · sw.js · icon-192/512.png · .nojekyll
├── src/easyankicards/     # desktop (janela nativa que carrega docs/) + CLI
├── scripts/build_exe.bat  # gera release\EasyAnkiCards.exe
├── tests/                 # casos reais + invariantes (node tests/rodar.js)
├── examples/exemplo.txt
├── iniciar_app.bat · requirements.txt · README.md · LICENSE · .gitignore
```

Cada módulo tem um cabeçalho "MAPA DO ARQUIVO" e "regras de ouro" de manutenção. Regra principal: **texto do editor é a fonte única**; lógica de negócio em `parser.js`/`anki.js`; tela só em `app.js`; textos visíveis em `i18n.js` (Português e English, com teste de paridade de chaves).

### Uma base de código para tudo

Desde a v6.4 o aplicativo de desktop é uma **janela nativa que carrega os mesmos arquivos de `docs/`** (via pywebview): mesma interface, mesmos recursos, offline e local. Cada melhoria da versão web chega ao desktop automaticamente. O `core.py`/`cli.py` em Python seguem para automação por linha de comando.

## Testes

```
node tests/rodar.js            roda tudo
node tests/rodar.js --gravar   congela os números atuais em esperado.json
```
(no Windows, dois cliques em `tests\rodar.bat`)

**Para adicionar um caso**: salve o texto problemático como `tests/casos/NN-nome.txt`. Só isso — as invariantes já passam a valer para ele; rode `--gravar` para congelar os números.

São dois tipos de teste. As **invariantes** valem para qualquer texto e pegam o bug que ninguém imaginou:

| | regra | veio do bug |
|---|---|---|
| I1 | ler um texto nunca quebra o app | — |
| I2 | nenhuma correção apaga cartões | v8.19 |
| I3 | nenhuma correção apaga o "Saiba mais" | v8.22 |
| I6 | nenhuma correção apaga etiquetas | v8.23 |
| I4 | corrigir 2x = corrigir 1x (idempotência) | v8.19 |
| I5 | ida e volta (texto → cartões → texto) não muda nada | — |

Rodam junto dois testes de interface, num DOM mínimo escrito à mão (sem dependência): `fumaca.js` verifica que o app carrega sem erro, e `tela.js` exercita o fluxo de revisão de conteúdo.

O **esperado.json** congela os números de cada caso conhecido e pega a regressão: o bug que já foi corrigido uma vez e voltou. As duas primeiras regras também rodam dentro do app, na rede de segurança que cancela qualquer correção que fosse perder conteúdo.

## Como usar

- **Web/celular (recomendado)**: abra o link, cole o resultado do prompt de IA (ou digite) e exporte. No celular, use "Adicionar à tela inicial" para instalar.
- **Desktop**: `pip install -r requirements.txt` e dois cliques em `iniciar_app.bat`. Executável: `scripts\build_exe.bat` → `release\EasyAnkiCards.exe`.
- **Linha de comando**: `python src/easyankicards/cli.py examples/exemplo.txt --deck "Meu Baralho"`.

## Publicação (GitHub Pages)

A pasta `docs/` é servida pelo GitHub Pages. Ao atualizar, suba os arquivos de `docs/` (mantendo o `.nojekyll`). Como o service worker guarda a versão anterior, na primeira vez após publicar pode ser preciso Ctrl+Shift+R (ou desregistrar o service worker em DevTools → Application) uma única vez; depois, o app avisa das novidades sozinho.

## Licença

**MIT** — uso, cópia, modificação e distribuição livres, mantendo o aviso de copyright (veja `LICENSE`). Contribuições são bem-vindas via pull request.
