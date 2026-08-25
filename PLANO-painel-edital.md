# Plano — painel do edital

Documento de planejamento. Nada aqui foi implementado.

Escrito depois de ler o `edital-priorizado.csv` real (TCE-PE, 231 tópicos, 17
disciplinas). Os números abaixo são desse arquivo, não hipóteses.

---

## 1. O problema não é só visual

A queixa foi "bagunçado, um monte de texto". É verdade, mas trocar a tabela por
um painel bonito esconderia dois defeitos de fundo que o CSV revelou:

### 1.1 A prioridade quase não separa nada

As 17 disciplinas vieram **todas com peso 3** — a IA usou o padrão em cada uma.
Como a prioridade é `peso da disciplina × peso do tópico`, a disciplina saiu da
conta e sobrou só o peso do tópico, que tem cinco valores:

```
prioridade 100:  67 tópicos
prioridade  80:  81 tópicos
prioridade  60:  74 tópicos
prioridade  40:   9 tópicos
```

Uma lista de 231 itens com quatro valores distintos não é uma priorização; é
um empate geral. Nenhum painel conserta isso — o dado é que está achatado.

### 1.2 O plano pede 77 horas por semana

Todos os 231 tópicos receberam exatamente 20 minutos: o piso. `231 × 20 min =
4.620 min = 77 h/semana`, contra as 10 a 12 horas informadas. **O modelo está
errado**, e o erro é meu: distribuir o orçamento semanal entre *todos* os
tópicos só faz sentido com vinte ou trinta. Com 231, o resultado é impossível
e o número não significa nada.

