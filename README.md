# EasyAnkiCards (v8.66.0) · by MarlitosDev

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
- **Destaque de sintaxe** com **legenda** embaixo do editor. Pinta a estrutura, não o conteúdo: só os marcadores da lacuna (`{{c1::` e `}}`) levam fundo, e o texto dentro leva um sublinhado fino — antes a lacuna inteira ficava colorida e metade da tela virava mancha. Grifos em `::`, lacunas e `[MC]` com o texto real editável por cima — seleção do mouse sempre alinhada; interruptor para desligar.
- Tolerante a texto colado de PDF/Word/IA: recupera quebras de linha no meio do cartão, une pares `Pergunta?` / `Resposta` sem `::`, aceita `@` e `+`/`*` antes ou depois do cartão e separa títulos grudados.
- **Análise automática** enquanto digita. **"Ver no texto"** abre o cartão em um painel ao lado do editor, com o **trecho errado grifado** (o marcador de lista, o `**negrito**`, a lacuna repetida, o 3º campo que virou frase), botão para editar e aplicar ali mesmo, e setas para percorrer todos os problemas. Frentes repetidas abrem em **modo grupo**: os cartões iguais lado a lado, com Recortar e Excluir em cada um, para comparar as explicações e escolher qual fica e o botão **"Corrigir erros"**, que só acende quando há algo a corrigir e abre revisão com antes/depois.
- **"Prompt de correção"**, em duas formas: **só os trechos com erro** (padrão) ou o **texto inteiro**. No modo parcial, cada trecho vai marcado com uma âncora `@@ N` e leva junto o cartão dono e o título — a IA devolve os mesmos trechos com as mesmas âncoras e o botão **"Colar correção da IA"** troca só aqueles blocos, sem encostar no resto do baralho.
- **Eco do prompt**: se a IA devolver junto a própria instrução ("Responda SOMENTE com..."), ela é reconhecida e descartada antes de virar cartão — e o app detecta e remove esse texto se ele já estiver no baralho.
- **Cobertura de conteúdo**: ao colar, o app compara os termos do trecho original com os do trecho devolvido e avisa quando a IA "melhorou" resumindo ("voltou com apenas 41% do conteúdo original. Sumiram: …"). Contagem de cartões não pega isso. Um link mostra quais termos não voltaram, mesmo quando a cobertura está boa — quem sabe se o termo importava é você.
- O aviso de cartão longo **escala com o tamanho**: um cartão de 2.000 caracteres pede ~10 cartões, não dois de 1.000.
- A colagem é **conferida antes de aplicar**: âncora ausente, âncora inventada, trecho vazio, trecho que não forma cartão e trecho que voltou com menos cartões são recusados um a um, com aviso. Dividir um cartão longo em dois é permitido (era o pedido) e a confirmação mostra o saldo antes/depois.
- No rodapé, discretos, dois recursos para relatar problemas: **"Diagnóstico"** (versão, ambiente, o que a última correção fez, o texto da tela) e **"Registro"** (as últimas 200 ações, os erros de JavaScript). Ficam só no navegador do usuário; nada é enviado a lugar nenhum.

**Tipos de cartão**
- Básico, **Cloze** (`{{c1::resposta}}`, com marcação de lacuna por seleção), **múltipla escolha em lista** (`[MC]`) e **múltipla escolha na frase** (`{{c1::correta::opção / opção}}`, opções curtas).
- Criação guiada por modelos (P&R, definição, lacuna, lei seca, jurisprudência, múltipla escolha) com **pré-visualização em tempo real**, correta marcada por rádio ⦿ e embaralhar.

