# EasyAnkiCards (v5.2.0) · by MarlitosDev

Transforma texto no formato `Frente :: Verso` em baralhos prontos para o Anki, em `.txt` e `.apkg` (dois cliques e importa sozinho). Interface em **Português e English** — seletor no canto superior direito; a preferência fica salva. Código aberto sob licença MIT.

> EasyAnkiCards turns plain text into ready-to-import Anki decks. UI in Portuguese and English. Desktop app + PWA (web/Android/iPhone).

## Estrutura do projeto

```
easy-anki-cards/
├── src/easyankicards/     # desktop (core.py, app.py, cli.py, i18n.py)
├── docs/                  # PWA (web/celular) — servida pelo GitHub Pages
│   ├── index.html · app.js · parser.js · anki.js · i18n.js
│   ├── manifest.webmanifest · sw.js · icon-192/512.png
├── scripts/build_exe.bat  # gera release\EasyAnkiCards.exe (build autolimpo)
├── examples/exemplo.txt
├── iniciar_app.bat        # dois cliques para rodar do código
├── requirements.txt · README.md · LICENSE · .gitignore
└── release/               # criada pelo build — contém só o .exe
```

## Versão web / celular (PWA) — v5.2

A pasta `docs/` é o EasyAnkiCards completo rodando no navegador, sem servidor: parser portado para JavaScript (paridade testada com a versão Python), geração de `.apkg` no próprio aparelho (sql.js/WebAssembly + JSZip, estrutura validada contra a genanki) e `.txt` com coluna de deck. No celular, exportar abre a folha de compartilhamento — toque em AnkiDroid e o baralho importa direto. Funciona offline após a primeira visita (service worker) e pode ser instalada pela opção "Adicionar à tela inicial". Publicação: GitHub Pages servindo a pasta `docs/` (grátis) — passo a passo abaixo.

### Publicando no GitHub Pages

1. Crie o repositório em github.com (ex.: `easyankicards`), público.
2. Envie todos os arquivos desta pasta para o repositório.
3. Em **Settings > Pages**: Source = *Deploy from a branch*; Branch = `main`, pasta `/docs`; Save.
4. Em 1-2 minutos o app estará em `https://SEU-USUARIO.github.io/easyankicards/`.
5. No celular, abra o link e use "Adicionar à tela inicial".

Regra de ouro: **lógica de negócio só em `core.py`**; `app.py` só cuida de tela; **todos os textos visíveis em `i18n.py`** (para adicionar um idioma, copie um dicionário e traduza — instruções no topo do arquivo).

## Como usar

- **Do código:** `pip install -r requirements.txt` e dois cliques em `iniciar_app.bat`.
- **CLI:** `python src/easyankicards/cli.py examples/exemplo.txt --deck "Meu Baralho" --lang pt`
- **Executável:** dois cliques em `scripts\build_exe.bat` → sobra apenas `release\EasyAnkiCards.exe` (arquivo único, sem Python). SmartScreen pode alertar por falta de assinatura digital — comportamento normal do PyInstaller.

## Como o Anki decide a pasta de destino (v5.1)

Conforme o [manual oficial do Anki](https://docs.ankiweb.net/importing/text-files.html), **o nome do arquivo nunca define o destino** — ele é só um rótulo:

- **.apkg**: o destino é o nome do baralho gravado *dentro* do pacote (campo Baralho do app). `A::B::C` cria a hierarquia de pastas na importação.
- **.txt**: o cabeçalho `#deck:` só pré-seleciona o baralho *se ele já existir*. Por isso o app usa **coluna de deck** (`#deck column`), que **cria a pasta automaticamente** caso não exista — a importação sempre cai no lugar certo.
- O nome `collection` é reservado pelo Anki (backup de coleção inteira); o app bloqueia esse nome ao salvar.

A interface mostra o destino em tempo real abaixo do campo Baralho e deixa claro que renomear o arquivo não muda a pasta.

## Recursos

- Parser tolerante a texto colado de PDF/Word/IA (recupera quebras de linha, reorganiza campos deslocados).
- Pré-visualização automática em cartões visuais: verde = ok, laranja = verificar (com motivo e linha); caixa "incluir" por cartão.
- Trava de exportação com resumo de problemas.
- Cloze ({{c1::...}}), tags por cartão + globais, subbaralhos via "::" com indicação do destino em tempo real e botão "Copiar caminho".
- Botão "Normalizar texto" e prompts prontos para IA (completo e curto para NotebookLM), nos 3 idiomas.
- `.txt` com cabeçalho pré-configurado (Anki 23.10+) e `.apkg` com IDs estáveis (reimportar atualiza, não duplica).

## Distribuição recomendada (GitHub)

1. Publique esta pasta como repositório (o `.gitignore` já exclui builds).
2. Gere o `.exe` e anexe em um **Release** com a tag da versão (ex.: `v5.0.0`).
3. Usuário final baixa só o `.exe`; contribuidor clona o código.

## Licença

**MIT** — uso, cópia, modificação e distribuição livres, mantendo o aviso de copyright (veja `LICENSE`).
