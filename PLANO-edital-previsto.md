# Plano — editais previstos e a inclusão de disciplina

Duas coisas neste documento:

1. **Editais previstos** — concurso planejado, com disciplinas esperadas e
   material de pré-edital, mas sem data; e que pode mudar data, disciplina
   ou tópico quando o edital sair de verdade.
2. **Incluir disciplina à mão** — a tela atual não explica o que o peso
   significa, e você não gostou dela. Com razão.

Documento de planejamento. Nada aqui foi implementado.

---

## Parte 1 — Editais previstos

### 1.1 O que quebra hoje sem data

Medi com um edital de 196 tópicos, o seu, com e sem `prova:`:

| | com data | sem data |
|---|---|---|
| semanas até a prova | 14 | **null** |
| projeção ("você chega a X%") | 86% | **não calcula** |
| tópicos que não cabem no prazo | 0 | **não calcula** |
| agenda da semana | funciona | funciona |

A agenda continua funcionando — o que some é tudo que depende de **prazo**:
projeção, "não cabe", urgência entre editais. Ou seja: o edital previsto
entra na fila de estudo, mas o painel de acompanhamento fica mudo sobre ele.

Isso não é defeito a consertar; é a verdade. Sem data não há prazo. O que o
app precisa é **dizer isso** em vez de mostrar traços, e oferecer um
substituto honesto.

### 1.2 O substituto honesto: janela, não data

Concurso previsto não tem data — tem **janela**. "Entre março e junho de
2027", "segundo semestre", "assim que sair o orçamento".

```
# TCE-CE Auditor | previsto: 2027-03..2027-06 | horas: 10
```

Regras:

- o app planeja pela **borda mais próxima** da janela (março), que é a
  suposição conservadora: se a prova vier antes, você não é pego;
- toda tela que mostra prazo diz **"previsto"** e mostra a janela inteira,
  nunca só a data escolhida — senão vira um número que parece certeza;
- a projeção aparece com a ressalva: *"se a prova sair em março"*. Duas
  linhas, uma por borda, quando a janela for larga.

Sem janela nenhuma ("não faço ideia"), o edital é **de fundo**: entra na
agenda com urgência mínima, e o painel diz *"sem data prevista — este
edital não disputa a sua semana"*.

### 1.3 Confiança de cada parte

Aqui está o que o formato atual não sabe dizer: **nem tudo num edital
previsto tem o mesmo grau de certeza.** Direito Constitucional cai em todo
concurso de controle externo; "Análise de Dados" pode ser invenção de um
blog.

```
@ Direito Constitucional :: 4 :: confirmada
@ Auditoria Governamental :: 5 :: provável
@ Análise de Dados :: 3 :: boato
```

Três níveis, e cada um muda o comportamento:

| nível | de onde vem | como a agenda trata |
|---|---|---|
| **confirmada** | edital anterior do mesmo órgão/banca | normal |
| **provável** | editais parecidos, banca conhecida | normal, com selo |
| **boato** | fórum, especulação | **fora da agenda por padrão**, com um botão "estudar assim mesmo" |

O "boato" fora da agenda por padrão é a decisão que protege o seu tempo:
estudar por especulação é o desperdício mais caro que existe num concurso.

### 1.4 O momento que decide tudo: o edital sai

É aqui que se ganha ou se perde meses de estudo. E a boa notícia é que a
máquina já existe:

- `edCompararColagem` (v8.70) já detecta tópicos que somem, que surgem,
  mudança de peso e **progresso órfão**;
- os vínculos (v8.74) já sabem dizer "isto que você estudou equivale
  àquilo";
- o diário nunca é reescrito, então o que você estudou continua registrado
  mesmo que o tópico deixe de existir.

O que falta é o **ritual**, e ele deve ser um só, com nome:

```
CHEGOU O EDITAL DE VERDADE
Cole o edital publicado. Vou comparar com o que você vinha estudando.

   ✓ 142 tópicos continuam iguais — seu progresso fica
   + 38 tópicos novos entram sem progresso
   ⚠ 17 tópicos saíram do edital
        · 9 deles você já estudou (13 h registradas)
        · dá para vincular 6 aos tópicos novos equivalentes  [ver]
   ⚠ 4 disciplinas mudaram de peso
   ✗ 1 disciplina saiu inteira: Análise de Dados (era "boato")

   [comparar um a um]  [aplicar]  [cancelar]
```

A linha que importa é a terceira: **o estudo de um tópico que morreu não é
perdido, é remanejável**. Sem essa ponte, a pessoa vê "17 tópicos saíram" e
lê "perdi 13 horas".

E o edital previsto **não é substituído**: ele vira uma versão no histórico,
com data. Comparar o previsto com o publicado é informação de valor para o
ciclo seguinte — quantas disciplinas o seu palpite acertou.

### 1.5 Material de pré-edital

O material já é guardado por `disciplina›tópico` e sobrevive à troca do
edital — desde a v8.79 as chaves são únicas. Duas consequências boas:

- resumo escrito antes do edital sair continua ligado ao tópico se o nome
  não mudar;
- se o nome mudar, o material **fica órfão em silêncio** — e isso precisa
  de conserto: o ritual acima deve oferecer *"3 resumos ficaram sem tópico;
  a qual você quer ligar cada um?"*.

### 1.6 Ordem sugerida

| fase | entrega | situação |
|---|---|---|
| **P1** | `previsto: AAAA-MM..AAAA-MM` no cabeçalho | **feito (v8.81)** |
| **P2** | planejar pela borda mais próxima | **feito (v8.81)** |
| **P3** | confiança por disciplina, e "boato" fora da agenda | **feito (v8.81)** |
| **P4** | o ritual "chegou o edital de verdade", com prompt de conversão | **feito (v8.82)** |
| **P5** | remanejar progresso e material órfãos pelos vínculos | **feito (v8.82)** |

**P1 e P4 são os que valem sozinhos.** P3 é o que protege o tempo.

### 1.7 Testes que nascem daqui

| | regra |
|---|---|
| EP-A | edital sem data nunca mostra projeção como se fosse certeza |
| EP-B | a janela planeja pela borda mais próxima, e a tela mostra as duas |
| EP-C | disciplina "boato" não entra na agenda sem gesto explícito |
| EP-D | aplicar o edital publicado nunca apaga o diário |
| EP-E | progresso de tópico que sumiu continua acessível para remanejo |
| EP-F | o edital previsto vira versão no histórico, não é sobrescrito |
| EP-G | material órfão é listado, nunca descartado em silêncio |

---

## Parte 2 — Refazer a inclusão de disciplina

### 2.1 O que está errado hoje

A tela pergunta "peso de 1 a 5" e mostra, ao lado, quais disciplinas já
estão em cada peso. Isso responde *"o que os outros têm"*, mas não responde
a pergunta real: **"o que muda se eu puser 4 em vez de 3?"**

Medi no seu edital, incluindo uma disciplina de 12 tópicos:

| peso | fatia da prova | h/semana que a agenda passa a pedir | fica no patamar de |
|---|---|---|---|
| 1 | 2% | 0,4 h | Estatística, Direito Civil |
| 2 | 3% | 0,4 h | Estatística, Direito Civil |
| 3 | 5% | 0,6 h | Análise de Dados |
| 4 | 6% | 0,9 h | Análise de Dados |
| 5 | 8% | 0,9 h | Auditoria Governamental, Administração Pública |

Duas coisas saltam:

- **a fatia é a medida que discrimina** (2% → 8%), e ela nem aparece na
  tela hoje;
- **as horas quase não mudam** entre 1 e 2, e entre 4 e 5. Mostrar horas
  como se fossem a consequência principal seria enganoso.