**Conferência e edição**
- Bloco muito longo (acima de 600 caracteres) é **cortado na prévia**, com véu no rodapé e botão "Mostrar tudo" — um cartão importado com um artigo inteiro deixa de ocupar a área toda. O corte é só visual: texto e `.apkg` seguem completos.
- Prévia sempre no estilo **"Como no Anki"**, com **múltiplas colunas** (opcional, telas largas), altura ajustável e botão "Ver/Ocultar resposta" por cartão.
- Título do cartão editável direto no cabeçalho da prévia (edição **cirúrgica**: mexe só naquele cartão, grava `@` acima e rola/destaca a linha alterada). Selo em cada cartão indicando se usa **título próprio**, o **título geral** ou nenhum.
- **Frentes repetidas** são agrupadas: um aviso por pergunta, com todas as linhas e um trecho da frente. O botão **"Recortar as repetidas"** mantém a primeira de cada grupo e manda as demais para a gaveta, para você comparar as explicações antes de descartar.
- **Recortar** e **Excluir** cartão direto na prévia, ao lado de "Editar" e "Ocultar resposta". Recortar tira o cartão do texto e guarda numa **bandeja que fica no navegador** — sobrevive a fechar o app; depois é só abrir o baralho certo e clicar em "Colar aqui". O bloco vai inteiro (título `@`, pergunta, resposta, tags e explicações `+`) — é o mesmo formato do editor, então o cartão volta completo em qualquer baralho. A bandeja lista um cartão por linha, com seleção, **Copiar** e **Excluir** individuais, e permite colar ou descartar só os marcados. Ambos são desfazíveis pelo "Desfazer última colagem".
- Edição inline em **campos coloridos** por tipo (frente, verso, saiba mais, título, tags), que crescem com o texto, com os secundários recolhíveis; **conversão de tipo** (básico ↔ cloze ↔ múltipla escolha) com confirmação.

**Revisão de conteúdo** (botão "Revisar cartões")
- A barra tem três grupos com papéis distintos — **Marcar** (critérios, todos com a mesma forma), **Ver** (caixas de seleção com o contador) e as duas ações que levam o trabalho adiante, lado a lado e do mesmo tamanho. O que apenas desfaz virou link discreto.
- Liga o modo de marcação: **caixa "marcar p/ revisão"** por cartão e botões de seleção automática — **Curtos, Sem resposta, Sem pergunta, Longos, Frente repetida** e **Com números/datas/artigos** (maior risco factual).
- Filtro **"Mostrar só os marcados"** para focar e editar no lugar (nada é movido nem apagado).
- Filtro **"Ocultar já revisados"**: some da tela o que já passou por uma rodada (selo verde), deixando visível só o que ainda falta conferir. A marca é por frente do cartão e fica salva no navegador, então sobrevive a edições e ao recarregar; **"Limpar 'já revisados'"** recomeça o ciclo.
- **"Copiar os marcados"** abre uma janela **editável** com o prompt + cartões, em duas versões: *Corrigir forma* (ChatGPT/Claude/Gemini) e *Verificar nas fontes* (Gemini Notebook, prompt curto). Os prompts pedem para **aprimorar os cartões existentes, sem criar novos**.
- **"Colar correção"** substitui os cartões marcados pela versão corrigida da IA (remove os antigos e insere os novos, sem duplicar), com confirmação e possibilidade de desfazer.

**Exportação**
- Nome do baralho e **título geral** definidos na hora de exportar (o geral também aparece no topo do painel direito); subpastas via `::` com destino em tempo real.
- Escolha de **alinhamento** (justificado com separação silábica, ou à esquerda) valendo para a prévia e para o `.apkg`. O bloco "Saiba mais" sai em blocos separados, com o termo em destaque; resposta longa deixa o formato de manchete e vira texto corrido.
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

## O bug que sobreviveu a duas correções

Os botões de exportar continuavam aparecendo no modo edital mesmo depois de o
código ser corrigido duas vezes. A causa:

```html
<div style="display:flex" id="rodapeExportar">   <!-- hidden não faz nada -->
```

