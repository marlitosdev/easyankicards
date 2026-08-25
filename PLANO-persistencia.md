# Plano — onde os dados moram

Documento de planejamento. Vale para o que já existe (flashcards) e para o que
vem (edital). Nada aqui foi implementado.

---

## 1. Sim, é um problema — e não era só impressão sua

Hoje **tudo** vive em `localStorage`, quinze chaves:

```
eac_texto        o texto dos cartões          ← horas de trabalho
eac_recortes     a bandeja                    ← horas de trabalho
eac_revisados    histórico de revisão
eac_registro     o registro de eventos
eac_deck  eac_titulo  eac_lang  eac_theme  eac_cor  eac_style
eac_alinha  eac_2col  eac_destaque  eac_gaveta  eac_maisCampos
```

As três primeiras são conteúdo seu. O resto é preferência, e perder é chato mas
não dói. O problema é que **as três primeiras estão guardadas do mesmo jeito que
a cor da letra** — num lugar que o navegador tem permissão para apagar sozinho.

### Por que some ao desligar o computador

Quatro causas possíveis, e vale identificar qual é a sua:

| causa | como confirmar |
|---|---|
| **Chrome configurado para limpar dados ao fechar** | `chrome://settings/content/siteData` — se "Excluir dados ao fechar todas as janelas" estiver ligado, é isso |
| **Despejo por pressão de armazenamento** | o navegador apaga sites "descartáveis" quando o disco aperta. O app **nunca pediu** para ser considerado permanente |
| **App de desktop com perfil temporário** | o `pywebview` abre a janela sem definir pasta de dados; dependendo do runtime, cada execução começa limpa |
| **Limpeza de disco / antivírus** | ferramentas de "otimização" varrem dados de site do WebView2 |

A segunda é a mais provável para PWA, e a terceira explica por que no desktop
some com mais frequência. As duas se resolvem, e a segunda com uma linha.

**Diagnóstico direto:** o botão "Copiar diagnóstico" passa a informar
`persistente: sim/não` e o espaço em uso — assim a dúvida vira dado.

---

## 2. Três camadas, da mais barata para a mais robusta

### Camada 1 — pedir permanência (1 linha, resolve o despejo)

```js
if (navigator.storage && navigator.storage.persist) {
  const ok = await navigator.storage.persist();   // pede "não me apague"
}
```

Concedido, o navegador para de considerar o app descartável sob pressão de
disco. Não protege de limpeza manual nem da configuração "limpar ao fechar", mas
tira da mesa a causa mais silenciosa. Chrome costuma conceder a PWAs instalados
sem nem perguntar.

**Custo: uma linha. Deveria já estar lá.**

### Camada 2 — salvar num arquivo de verdade (a solução real)

O Chrome no computador tem a **File System Access API**: o usuário escolhe uma
pasta **uma vez**, e o app passa a gravar arquivos ali a cada mudança.

```
📁 EasyAnkiCards/
   cartoes.txt        o texto do baralho atual
   bandeja.txt        os cartões recortados
   edital.txt         o edital com pesos
   progresso.json     o que já foi estudado
```

- A permissão da pasta fica guardada em IndexedDB e é reaproveitada nas próximas
  aberturas — sem escolher de novo toda vez.
- Se a pasta escolhida estiver no Drive/OneDrive/Dropbox, **a sincronização vem
  de graça**: o mesmo edital aparece no outro computador sem o app saber nada
  sobre nuvem.
- Arquivo `.txt` é legível fora do app. Se o EasyAnkiCards sumir amanhã, o seu
  trabalho continua aberto no Bloco de Notas.

Onde não houver a API (Firefox, Safari, celular), o app cai para a camada 3 sem
alarde — o botão muda de "Pasta conectada" para "Baixar backup".

### Camada 3 — backup manual, sempre disponível

- **Baixar backup** (`.json` com tudo: texto, bandeja, edital, progresso,
  preferências) e **Restaurar backup**.
- Um lembrete discreto: se passou de X dias sem backup e há mais de N cartões, o
  rodapé mostra "último backup há 9 dias".
- O `.json` é o formato de mudança de máquina e de navegador — o único caminho
  que funciona em qualquer lugar.

---

## 3. O desktop merece tratamento próprio

O aplicativo de desktop tem uma vantagem que o navegador não tem: **ele pode
escrever em disco sem pedir nada**. Duas mudanças em `src/easyankicards/app.py`:

1. **Fixar a pasta de dados do webview** para algo estável
   (`%APPDATA%/EasyAnkiCards`), em vez de aceitar o padrão. Isso sozinho acaba
   com o "some quando desligo".
2. **Expor gravação de arquivo na ponte `Api`** — o mesmo canal que já serve o
   MarkItDown. No desktop, salvar vira gravação direta em
   `Documentos/EasyAnkiCards/`, sem File System Access API, sem permissão.

O desktop passa a ser a versão **mais** segura, não a menos.

---

## 4. Exportar para outra plataforma no final? Sim — e essa é a resposta certa

**O app não deve ser o arquivo definitivo do seu estudo.** Ele é a bancada onde
o material é preparado. Bancada é lugar de trabalhar, não de guardar.

### Flashcards → Anki → AnkiWeb

O `.apkg` já é o artefato durável, e o Anki tem sincronização gratuita:

1. Exporte o `.apkg` e importe no Anki do computador.
2. No Anki, entre com uma conta AnkiWeb e sincronize.
3. A partir daí seus cartões estão em três lugares: computador, celular e
   servidor — e com o histórico de repetição junto, que é o que realmente não
   dá para refazer.

Reexportar o mesmo baralho **atualiza** em vez de duplicar, então dá para
continuar editando no EasyAnkiCards e reimportar quantas vezes quiser.

O texto-fonte é a outra metade: guarde o `.txt` junto do `.apkg`. O `.apkg` você
estuda; o `.txt` você edita.

### Edital → planilha ou caderno digital

| destino | formato | para quê |
|---|---|---|
| Google Sheets / Excel | `.csv` | filtrar, somar horas, compartilhar com o grupo de estudo |
| Notion / Obsidian | `.md` | vincular o edital às suas anotações de conteúdo |
| Papel | `.txt` | quem estuda com plano impresso na parede |

O `.csv` é o mais recomendado: qualquer planilha abre, sincroniza sozinha e você
consegue marcar progresso nela se quiser abandonar o app.

### A regra que sustenta tudo isso

**Todo modo precisa de uma exportação sem perda.** Se um dia o app parar de
funcionar, o usuário sai com o material inteiro num formato aberto. Isso já vale
para os cartões (`.txt` e `.apkg`) e passa a valer para o edital (`.txt` e
`.csv`).

O corolário: nenhuma informação pode existir **só** dentro do app. Progresso de
estudo, pesos, bandeja — tudo tem de caber no arquivo exportado, senão a
exportação é uma meia-verdade.

---

## 5. Ordem de implementação

| fase | entrega | esforço |
|---|---|---|
| **P1** | `navigator.storage.persist()` + `persistente: sim/não` no diagnóstico | 1 hora |
| **P2** | Baixar / Restaurar backup `.json` com tudo | meio dia |
| **P3** | Aviso de "último backup há N dias" | 1 hora |
| **P4** | Pasta conectada (File System Access) com gravação automática | 1–2 dias |
| **P5** | Desktop: pasta de dados fixa + gravação direta em disco | meio dia |

**P1 e P2 antes de qualquer coisa do edital.** Construir um modo novo que
acumula horas de trabalho por cima de um armazenamento que some é somar
prejuízo.

---

## 6. O que fazer hoje, antes de existir código

1. Abra `chrome://settings/content/siteData` e confira se a limpeza ao fechar
   está desligada para o site.
2. Depois de uma sessão de trabalho, use **Copiar tudo** e cole num arquivo
   `.txt` seu. É feio, mas é backup.
3. Exporte o `.apkg` e importe no Anki **no mesmo dia** — não deixe o baralho
   existir só dentro do navegador.

---

## 7. Testes

| | regra |
|---|---|
| P-A | backup exportado e restaurado devolve **exatamente** o mesmo estado (texto, bandeja, progresso, preferências) |
| P-B | restaurar backup de uma versão anterior não quebra o app — campos desconhecidos são ignorados, campos ausentes ganham padrão |
| P-C | escrever na pasta conectada nunca apaga o arquivo se a gravação falhar no meio (grava em temporário e renomeia) |

P-A é ida e volta, o mesmo tipo de invariante que já sustenta o texto dos
cartões. P-C é a que evita a pior falha possível: perder o arquivo bom ao tentar
salvar o novo.
