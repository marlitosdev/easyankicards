# Plano — horários disponíveis, cobertura e o mapa das disciplinas

Documento de planejamento. Só o conserto do botão ilegível foi implementado.

---

## 1. Faixas de horário por dia

Hoje a agenda tem dois campos: *dias por semana* e *começo do dia*. Ela supõe
que a semana é uniforme e que o estudo é um bloco contínuo. Nenhuma das duas
coisas é verdade para quem trabalha: quarta é dia de academia, sábado rende
quatro horas, terça rende quarenta minutos no almoço.

### O que substituir

```
Dias por semana: [5]      Começo do dia: [19:00]
```

por uma grade de sete linhas, uma por dia, com as faixas que existem:

```
seg  [ 06:30–07:30 ]  [ 19:00–21:00 ]                      3h00
ter  [ 19:00–20:00 ]                                       1h00
qua  —                                                       —
qui  [ 19:00–21:00 ]                                       2h00
sex  [ 19:00–20:30 ]                                       1h30
sáb  [ 09:00–12:00 ]  [ 14:00–16:00 ]                      5h00
dom  —                                                       —
                                                    total: 12h30
```

Três decisões que sustentam isso:

- **O total das faixas SUBSTITUI o campo "horas por semana".** Ter os dois é
  ter duas fontes da verdade que vão discordar — o erro que já apareceu quando
  o controle deslizante mudava o campo e o texto devolvia o valor antigo.
  O campo vira leitura, calculado a partir da grade.
- **Faixa menor que o tópico não recebe o tópico inteiro.** Um bloco de 40
  minutos não comporta um tópico de 60; ele recebe um de 30, ou nada. Sem essa
  regra a agenda promete o que o relógio não cumpre.
- **A grade mora no texto**, como os pesos e as horas: uma linha
  `# ... | seg: 06:30-07:30, 19:00-21:00 | ter: 19:00-20:00`. Estado que não
  está no texto é estado que diverge da tela.

### Perfis, para não ser trabalhoso

Preencher 14 campos afasta. Três atalhos cobrem quase todo mundo:

| perfil | grade |
|---|---|
| Depois do trabalho | seg–sex 19:00–21:00, sáb 09:00–12:00 |
| Antes do trabalho | seg–sex 06:00–07:30, sáb 09:00–12:00 |
| Dedicação integral | seg–sex 08:00–12:00 e 14:00–18:00 |

Escolhe um, ajusta o que estiver errado. O botão "copiar segunda para todos os
dias úteis" resolve o resto.

---

## 2. Cobertura: lacuna de conhecimento, não de tempo

Você está certo na distinção, e ela tem consequência prática. Hoje o painel
mistura duas perguntas que se respondem com números diferentes:

| pergunta | unidade | onde está hoje |
|---|---|---|
| Estou andando rápido o bastante? | horas/semana | Ritmo semanal |
| Quanto da prova eu já domino? | % do peso | "Onde estão os buracos" |

A segunda é a que decide a aprovação, e é a que está no rodapé.

### A integração

Um painel só, **Ritmo e cobertura**, com duas metades:

```
RITMO SEMANAL
  para cobrir tudo  ████████████████████  81h45 · 116 tóp/sem
  sua meta          ██████████            40h
  o que você fez    ██                     6h30 · média de 2 semanas

COBERTURA DA PROVA
  ██████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  11% estudado · 4% revisado
  ▸ Direito Financeiro     15% da prova intocada   20 de alta parados
  ▸ Direito Constitucional 13% da prova intocada    8 de alta parados
  ▸ Direito Administrativo 12% da prova intocada   16 de alta parados
```

A barra de cobertura é **empilhada e na escala da prova inteira**: verde
escuro o revisado, verde claro o estudado, cinza o intocado. Não é a média dos
tópicos — é a fração do peso.

### O que muda no cálculo

Nada. `panoramaDisciplinas` já devolve `lacuna` como fatia do peso ainda não
estudada. O que muda é **onde** ela aparece e **com o que** ela é comparada:
hoje ela está sozinha no fim da página, e sozinha ela parece uma lista de
pendências. Ao lado do ritmo, ela vira a resposta para "e se eu mantiver este
ritmo, quanto da prova eu cubro?".

### Uma linha que falta

Cruzando as duas metades sai o número mais útil do painel:

> Mantendo 6h30 por semana, você chega a **23% da prova coberta** no dia 30/08.
> Com a sua meta de 40h, chegaria a 78%.

É a única frase da tela que responde "vale a pena?".

---

## 3. As caixas de baixo: "Mapa das disciplinas"

### Como se chamam

**Mapa das disciplinas** — com um cabeçalho próprio, hoje inexistente: elas
aparecem soltas depois de "Onde estão os buracos" e nada diz o que são.

### Precisam estar ali?

Precisam, mas não abertas. O conteúdo é importante — peso editável, progresso,
contadores por faixa — e é o único lugar onde se ajusta o peso pela interface.
O problema é ocupar dezessete blocos de altura fixa numa página que já tem
ritmo, agenda e cobertura acima.

### O que eu faria

- **Recolhido por padrão**, com o cabeçalho mostrando o resumo: *"Mapa das
  disciplinas — 17 matérias, 232 tópicos, 0% do peso estudado"*. Um clique abre.
- **Grade mais densa**: hoje cada cartão tem nome, peso, barra, contagem, três
  contadores e um link. Em linha única — `Direito Financeiro · peso 5 · 15% ·
  ▓░░░░ 0/22 · 20 parados` — cabem dezessete em meia tela.
- **O cartão grande vira o modal** que já existe. Já temos a janela de
  panorama; duplicar a informação em dois lugares é o que criou a poluição.
- **Ordenação escolhível**: por lacuna (padrão), por fatia da prova, ou pela
  ordem do edital. Hoje é fixa.

Resultado: a página fica com quatro blocos claros — *Ritmo e cobertura*,
*Agenda da semana*, *Mapa das disciplinas* (recolhido) e o texto do edital —
em vez da rolagem atual.

---

## 4. Ordem

| fase | entrega | por quê |
|---|---|---|
| **E1** | integrar cobertura ao ritmo, com a frase de projeção | é a informação que decide, e está no rodapé |
| **E2** | "Mapa das disciplinas": cabeçalho, recolhido, linha única | resolve a poluição sem perder nada |
| **E3** | grade de horários com perfis prontos | a agenda passa a caber no relógio real |
| **E4** | faixa curta não recebe tópico longo | sem isto a agenda promete o que não cumpre |

E1 antes de E3: a agenda fica mais precisa com os horários, mas a cobertura
muda **o que** você decide estudar, não só quando.