`hidden` é aplicado por uma regra da folha de estilo do navegador
(`[hidden]{display:none}`), e **um `style` embutido vence qualquer regra de
folha**. O elemento ficava escondido no papel e visível na tela — e como o
código estava certo, cada verificação minha confirmava que estava certo.
O teste S1 agora proíbe `display` embutido nesse elemento.

## O rodízio de disciplinas

Ordenar a semana só por peso agrupa por disciplina: sete horas seguidas de
Direito Administrativo, depois oito de Direito Financeiro. Ninguém estuda
assim, e quem tenta esquece o primeiro bloco antes de chegar ao fim.

A fila passa a fazer **rodízio**: a cada rodada entra o tópico mais pesado de
cada disciplina que ainda tem fila. A ordem por peso continua valendo dentro de
cada disciplina e entre as rodadas; o que muda é que a semana sai misturada.
O teste S3 falha se mais de dois tópicos seguidos forem da mesma disciplina.

## "Peso" quer dizer peso na prova

Duas leituras de peso convivem e é fácil confundi-las:

- o **1 a 5** da disciplina — um multiplicador, não uma quantidade;
- o **peso total na prova** — `Σ (peso da disciplina × peso do tópico)` de
  todos os seus tópicos.

Os cartões são ordenados pelo segundo, e cada um mostra a sua fatia
(`71% da prova`). Direito Constitucional com 26 tópicos e Noções de Direito
Penal com 3 podem ambos estar em "peso 3" e mesmo assim representar fatias
completamente diferentes do que a prova cobra — ordenar pelo 1 a 5 colocaria
os dois lado a lado como se fossem equivalentes.

O empate desempata pelo **mais atrasado**: entre duas disciplinas de fatia
parecida, sobe a menos estudada.

## Backup: um arquivo, e a conferência antes de mexer

`docs/backup.js` monta **um** `.json` com tudo — cartões, editais, progresso,
diário, material de estudo e preferências. Backup dividido é backup que se
restaura pela metade e deixa o app num estado que ninguém conhecia.

Quatro regras que o arquivo existe para garantir:

- **formato versionado** (`backup/1`): campo desconhecido é ignorado, campo
  ausente ganha padrão — é o que permite restaurar hoje um backup de dezembro;
- **o resumo vai dentro do arquivo**, então dá para dizer o que tem num backup
  sem restaurá-lo: a pergunta de quem está com dois arquivos e não sabe qual é;
- **nada muda antes da conferência**: uma tabela item por item com o que o app
  tem agora e o que o arquivo traz, com as linhas que vão encolher em vermelho;
- **tudo-ou-nada**: se falhar no meio, nada foi escrito.

"Salvar na nuvem" não usa credencial nenhuma: no celular abre a folha de
compartilhamento do sistema (Drive, OneDrive, Dropbox); no computador deixa
escolher uma pasta — se for a do Drive, a cópia sobe sozinha. O selo no rodapé
mostra de quando é a sua base, verde até 7 dias, vermelho depois de 21.

## Material de estudo

O terceiro modo deixou de ser esqueleto. Cada tópico do edital ganha um botão
`📄` na agenda e nas caixas de disciplina; o texto fica indexado pela **mesma
chave do progresso** (`disciplina›tópico`) — sem tabela de ligação e sem id
novo: se a chave serve para dizer "estudei isto", serve para dizer "e o que eu
estudei foi isto".

O ciclo fecha com "Virar cartões", que leva o resumo para a bancada já dentro
do prompt de geração: **edital decide o assunto → material guarda o conteúdo →
cartões fixam a memória.**

Cada resumo e cada registro do diário gravam **para qual concurso** foram
feitos. Hoje há um edital só e a marca parece supérflua; ela existe porque
informação que não é gravada na hora não se recupera depois — no dia em que
houver dois planos, os históricos precisam ser separáveis.

## Duas réguas: tópicos e peso

Contar tópicos trata Noções de Direito Penal (3 tópicos) e Direito
Constitucional (26) como iguais. O painel mede as duas coisas, e é a
**diferença entre elas** que informa:

| quem estudou | tópicos | peso da prova |
|---|---|---|
| os 4 tópicos leves | 67% | **7%** |
| os 2 tópicos pesados | 33% | **93%** |

Mesma pessoa, mesmo esforço aparente, resultados opostos. Quando a contagem
de tópicos passa 10 pontos à frente do peso, o painel avisa: *"o esforço está
indo para os assuntos mais leves"*.

Cada tópico tem dois estados, marcados pelo usuário: **estudado** (a caixa) e
**revisado** (o botão `R`, que só aparece depois de estudado — não se revisa o
que não se viu). Revisado é um **subconjunto** de estudado, nunca uma soma à
parte, e por isso a barra tem duas camadas em vez de duas barras: verde claro
o estudado, verde escuro o revisado dentro dele.

O progresso salvo no formato antigo (`true`) continua valendo — a migração é
silenciosa, feita na leitura, para ninguém perder o que já marcou.

## O painel do edital

Duas vistas, e a que abre por padrão é a do dia a dia. A **tabela** de 231
linhas responde "qual é a ordem?", pergunta que se faz uma vez. O **painel**
responde "e agora?", que se faz toda manhã:

- topo com barra de progresso, contagem regressiva e o tamanho da semana;
- **Esta semana** — 8 linhas com caixa de marcar, não 231;
- um **cartão por disciplina** com barra de progresso, contadores por faixa
  (`● 12 alta · ● 9 média · ● 5 baixa`) e o **peso editável ali mesmo**.

Mudar o peso no cartão **reescreve o texto**, nunca um estado paralelo:
enquanto tela e texto puderem divergir, uma das duas está mentindo e o usuário
não tem como saber qual. O teste O6 existe só para isso.

Sobre o registro: não há um log separado do edital, e não deve haver. É um
registro só, com os eventos marcados por prefixo (`EDITAL-TEXTO`,
`EDITAL-PESO`, `EDITAL-PROGRESSO`) — dois registros criariam a pergunta "em
qual deles está?", cuja resposta certa costuma ser "nos dois, e a ordem entre
eles importa". O que faltava era **conseguir filtrar**, e agora o painel de
diagnóstico tem a caixa "mostrar só os eventos do modo em que estou".

## O plano do edital: uma fila, não uma fatia

O primeiro modelo dividia o orçamento **semanal** entre todos os tópicos. Com o
edital real de um usuário — TCE-PE, 231 tópicos, 12h por semana — o resultado
foi 20 minutos para cada um, ou seja **77 horas por semana**: seis vezes o
tempo que existia. Aritmeticamente correto, completamente inútil.

Pior: um teste (`I-E5b`) chegou a fixar esse comportamento como certo, com o
comentário de que "o piso estoura o orçamento de propósito, e isso é honesto".
Era honesto e inútil — um plano que ninguém pode cumprir não informa nada.

O modelo agora é uma **fila ao longo das semanas até a prova**:
`orçamento = semanas × horas/semana`, preenchido em ordem de prioridade. O que
não cabe é contado, nomeado e mostrado — com quantas horas por semana cobririam
tudo. Para o mesmo edital: 108h de orçamento, 108 tópicos cabem, 123 ficam de
fora, seriam necessárias 24h por semana.

Tempo por **faixa**, não proporcional: alta 60min, média 45, baixa 30.
Proporção entre 231 itens produz "8 minutos de Direito Civil", que não é uma
sessão de estudo.

E um detector novo, do mesmo tipo do "cartão preso à prova de origem": **todas
as disciplinas com o mesmo peso**. Foi o que a IA devolveu no caso real — 17
disciplinas, todas com 3 — e como a prioridade é peso da disciplina × peso do
tópico, a disciplina sai da conta e a ordenação vira quase um empate. Formato
válido, priorização inexistente.

## Onde cada botão mora

