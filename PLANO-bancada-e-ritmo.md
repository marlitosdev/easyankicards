# Plano — o que ficou de fora da v8.68

A v8.68 entregou a **lista de editais**, a **agenda no topo** (com o nome do
concurso em cada linha) e a **inclusão dos editais no backup**. Três pedidos do
mesmo lote ficaram para a próxima, porque mexem em cálculo e em layout que hoje
já funcionam — e eu prefiro mexer neles com a base multi-edital já assentada.

---

## 1. Ritmo semanal: priorizados × tudo

### O que existe

`ritmoDoPlano` mede um conjunto só: os tópicos que entram na fila. Quem olha o
painel não sabe se 12% é 12% da prova ou 12% do que dá tempo de estudar — e
esses dois números podem estar muito longe um do outro.

### O que fazer

Duas colunas lado a lado, sempre. A régua continua sendo **peso**, não contagem.

```
                        PRIORIZADO (cabe até a prova)      TUDO (o edital inteiro)
tópicos                 84 de 231                          231
peso da prova           68%                                100%
estudado                11 tópicos · 9% do peso            11 tópicos · 6% do peso
revisado                 4 tópicos · 3% do peso             4 tópicos · 2% do peso
```

A linha que dá sentido às outras:

> Você priorizou 68% do peso da prova. Do que priorizou, estudou 13%.
> Os 32% restantes ficaram de fora do plano — não por escolha, por falta de tempo.

Sem essa frase, "68%" parece uma nota. Com ela, vira uma decisão explícita: ou
aceitar, ou aumentar as horas, ou cortar disciplina.

### Onde toca no código

`ritmoDoPlano(plano)` passa a devolver `{ priorizado, tudo }` em vez de campos
soltos, e `edPintarRitmo` desenha as duas colunas. Os testes D-A e D-B já fixam
que a soma das horas não estoura o orçamento; entram dois novos:

| | regra |
|---|---|
| R-A | `priorizado.peso ≤ tudo.peso`, sempre — priorizar nunca aumenta a prova |
| R-B | um tópico marcado fora da fila conta em `tudo` e **não** em `priorizado` |

R-B é a que impede o número de inflar: hoje qualquer marcação entra na conta.

---

## 2. Incluir disciplina à mão

### Por que não é só um formulário

O campo difícil é o **peso**. Pedir "peso de 1 a 5" sem mostrar o resto produz
exatamente o defeito que o CSV do TCE-PE revelou: 17 disciplinas com peso 3, o
que anula a priorização inteira. O formulário precisa mostrar, ao lado do campo,
o que já está cadastrado:

```
Peso desta disciplina:  [ 1 ][ 2 ][ 3 ][ 4 ][ 5 ]

já cadastradas
  5 ██████  Auditoria Governamental, Controle Externo
  4 ████    Direito Administrativo
  3 ███     Português, RLM, Direito Civil
```

Escolher 3 deixa de ser o padrão distraído e passa a ser uma comparação.

### Redistribuir no fim

Ao salvar, se a soma mudou o equilíbrio, o app oferece — **oferece**, não faz:

> Com esta disciplina, Auditoria caiu de 22% para 19% da prova.
> [ manter assim ]  [ redistribuir proporcionalmente ]  [ ajustar à mão ]

"Manter assim" é a primeira opção de propósito: pesos vindos do número de
questões do edital são dados, e o app não deve reescrever dado do usuário sem
ele pedir.

### Regra que sustenta tudo

O formulário **escreve no texto** do edital (`@ Nome :: peso`), como já fazem o
peso editável e as horas. Estado que não está no texto é estado que diverge da
tela — foi o que aconteceu com o campo de horas e o controle deslizante.

---

## 3. As caixas viram lista embutida

### Hoje

Dezessete cartões de altura fixa, soltos abaixo de tudo, sem cabeçalho que diga
o que são.

### O que fazer

Um bloco **"Mapa das disciplinas"**, logo abaixo do painel da bancada,
**recolhido por padrão**, com o resumo no cabeçalho:

```
▸ Mapa das disciplinas — 17 matérias · 231 tópicos · 11% do peso estudado
```

Aberto, vira grade de múltiplas colunas em linha única:

```
Direito Financeiro   peso 5 · 15% da prova · ▓░░░░ 0/22 · 20 parados
Controle Externo     peso 5 · 13% da prova · ▓▓░░░ 4/19 ·  9 parados
```

Dezessete cabem em meia tela. O cartão grande de hoje **vira o modal de
panorama que já existe** — duplicar a informação em dois lugares foi o que criou
a poluição.

Ordenação escolhível: por lacuna (padrão), por fatia da prova, ou pela ordem do
edital.

---

## 4. Ordem sugerida

| fase | entrega | por quê nesta posição |
|---|---|---|
| **G1** | ritmo priorizado × tudo, com a frase de decisão | é número errado sendo lido hoje; o resto é layout |
| **G2** | incluir disciplina com comparação de pesos | destrava cadastrar edital sem IA |
| **G3** | redistribuição opcional ao salvar | depende de G2 |
| **G4** | Mapa das disciplinas recolhido, linha única | resolve a poluição sem perder nada |

G1 primeiro porque é o único dos quatro em que a tela **mostra um número que
não significa o que parece**. Os outros três são desconforto; esse é engano.
