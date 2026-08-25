# Plano — questões, revisão espaçada e o resto do acompanhamento

Roteiro do que você listou. Já implementado nesta versão (8.91): horas em
destaque no diário, filtros de período, busca e paginação, e a barra
por tópico na agenda. O que segue é o restante.

---

## 0. O que muda no dado, antes de tudo

Quase tudo aqui cabe **no registro do diário**, que hoje guarda
`{d, c, n, disc, p, m, f, hu, a, cc, fase}`. Três campos novos resolvem a
maior parte:

```js
q:  { feitas: 20, certas: 17, min: 24 }   // questões da sessão
err: ["pegadinha", "teoria"]              // por que errou
srs: { nivel: 2, prox: "2026-09-02" }     // revisão espaçada
```

Nenhuma estrutura nova. Isso importa: o diário já entra no backup, já é
carimbado na virada do edital, e já sobrevive a tópico que sai do plano.

---

## 1. Questões: acerto, velocidade e caderno de erros

### 1.1 Onde entra

Na mesma janela de registro que já pergunta minutos, formas e humor —
**depois** de você escolher a forma "questões". Perguntar sobre questões
numa sessão de videoaula é atrito puro.

```
Você resolveu questões?
   feitas [ 20 ]   certas [ 17 ]      → 85% · 1min12 por questão

Errou por quê? (marque o que houve)
   [teoria que faltou] [pegadinha da banca] [desatenção] [lei mudou]
```

### 1.2 O que isso passa a responder

- **acerto por tópico**, que é diferente de acerto geral: 85% em Princípios
  Orçamentários e 40% em Restos a Pagar dizem onde voltar;
- **velocidade**, que na prova é restrição real — 1min12 por questão numa
  prova de 2min disponíveis é folga; 3min é reprovação por tempo;
- **por que errou**, que decide o remédio: "teoria que faltou" manda reler,
  "pegadinha" manda resolver mais questões da banca, "desatenção" não manda
  estudar nada.

### 1.3 Onde aparece

- na linha do tópico na agenda: `85% em 20 questões · 1min12 cada`;
- no panorama da disciplina, ordenando por **pior acerto**, que é a
  pergunta real: *o que está furado?*;
- um alerta quando acerto < 60% com 10+ questões: esse tópico não está
  estudado, está visitado.

**Cuidado que vale registrar:** acerto com 3 questões não é acerto, é ruído.
Nada abaixo de 10 questões deve gerar alerta ou entrar em ranking.

---

## 2. Revisão espaçada de verdade

### 2.1 O problema de hoje

O app já distingue "estudou" de "revisou", mas a revisão **não é agendada**:
ela só aparece se você lembrar de voltar. É por isso que o painel mostra
"0 revisões" — não é falta de registro, é falta de gatilho.

### 2.2 O gatilho

Ao marcar um tópico como estudado, o app agenda a próxima revisão:

| nível | quando | quando sobe de nível |
|---|---|---|
| 1 | +24 h | você revisa e acerta ≥ 80% |
| 2 | +7 dias | idem |
| 3 | +30 dias | idem |
| 4 | +90 dias | idem |

Errar (< 60%) **volta um nível**, não zera: zerar depois de meses de estudo
é desanimador e não corresponde ao que se perdeu.

### 2.3 Como isso conversa com a agenda

A agenda já mistura estudo novo e revisão por prioridade. Revisão vencida
entra **na frente** — ela custa 15 minutos hoje e 40 se você deixar vencer
mais. E a prova manda no calendário: com a prova em 13 dias, revisão de
+90 dias não faz sentido e deve ser puxada para caber.

### 2.4 O risco

Revisão automática enche a agenda. Com 232 tópicos, marcar 30 gera 30
revisões em 24h — e no dia seguinte a agenda vira só revisão. **Teto
diário** de revisões, e o que não coube escorrega, sempre priorizando o que
vence antes e pesa mais.

---

## 3. Mídia da sessão

Já existe (`formas`: leitura, videoaula, questões, resumo, mapa, revisão).
Falta **usar**: o diário registra e ninguém lê. Duas telas resolvem:

- no acompanhamento: *"nesta semana, 70% do seu tempo foi leitura e 8%
  questões"* — desequilíbrio que a maioria não percebe sozinha;
- por tópico: *"3h de leitura, 0 questões"* diz que aquele tópico está
  estudado no papel e não testado.

---

## 4. Progresso por disciplina

Já existe no panorama (`% da prova`, intocados). Falta a **barra na lista de
disciplinas**, com as três parcelas que o app já sabe calcular: estudado,
revisado, intocado — por PESO, não por contagem de tópicos.

---

## 5. Diário: edição rápida e ações em lote

- **editar duração e tipo** direto na linha, sem apagar e refazer;
- **desfazer o último registro** (o erro mais comum é clicar no tópico
  errado da agenda);
- **selecionar vários** para apagar ou reclassificar de uma vez.

Regra que não muda: apagar registro **não** desfaz o progresso do tópico,
salvo quando é o último daquele tópico — comportamento que já existe e está
descrito na própria tela.

---

## 6. Cronômetro na linha da agenda

Um botão ▶ em cada item que começa a contar. Ao parar, abre o registro
**com os minutos já preenchidos** — que é o ponto: hoje você estima o tempo
de memória, e estimativa de memória infla.

Detalhes que decidem se presta:
- sobreviver a recarregar a página (guardar o início, não o acumulado);
- um cronômetro por vez, com aviso ao trocar de tópico;
- Pomodoro é opcional e vem depois: o cronômetro simples já resolve o
  problema principal, que é medir em vez de chutar.

---

## 7. Ordem sugerida

| fase | entrega | por quê |
|---|---|---|
| **Q1** | questões (feitas/certas/tempo) no registro + acerto por tópico | é a métrica que mais muda decisão |
| **Q2** | caderno de erros com os quatro motivos | separa "estudar mais" de "prestar atenção" |
| **R1** | agendamento automático da revisão, com teto diário | tira o "0 revisões" da tela |
| **R2** | nível sobe/desce por desempenho | revisão que não olha o acerto é calendário, não memória |
| **U1** | cronômetro na linha da agenda | mede em vez de estimar |
| **U2** | edição rápida e lote no diário | conserta o erro de clique |
| **M1** | mídia da sessão no acompanhamento | mostra o desequilíbrio leitura × questões |
| **P1** | barra por disciplina, por peso | fecha o painel de cobertura |

**Q1 e R1 valem sozinhos.** Os outros dependem de um deles para ter dado.

---

## 8. Testes que nascem daqui

| | regra |
|---|---|
| D-A | acerto abaixo de 10 questões nunca gera alerta nem entra em ranking |
| D-B | tempo por questão vem do tempo da sessão de questões, não da sessão inteira |
| D-C | revisão agendada nunca ultrapassa o teto diário; o que sobra escorrega |
| D-D | errar baixa um nível, não zera |
| D-E | revisão de +90 dias não é agendada além da data da prova |
| D-F | cronômetro sobrevive a recarregar a página |
| D-G | editar a duração de um registro não muda o progresso do tópico |
| D-H | apagar registro em lote respeita a mesma regra do apagar um |

D-B é a que costuma passar batido: somar o tempo todo da sessão e dividir
pelas questões dá um número que parece medida e não é.