A regra que resolveu a confusão da barra da bancada: **o que é do dia a dia
fica junto do trabalho; o que é rede de segurança fica em Ferramentas.**

| botão | onde | por quê |
|---|---|---|
| ⤢ Ampliar | ao lado do editor | usado o tempo todo enquanto se cola texto grande |
| ⟲ Versões do texto | Ferramentas | rede de segurança, usada em acidente — não é tarefa diária |
| Importar PDF/Word/Excel | Ferramentas | uso ocasional que ocupava o topo da bancada todo dia |
| Aviso de encolhimento | na bancada, quando acontece | é contextual: aparece no instante do acidente e some depois |

E duas regras de linguagem que valem para os três:

- **O aviso explica antes de o usuário clicar.** A barra vermelha trazia só
  dois botões e nenhum contexto — "Recuperar o texto anterior" não diz o que
  aconteceu nem o que se perde. Agora ela tem título com os números reais,
  um parágrafo dizendo o que costuma causar aquilo, e só então as ações.
- **Ação destrutiva confirma; dispensar, não.** Restaurar substitui o editor,
  então o app diz os dois tamanhos e avisa que dá para voltar atrás. Já
  "Foi de propósito" não abre caixa de confirmação: confirmar um "não faça
  nada" ensina a clicar em qualquer diálogo sem ler. Ele mostra onde a cópia
  ficou guardada, que é o que a pessoa vai precisar depois.

## Diagnóstico e registro

O relatório **segue o modo**. Ele olhava sempre a bancada de cartões, e com o
edital no ar isso virou mentira: quem relatasse um problema do edital recebia
de volta o texto dos cartões, sem nenhum sinal da troca. Foi assim que a
pergunta "o edital veio completo?" ficou sem resposta — o log tinha o prompt
sendo aberto e mais nada, e o relatório mostrava outra bancada.

Agora o painel declara em cima, por extenso, **de qual bancada é o relatório**,
com linhas, caracteres e eventos; copiar e baixar confirmam no próprio botão
("✓ Copiado") além do aviso passageiro. E o bloco do edital traz as contagens
que respondem à pergunta: disciplinas, tópicos, pesos chutados, linhas não
entendidas, e quantos tópicos cada disciplina recebeu — que é onde se vê um
edital cortado no meio.

`[EDITAL-TEXTO]` registra as contagens a cada mudança real (com pausa, para
digitar não gerar duzentas linhas). O histórico delas é o que mostra o edital
chegando pela metade.

Eram dois links no rodapé que copiavam cegamente para a área de transferência.
Quem clicava não via o que estava levando, e a diferença entre "Diagnóstico" e
"Registro" não estava escrita em lugar nenhum. Agora é **um botão** que abre um
painel: explica cada bloco, **mostra** o relatório com as divisórias e os erros
destacados, e daí você copia ou baixa `.txt`. Uma caixa deixa tirar o texto dos
cartões do relatório, para quem não quer enviar o próprio material.

Quatro correções de fundo, cada uma nascida de uma falha real:

| | o que mudou | veio de |
|---|---|---|
| **Blocos protegidos** | cada seção do relatório entra num `try`; se uma falhar, o buraco fica anotado e o resto sai | o diagnóstico rodava sem rede — e ele roda exatamente quando as coisas estão quebradas |
| **Eventos que não se descartam** | `ERRO`, `BLOQUEIO`, `APAGAR`, `RESTAURAR` e `TEXTO` ficam no anel; a rotina é que sai | seis `[INICIO]` seguidos empurravam para fora um `[ERRO]` de dias atrás |
| **Código de sessão** | quatro caracteres por abertura, em cada linha do registro | com PWA e navegador abertos juntos, os eventos se intercalavam sem ordem legível |
| **Armazenamento no relatório** | `persist()` concedido?, espaço em uso, versões no histórico | era o dado mais relevante para a perda de 137 cartões, e o único ausente |

