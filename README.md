# EasyAnkiCards (v6.4.0) · by MarlitosDev

**Use agora, sem instalar nada:** https://marlitosdev.github.io/easyankicards/

Transforma texto no formato `Frente :: Verso` em baralhos prontos para o Anki, em `.apkg` (dois cliques/um toque e importa sozinho) e `.txt`. Interface em **Português e English**. Funciona no navegador, no celular (instalável como app, offline) e no desktop. Código aberto sob licença MIT.

> EasyAnkiCards turns plain text into ready-to-import Anki decks (.apkg/.txt). PWA — runs in the browser, installable on Android/iPhone, works offline. UI in Portuguese and English. Try it: https://marlitosdev.github.io/easyankicards/

## Recursos (v6.0)

**Entrada de texto inteligente**
- Um cartão por linha (`Pergunta :: Resposta :: tags`); linha em branco separa cartões; `#` comenta.
- Tolerante a texto colado de PDF/Word/IA: recupera quebras de linha no meio do cartão e reorganiza campos deslocados.
- Pares `Pergunta?` / `Resposta` em linhas alternadas são **juntados automaticamente** (nota azul para conferência).
- **Destaque de sintaxe em tempo real**: `::` laranja, lacunas azuis, `[MC]` roxo, comentários cinza; linhas com problema ganham fundo vermelho (ignoradas) ou laranja (verificar).
- **Análise automática enquanto digita**: faixa de sugestões com críticas (cartões longos, frentes duplicadas, marcadores de lista) e correções de um toque.

**Tipos de cartão**
- Básico (frente/verso), **Cloze** (`{{c1::resposta}}`, com marcação de lacuna por seleção de texto).
- **Múltipla escolha em lista** (`[MC] Pergunta? :: op | op correta * | op :: explicação :: tags`) — no `.apkg`, modelo próprio em que, ao revelar a resposta, **somente a alternativa correta permanece**.
- **Múltipla escolha na frase** (sintaxe nativa `{{c1::correta::opção/opção}}`) — as opções aparecem dentro da frase na frente do cartão.
- Criação guiada por modelos (P&R, definição, lacuna, lei seca, jurisprudência, múltipla escolha) com **pré-visualização em tempo real**, correta marcada por rádio ⦿, botão de embaralhar e sugestão de embaralhar ao finalizar.

**Conferência e edição**
- Pré-visualização em cartões coloridos (verde ok / laranja verificar), com chips rotulados **OCULTO:** e **ALTERNATIVAS:** nos trechos especiais.
- Ao digitar, o cartão correspondente **pisca em azul** na lista, mostrando o resultado da alteração.
- Edição inline com **um painel por lacuna**: resposta correta editável e comportamento por lacuna (ocultação simples × múltipla escolha).
- **Modo revisão**: vire os cartões como no Anki antes de exportar (alternativas visíveis antes do flip).
- Caixa "incluir" por cartão; trava de exportação com resumo de problemas.

**Exportação e integração**
- Nome do baralho e tags globais são pedidos **na hora de exportar** (e lembrados). Subpastas via `::` com destino exibido em tempo real — o nome do arquivo não influencia o destino.
- `.apkg` gerado no próprio aparelho (SQLite/WebAssembly); no celular, abre a folha de compartilhamento → AnkiDroid importa direto. Reexportar o mesmo baralho **atualiza** em vez de duplicar.
- `.txt` com cabeçalho e **coluna de deck** (Anki 23.10+): a pasta é criada automaticamente na importação.
- **Prompts prontos para IA** (completo e curto para Gemini Notebook), incluindo o formato de múltipla escolha, com botão de copiar na tela principal.
- Dicas de funcionamento em todos os botões (hover no desktop, toque longo no celular).

## Estrutura do projeto

```
easy-anki-cards/
├── docs/                  # PWA (web/celular) v6.0 — servida pelo GitHub Pages
│   ├── index.html · app.js · parser.js · anki.js · i18n.js
│   └── manifest.webmanifest · sw.js · icon-192/512.png
├── src/easyankicards/     # desktop (janela nativa que carrega docs/) + CLI
├── scripts/build_exe.bat  # gera release\EasyAnkiCards.exe (build autolimpo)
├── examples/exemplo.txt
├── iniciar_app.bat        # dois cliques para rodar o desktop do código
└── requirements.txt · README.md · LICENSE · .gitignore
```

Regra de manutenção: lógica de negócio em `parser.js`/`anki.js` (e `core.py` no desktop); textos visíveis em `i18n.js`/`i18n.py`; interface só em `app.js`/`app.py`.

## Como usar

- **Web/celular (recomendado)**: abra o link, cole o texto e exporte. No celular, use "Adicionar à tela inicial" para instalar; funciona offline após a primeira visita.
- **Desktop (Windows/Linux/macOS)**: `pip install -r requirements.txt` e dois cliques em `iniciar_app.bat`. Executável: `scripts\build_exe.bat` → `release\EasyAnkiCards.exe` (arquivo único, com a interface embutida, sem precisar de Python).
- **Linha de comando**: `python src/easyankicards/cli.py examples/exemplo.txt --deck "Meu Baralho"`.

### Uma base de código para tudo

Até a v5.2 o desktop tinha interface própria em Python/CustomTkinter e a web outra em JavaScript — manter as duas em paralelo fez o desktop ficar para trás. Desde a v6.4, o aplicativo de desktop é uma **janela nativa que carrega os mesmos arquivos de `docs/`** (via pywebview): mesma interface, mesmos recursos, tudo offline e local. Cada melhoria da versão web chega ao desktop automaticamente, sem reescrita. O `core.py`/`cli.py` em Python seguem disponíveis para automação por linha de comando.

## Licença

**MIT** — uso, cópia, modificação e distribuição livres, mantendo o aviso de copyright (veja `LICENSE`). Contribuições são bem-vindas via pull request.
