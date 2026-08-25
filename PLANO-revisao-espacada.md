# Plano — intervalo crescente de revisão

A ideia: quanto melhor o histórico de acertos de um tópico, maior o intervalo
até a próxima revisão (1 → 3 → 7 → 16 → 35 dias). Isso impede o acúmulo de
revisões no dia a dia.

Simulei com o **seu** edital antes de desenhar. Os números decidem quase tudo.

---

## 1. Quanto a ideia vale, medido

232 tópicos, 12 tópicos/dia (o que a sua agenda pede), 8h/dia de teto,
45min por estudo novo e 15min por revisão:

| | intervalo fixo de 7 dias | intervalo crescente |
|---|---|---|
| cobriu os 232 tópicos no dia | **153** | **47** |
| revisões no total | 4.259 | **1.378** (−68%) |
| média de revisões por dia | 24,6 | **9,1** |
| no dia 60 | 30 revisões, **0 tópicos novos** | 4 revisões, 9 novos |
| no dia 120 | 30 revisões, **0 tópicos novos** | 0 revisões, 10 novos |

A linha que importa é a penúltima. Com intervalo fixo, **a partir do dia ~50 o
estudo para**: as revisões consomem as 8 horas inteiras e nenhum tópico novo
entra. O edital nunca é coberto — a simulação só chega aos 232 no dia 153, e
apenas porque o teto de 8h força a barra.

Com intervalo crescente, o edital é coberto em **47 dias** e a partir do dia
120 as revisões praticamente somem do caminho.

**Isso não é ajuste fino. É a diferença entre cobrir o edital e não cobrir.**

---

## 2. O que decide o intervalo

Você propôs que o intervalo cresça com o histórico de acertos. Concordo, e
proponho um detalhe: **o que sobe o nível é o desempenho, não o comparecimento.**

| resultado da revisão | o que acontece |
|---|---|
| acertou ≥ 80% das questões | sobe um nível (intervalo maior) |
| entre 60% e 79% | fica no mesmo nível |
| abaixo de 60% | **desce um** nível |
| revisou sem resolver questão | sobe um nível, mas só até o nível 3 |

Duas escolhas que valem explicar:

- **Errar desce um, não zera.** Zerar depois de três meses de estudo é
  desproporcional e desanimador: você não esqueceu tudo, esqueceu um pedaço.
- **Revisão sem questão tem teto.** Reler é confortável e engana: dá a sensação
  de saber. Sem questão não há evidência, então o intervalo pode crescer um
  pouco, não indefinidamente.

---

## 3. O prazo da prova manda no calendário

Aqui está o que a simulação mostrou e que quase todo SRS ignora:

| prova em | revisões que cabem | agendadas para **depois** da prova |
|---|---|---|
| 11 dias | 3 | **3** |
| 30 dias | 4 | 2 |
| 90 dias | 5 | 1 |
| 365 dias | 6 | 0 |

Com a sua prova em 11 dias, **metade das revisões seria agendada para depois
dela** — trabalho que o app planeja e que nunca acontece.

A regra: **quando a série não cabe no prazo, ela é comprimida.**

```
prova em 11 dias  → intervalos [1, 1, 1, 1, 3, 6] → revisões nos dias 1,2,3,4,7
prova em 30 dias  → intervalos [1, 1, 2, 4, 8, 16] → revisões nos dias 1,2,4,8,16
```

A última revisão cai antes da véspera, de propósito: a véspera é para o que
ficou em aberto, não para a rotina.

E o inverso também vale: **revisão agendada para depois da prova não é
agendada.** Ela não existe.

---

## 4. O teto diário

Mesmo com intervalo crescente, a simulação mostrou pico de **23 revisões num
dia**. Sem teto, um dia de agenda vira só revisão e o estudo novo para.

- teto padrão: **30% do tempo planejado da semana**;
- o que não couber **escorrega para o dia seguinte**, mantendo a ordem: quem
  vence antes e pesa mais vai primeiro;
- revisão atrasada há mais de 7 dias volta a valer como estudo, não como
  revisão — porque a essa altura foi esquecida de verdade.

---

## 5. Onde isso mora nos dados

No registro do diário, que já existe e já entra no backup:

```js
srs: { nivel: 2, prox: "2026-09-02", acertos: [0.85, 0.9, 0.6] }
```

O nível e a próxima data ficam no **último registro** de cada tópico. Não é
uma estrutura nova: é um campo a mais no que já é gravado, carimbado na virada
do edital e preservado quando o tópico sai do plano.

Duas consequências boas:

- desfazer um registro (v8.93) devolve o SRS ao estado anterior sem código
  extra — o estado vive no registro que foi apagado;
- o vínculo entre editais (v8.74) faz a revisão de um tópico contar para o
  equivalente no outro concurso.

---

## 6. O que aparece na tela

Na linha da agenda, ao lado do selo **revisão** que já existe:

```
+ Princípios orçamentários                    [revisão · 3ª]
  Direito Financeiro · peso 5 · vence hoje · última há 7 dias · 85% de acerto
  ████████░░  25min de 40min · 62%
```

E no bloco de acompanhamento, uma linha nova:

```
REVISÃO
18 tópicos vencem esta semana (4h30) · 6 atrasados há mais de 7 dias
▸ Mantendo este ritmo, você revisa tudo 2× antes da prova.
```

A última linha é a que decide alguma coisa: revisar tudo **duas vezes** antes
da prova é uma meta verificável, e o app já sabe calcular se ela cabe.

---

## 7. O risco que precisa estar escrito

**Revisão automática pode encher a agenda e sufocar o estudo novo.** Foi o que
a simulação do intervalo fixo mostrou: 30 revisões/dia e zero tópicos novos.

Por isso, na ordem: teto diário, compressão pelo prazo, e um aviso explícito
quando a revisão passar de 40% da semana —

> *A revisão está tomando 52% da sua semana. Com a prova em 11 dias, isso pode
> ser certo — você já cobriu 78% do edital. [ver o que ficou de fora]*

O app não decide por você; ele mostra o número que a decisão exige.

---

## 7-A. Multiplicador adaptativo — medido

Você propôs multiplicar o intervalo em vez de usar série fixa. Simulei os três
multiplicadores, 240 dias, com 80% de sessões boas, 15% normais e 5% ruins:

| multiplicador | cobriu | revisões | pico/dia | dias sem estudo novo |
|---|---|---|---|---|
| **×2,5 / ×1,5** | 232/232 | **1.684** | 27 | **0** |
| ×2,0 / ×1,5 | 232/232 | 2.233 | 30 | 3 |
| ×1,5 / ×1,2 | 232/232 | 3.531 | 38 | 8 |

O multiplicador **substitui a série fixa com vantagem**, e ×2,5 é melhor que
×2,0 — a diferença entre eles é de 549 revisões e 3 dias de estudo perdidos.
Adoto o seu desenho no lugar do meu.

Um efeito que não esperava: **com ×2,5 o teto quase deixa de ser necessário.**
Zero dias sem estudo novo, pico de 27 revisões. O espaçamento bem escolhido já
faz o trabalho que o teto faria à força.

## 7-B. O teto: onde ele ajuda e onde ele machuca

| teto | revisões feitas | fila atrasada (pico) | pendente no fim |
|---|---|---|---|
| 3h/dia | 1.659 | 153 | 0 |
| 1h30/dia | 1.415 | 209 | **0** |
| **4 tópicos/dia** | 956 | 222 | **127** |

O teto de 4 tópicos que você sugeriu **cria dívida permanente**: ao fim de 240
dias, 127 revisões continuam na fila e nunca aconteceram. É pior que não ter
teto, porque a pessoa acredita estar em dia.

Então: teto **em tempo, não em quantidade** (1h30 é suficiente), e ele é uma
rede de proteção — não o mecanismo principal. E precisa mostrar a fila:

> *Você está com 38 revisões atrasadas. No seu teto de 1h30, isso leva 6 dias
> para zerar. [aumentar o teto esta semana] [ver quais]*

Fila que cresce em silêncio é o mesmo problema que o app tem combatido desde o
começo.

## 7-C. O score de prioridade tem três armadilhas

`peso × dias sem revisar × taxa de erro` — testei com casos reais do seu edital:

| score | tópico |
|---|---|
| 21,0 | Restos a pagar (peso 5, 7 dias, 60% erro) |
| 18,0 | **Crase (peso 2, 90 dias, 10% erro)** |
| 18,0 | NBASP 9020 (peso 3, 120 dias, 5% erro) |
| 4,0 | LRF (peso 5, 2 dias, 40% erro) |
| **0,0** | **LRF (peso 5, 2 dias, 0% erro)** |
| **0,0** | **Tópico novo (peso 5, sem questões ainda)** |

1. **Acerto de 100% zera o score.** O tópico que você domina sai da fila para
   sempre e você o esquece antes da prova — exatamente o contrário do que a
   revisão espaçada existe para fazer.
2. **Sem questões o score é zero.** Tópico recém-estudado nunca entra.
3. **"Dias" cresce sem limite.** Crase com peso 2 esquecida há 90 dias supera
   LRF com peso 5. Na sua prova, isso troca o essencial pelo acessório.

**Correção — piso e teto:**

```
erro   = max(0,15, taxaDeErro)      // ninguém é imune; sem dados, 0,5
atraso = min(3, diasSemRevisar / 14) // o atraso satura em 3×
score  = peso × (1 + atraso) × (0,5 + erro)
```

Com isso a ordem passa a ser: Restos a pagar (8,3) → NBASP 9020 (7,8) →
tópico novo (5,4) → Crase (5,2) → LRF (5,1) → LRF dominado (3,7). O dominado
continua aparecendo, mais abaixo — que é o lugar dele.

## 7-D. Formato conforme a frequência

Sua ideia, e ela cai bem no que o app já tem:

| nível | formato sugerido | tempo | o que o app já tem |
|---|---|---|---|
| 1–2 (recente/difícil) | grifos do resumo + cartões | 15–20 min | leitura marcada, cartões do tópico |
| 3–4 (consolidando) | cartões + questões | 15 min | painel de cartões, estudo em tela |
| 5+ (dominado) | só bateria de questões | 10 min | registro de questões (fase Q1) |

O app **sugere** o formato na linha da agenda e já abre o material certo:
nível 1 abre o resumo no marcador; nível 5 abre direto o registro de questões.
Sugerir, não impor — o tempo é seu.

## 8. Ordem

| fase | entrega | esforço |
|---|---|---|
| **S1** | agendar no primeiro registro, multiplicador ×2,5 / ×1,5 / reset | meio dia |
| **S2** | compressão pelo prazo da prova + não agendar depois dela | meio dia |
| **S3** | nível sobe/desce pelo acerto (depende das questões, do outro plano) | meio dia |
| **S4** | teto em TEMPO (1h30) + aviso de fila atrasada | meio dia |
| **S6** | score de prioridade com piso e teto | 2 h |
| **S7** | formato sugerido por nível, abrindo o material certo | 2 h |
| **S5** | linha de revisão no acompanhamento, com a projeção de "2× antes da prova" | meio dia |

**S1 e S2 valem sozinhos** e já resolvem o problema que você descreveu. S3
depende do registro de questões (PLANO-desempenho-e-revisao.md, fase Q1).

---

## 9. Testes

| | regra |
|---|---|
| S-A | revisão nunca é agendada para depois da data da prova |
| S-B | com prazo curto, a série é comprimida e a última cai antes da véspera |
| S-C | errar desce um nível; nunca zera |
| S-D | revisão sem questão não passa do nível 3 |
| S-E | o teto diário é respeitado; o excedente escorrega mantendo a ordem |
| S-F | revisão atrasada > 7 dias volta a contar como estudo, não revisão |
| S-G | desfazer o registro devolve o SRS ao estado anterior |
| S-H | 232 tópicos em 180 dias não produzem um único dia com 0 tópicos novos |
| S-I | tópico com 100% de acerto continua aparecendo na fila, mais abaixo |
| S-J | tópico sem questões registradas entra na fila (score não é zero) |
| S-K | atraso satura: peso 2 esquecido não supera peso 5 recente |
| S-L | o teto não deixa dívida permanente — a fila zera no horizonte simulado |

S-H é a que me interessa mais: é a simulação da seção 1 virando teste. Se uma
mudança futura fizer as revisões sufocarem o estudo de novo, ela falha.