E três eventos que faltavam: `EXPORTAR`, `COLAR-EDITOR` e `DIAGNOSTICO`. O
primeiro é o que responde à pergunta que decidiu tudo naquele incidente —
*existia uma cópia fora do app?* — e que o registro, com 134 eventos, não sabia
responder.

`tests/tela.js` cobre o diagnóstico com seis entradas degeneradas (vazio, cloze
sem fechar, só separador, 5.000 caracteres): **um relatório de defeito que falha
junto com o defeito é pior do que nenhum**.

## Modos (barra lateral)

`docs/modos.js` é um **registro**, não um menu com um `if` por botão:

```js
const MODOS = [
  { id: "cartoes", secao: "secCartoes", icone: "🗂", rotulo: "modo_cartoes", pronto: true },
  { id: "edital",  secao: "secEdital",  icone: "📋", rotulo: "modo_edital",  pronto: false },
  { id: "resumos", secao: "secResumos", icone: "📝", rotulo: "modo_resumos", pronto: false },
];
```

Um modo novo é uma entrada aqui mais uma `<section>` no HTML — `app.js`,
`parser.js` e `anki.js` não mudam. Cada entrada aponta a própria seção em vez
de o código procurar por `[data-modo]`: assim o registro é a única fonte da
verdade e dá para saber tudo sobre os modos sem abrir o HTML.

**Edital** e **Resumos** hoje são só o esqueleto — formas cinzas mostrando a
arrumação da tela, com os botões desativados e o selo "em breve". A regra que
o teste K5 protege desde já: trocar de modo **não encosta no texto do editor**.
Um modo que apagasse o trabalho do outro repetiria o acidente que custou 137
cartões.

Trilho vertical acima de 900px, fileira de abas abaixo disso — a mesma
marcação, montada pelo mesmo registro.

## O cartão preso à prova de origem

O defeito mais caro que os prompts produziam não era de formato — era de
conteúdo, e passava em toda verificação:

```
Qual a ordem correta das definições da Questão 17?
  :: A ordem correta é a Letra A: (1) Avaliação, (2) Formulação de Agendas
```

Formato impecável. Daqui a dois meses, quando ninguém tem a prova na frente,
não ensina nada: pergunta **onde estava** a resposta, não **o que a coisa é**.
A IA produz isso quando recebe uma lista de questões — preserva com fidelidade
o andaime (número, letra, gabarito) e joga fora o conceito.

Todos os seis prompts passaram a carregar a mesma **regra de ouro**, colocada
ANTES do material (depois dele, perde força): o cartão se explica sozinho, é
proibido citar questão/letra/gabarito, a resposta é o conceito e não a sua
localização, e dividir é **redistribuir** — nunca resumir.

Mas prompt é pedido, não garantia. Por isso existe também um detector, e ele
só aponta: reescrever exige entender o assunto, então o aviso vai marcado como
"precisa da IA", com "Ver no texto" e a crítica por linha dentro do prompt de
correção.

## Histórico do texto

Até a v8.44 o texto do editor morava num **único** slot de `localStorage`,
sobrescrito 400ms depois de qualquer digitação. Selecionar tudo e colar outra
coisa apagava horas de trabalho de forma definitiva — e silenciosa, porque as
duas ações mais destrutivas do app (substituir o texto e "Apagar tudo") eram
justamente as únicas que não geravam evento no registro. Um usuário perdeu 137
cartões assim, e o registro não sabia dizer o que tinha acontecido.

Agora o app guarda uma cópia antes de cada mudança grande (até 12 versões,
teto de ~1,2 MB), o botão **⟲ Histórico** lista e restaura, e um encolhimento
brusco do texto — metade ou menos, em texto de trabalho — levanta uma barra
vermelha oferecendo a versão anterior de volta. `[TEXTO]`, `[APAGAR]` e
`[RESTAURAR]` passaram a aparecer no registro.