O teste `I-E5b` chegou a fixar esse comportamento como correto ("o piso estoura
o orçamento de propósito"). Era honesto e inútil: um plano que ninguém pode
cumprir não informa nada.

---

## 2. O modelo certo: fila ao longo das semanas

Com 231 tópicos e 12 h/semana, não se estuda tudo toda semana. Estuda-se **uma
fatia por semana, na ordem da prioridade, até a prova**.

```
orçamento total = semanas até a prova × horas por semana
```

O app enche semana a semana, em ordem de prioridade, respeitando um tempo
mínimo por tópico. Três consequências que a tela precisa mostrar:

- **Cabe tudo?** Se a soma dos tópicos passar do orçamento total, o app diz com
  todas as letras quantos ficam de fora — e quais. Hoje ele finge que cabe.
- **Esta semana** vira a pergunta principal: 6 a 10 tópicos, não 231.
- **Sobra folga?** Se sobrar tempo, entram as revisões dos tópicos já feitos.

O tempo por tópico deixa de ser proporcional ao peso e passa a ser um valor
por faixa (alta 60 min, média 45, baixa 30) — proporção com 231 itens gera
números sem sentido, e ninguém estuda "8 min de Direito Civil".

---

## 3. O painel

Três blocos, do mais urgente ao mais geral. O texto corrido some.

### 3.1 Topo — a barra que responde "e agora?"

```
TCE-PE · Auditor          ▓▓▓▓▓░░░░░░░░░░  18%      63 dias · 9 semanas
                          41 de 231 tópicos          esta semana: 12 h · 8 tópicos
```

### 3.2 Esta semana — a lista curta

Os tópicos da semana atual, com caixa de marcar, tempo sugerido e a disciplina.
É a tela que se abre de manhã. Oito linhas, não 231.

### 3.3 Disciplinas — cartões, não tabela

Um cartão por disciplina, em grade. Cada um traz:

- nome e **peso editável ali mesmo** (clicar no número, escolher de 1 a 5);
- anel ou barra de progresso (`7 de 26`);
- três contadores por faixa de prioridade, com cor: `● 12 alta · ● 9 média · ● 5 baixa`;
- clicar abre a lista de tópicos daquela disciplina.

Grade fechada = visão geral em uma tela. Grade aberta = a tabela de hoje, mas
dentro do contexto certo.

### 3.4 Cores

Três faixas, e só três. Cor **e** rótulo, nunca cor sozinha — um em doze homens
não distingue vermelho de verde.

| faixa | prioridade | cor | tempo/semana |
|---|---|---|---|
| Alta | 80–100 | vermelho | 60 min |
| Média | 50–79 | âmbar | 45 min |
| Baixa | < 50 | cinza-azulado | 30 min |

---

## 4. O plano MORA no app

Correção de rumo importante: o planejamento do edital não é um rascunho a
caminho de um `.csv`. **É onde o estudo é acompanhado**, aberto todo dia,
atualizado a cada tópico concluído. Exportar continua existindo, mas como
conveniência — levar para uma planilha, mostrar para alguém — e não como
destino.

Isso tem uma consequência incômoda e inevitável: hoje o plano viveria no
`localStorage`, o mesmo lugar que já apagou 137 cartões, e o diagnóstico
mostrou `permanente: NÃO` na sua máquina. Para o edital o risco é maior, não
menor: cartões perdidos se refazem colando o texto de novo; **meses de
progresso marcado, não.**

Enquanto não houver gravação em pasta, três medidas mínimas:

- o histórico de versões passa a valer para o edital, com as mesmas 12 cópias;
- o `.json` do plano (texto + progresso + config) baixável em um clique, com
  aviso discreto quando passar de duas semanas sem backup;
- `navigator.storage.persist()` — já entrou na v8.52 — e o estado dele visível
  na tela do edital, não só no diagnóstico.

## 4.1 Planos com nome

Hoje existe **um** edital, em `eac_edital_texto`. Vira uma lista:

```js
eac_planos = [
  { id: "p1", nome: "Plano TCE-PE · Auditor", texto: "...",
    progresso: {...}, criado: "...", tocado: "..." },
]
eac_plano_atual = "p1"
```

Na barra da bancada, um seletor com o nome do plano, mais **Novo**, **Renomear**
e **Duplicar**. Duplicar importa: mudar de cargo costuma ser o mesmo edital com
pesos diferentes, e refazer tudo à mão é o que faz a pessoa desistir.

Cada plano guarda o seu progresso. Trocar de plano não mexe no outro — a mesma
regra dos modos.

---

## 5. Consertos no dado, antes do painel

Painel sobre dado achatado é gráfico bonito que não ajuda a decidir.

- **Detector "todas as disciplinas com o mesmo peso"**, avisando que a
  diferenciação não aconteceu e oferecendo o caminho: ajustar na tela ou pedir
  à IA de novo.
- **Prompt revisado**: exigir que o peso da disciplina venha do **número de
  questões na prova**, com instrução explícita de que usar 3 em todas é sinal
  de que a tarefa não foi feita. Pedir também o número de questões, quando o
  edital trouxer.
- **Faixa de prioridade contínua**: com pesos 1–5 nos dois lados há 25
  combinações, mas hoje elas colapsam em poucos valores. Vale considerar um
  desempate por posição no edital (o que vem primeiro costuma ser básico).

---

## 6. Ordem de construção

| fase | entrega | por quê primeiro |
|---|---|---|
| **D1** | modelo de fila por semanas + "cabe/não cabe" | sem isto os números do painel continuam mentindo |
| **D2** | detector de pesos iguais + prompt revisado | painel sobre dado achatado não decide nada |
| **D3** | painel: topo + Esta semana | é a pergunta que se faz de manhã |
| **D4** | cartões por disciplina, com peso editável | resolve "organização por matéria" |
| **D5** | planos com nome, duplicar e trocar | o plano mora aqui: precisa de identidade |
| **D5b** | backup `.json` do plano + aviso de "sem backup há N dias" | progresso de meses não pode viver só no localStorage |
| **D6** | filtros (só pendentes, só alta) e busca | conforto, não necessidade |

**D1 antes de qualquer pixel.** Trocar a tabela por cartões agora só deixaria
mais bonito o "20 min" que aparece 231 vezes.

---

## 7. Testes que nascem daqui

| | regra |
|---|---|
| D-A | a soma das horas planejadas nunca passa de `semanas × horas/semana` |
| D-B | se os tópicos não couberem, o app diz quantos ficam de fora — e o número confere |
| D-C | tópico marcado como feito sai da fila e não volta na semana seguinte |
| D-D | trocar de plano não altera o texto nem o progresso do outro |
| D-G | backup `.json` exportado e restaurado devolve o mesmo plano e o mesmo progresso |
| D-E | mudar o peso de uma disciplina na tela reescreve o texto, e reler o texto devolve o mesmo peso |
| D-F | edital com todas as disciplinas no mesmo peso acende o detector |

D-E é a que sustenta a edição pela interface: enquanto texto e tela puderem
divergir, uma das duas está mentindo.