### 2.2 A tela nova

O peso deixa de ser um número abstrato e passa a ser escolhido **pela
consequência**:

```
PESO DESTA DISCIPLINA NA PROVA

   ( ) 1 — 2% da prova     · como Estatística, Direito Civil
   ( ) 2 — 3% da prova     · como Estatística, Direito Civil
   (•) 3 — 5% da prova     · como Análise de Dados
   ( ) 4 — 6% da prova     · como Análise de Dados
   ( ) 5 — 8% da prova     · como Auditoria, Administração Pública

   De onde vem esse número: quantas questões a disciplina vale na prova.
   Se o edital não disser, olhe o edital anterior do mesmo órgão.
```

Cada opção é calculada **na hora**, com os tópicos que você já digitou —
por isso a fatia muda enquanto você escreve. É a mesma ideia da projeção no
painel: número abstrato vira frase decidível.

E some o mapa "quais disciplinas estão em cada peso", que ocupava espaço
dizendo pouco: a coluna "fica no patamar de" já entrega isso, e no lugar
onde a decisão está sendo tomada.

### 2.3 O prompt de inclusão

Você pediu, e faz sentido: quem tem o edital em PDF não deveria digitar
tópico a tópico.

```
Vou te dar o trecho de um edital com UMA disciplina. Devolva no formato
abaixo, sem comentários, sem markdown.

FORMATO:
@ Nome da disciplina :: peso
+ Nome do tópico :: peso :: por que esse peso

REGRAS:
1. O peso da DISCIPLINA (1 a 5) vem de quantas questões ela vale na prova.
   Se o edital não disser, use 3 e escreva "peso não informado no edital"
   no motivo do primeiro tópico.
2. O peso do TÓPICO (1 a 5) é sobre a chance de cair e a dificuldade.
3. TIRE a numeração do edital ("1.1", "2.3") do nome do tópico.
4. Um tópico por linha. Não agrupe, não resuma: tópico perdido é pior que
   lista longa.
5. Nada de "::" dentro do texto — só como separador.

TRECHO DO EDITAL:
[cole aqui]
```

Chega pela mesma bancada e passa pela mesma conferência da colagem, com uma
diferença: aqui a conferência mostra **só o que vai ser acrescentado**,
porque incluir uma disciplina não pode mexer no resto do edital.

### 2.4 As orientações que faltam

Hoje a tela diz "Um por linha. Sem peso, o tópico entra com 3." Isso ensina
sintaxe, não ensina a decisão. Faltam três frases, cada uma no lugar do
campo que ela explica:

- no nome: *"Como está escrito no edital. Se ele diz 'Noções de Direito
  Penal', use isso — é assim que você vai procurar depois."*
- no peso: a tabela da seção 2.2, que já é a explicação;
- nos tópicos: *"Cole do edital e depois ajuste. O terceiro campo é o
  motivo do peso e serve para você lembrar, meses depois, por que decidiu
  aquilo."*

### 2.5 Ordem

| fase | entrega | esforço |
|---|---|---|
| **D1** | peso escolhido pela consequência (fatia + patamar), calculado ao vivo | meio dia |
| **D2** | prompt de inclusão de uma disciplina, com conferência do que entra | meio dia |
| **D3** | as três orientações, cada uma junto do seu campo | 2 h |
| **D4** | tirar o mapa de pesos, que vira redundante | 15 min |

### 2.6 Testes

| | regra |
|---|---|
| D-A | a fatia mostrada em cada peso bate com a fatia real depois de incluir |
| D-B | a fatia se recalcula quando o número de tópicos digitados muda |
| D-C | o prompt de inclusão nunca altera disciplina que já existe |
| D-D | conferência mostra o que ENTRA, e nada mais |

D-A é a que importa: se a tela promete 8% e depois entrega 6%, ela é pior
que a tela de hoje — a de hoje pelo menos não promete nada.