Isso é uma rede para acidentes das últimas horas, não um sistema de versões.
O artefato durável continua sendo o `.apkg` exportado e importado no Anki.

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

A lista de sugestões marca **quem resolve** cada problema, e a marca vem com consequência: todo item de IA sabe dizer em que linha ele acontece ("Ver no texto"), o crachá traz um ícone que explica o caminho, e o botão "Criar prompt de correção" pulsa enquanto houver trabalho que só a IA faz. Detalhe:  o app arruma o que é mecânico (formato, espaço, markdown); dividir um cartão longo ou encurtar uma alternativa é editorial e vai para a IA pelo prompt de correção. Sem essa marca o usuário clica em "Corrigir" esperando que resolva tudo e conclui que o app está quebrado.

Há também um detector para o pior acidente do fluxo: **o prompt colado de volta no lugar do material**. Ele não olha sintaxe — os cartões que a IA gera a partir das próprias regras são formalmente perfeitos — e sim vocabulário. Por isso só avisa e oferece limpar, nunca apaga sozinho: um baralho sobre método de estudo falaria dessas mesmas palavras por direito.

`apkg.js` olha o arquivo que sai, não o app: confere que o alinhamento vai **declarado** no CSS exportado (e não herdado do modelo padrão do Anki, que centraliza tudo), que os conceitos do "Saiba mais" saem em blocos separados, e que o `guid` de cada nota vem do texto que você escreveu — não do HTML gerado. Essa última é a que evita a pior surpresa: enquanto o `guid` saía dos campos já formatados, qualquer melhoria de apresentação mudava a identidade de todos os cartões e reimportar o baralho **duplicava tudo** em vez de atualizar.

`estrutura.js` confere que as tags do HTML fecham na ordem certa e que cada elemento continua dentro do painel a que pertence — uma tag sobrando não quebra nada visivelmente, o navegador "conserta" e o resultado é um pedaço da tela na coluna errada.

Rodam junto três testes de interface, num DOM mínimo escrito à mão (sem dependência): `fumaca.js` verifica que o app carrega sem erro, e `tela.js` exercita o fluxo de revisão, o prompt de correção, a bandeja e o foco.

Uma verificação de `tela.js` merece destaque, porque nasceu de um erro meu: **todo detector aceso tem de oferecer o seu próprio botão de correção na lista de sugestões**. Na v8.37, ao reescrever o bloco das frentes repetidas, apaguei sem querer todos os itens de correção. O botão geral continuou funcionando, nenhum teste caiu, e o usuário simplesmente deixou de ver *o que* estava errado — a pior classe de defeito, a que não dá sintoma.

O **esperado.json** congela os números de cada caso conhecido e pega a regressão: o bug que já foi corrigido uma vez e voltou. As duas primeiras regras também rodam dentro do app, na rede de segurança que cancela qualquer correção que fosse perder conteúdo.

## Como usar

- **Web/celular (recomendado)**: abra o link, cole o resultado do prompt de IA (ou digite) e exporte. No celular, use "Adicionar à tela inicial" para instalar.
- **Desktop**: `pip install -r requirements.txt` e dois cliques em `iniciar_app.bat`. Executável: `scripts\build_exe.bat` → `release\EasyAnkiCards.exe`.
- **Linha de comando**: `python src/easyankicards/cli.py examples/exemplo.txt --deck "Meu Baralho"`.

## Publicação (GitHub Pages)

A pasta `docs/` é servida pelo GitHub Pages. Ao atualizar, suba os arquivos de `docs/` (mantendo o `.nojekyll`). Como o service worker guarda a versão anterior, na primeira vez após publicar pode ser preciso Ctrl+Shift+R (ou desregistrar o service worker em DevTools → Application) uma única vez; depois, o app avisa das novidades sozinho.

## Licença

**MIT** — uso, cópia, modificação e distribuição livres, mantendo o aviso de copyright (veja `LICENSE`). Contribuições são bem-vindas via pull request.
