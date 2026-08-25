# Plano — o painel de acompanhamento

Avaliação pedida sobre a tela de "Ritmo semanal" + o painel de progresso.
Os números abaixo saíram de uma simulação do seu edital real (17 disciplinas,
232 tópicos, prova em 30/08, 60 h/semana), não de suposição.

---

## 1. O problema não é poluição visual. É que o número em destaque é inútil.

A barra mais comprida e mais colorida da tela é **"PARA COBRIR TUDO —
163h30 · 232 tópicos/semana"**. Ela é calculada assim:

```
minutos de todos os tópicos pendentes ÷ semanas até a prova
```

Com a prova em 13 dias, isso é a aritmética de estudar 232 tópicos em uma
semana. Rodei o **mesmo edital** mudando só a data da prova:

| prova em | "para cobrir tudo" diz |
|---|---|
| 13 dias | **164 h/semana** |
| 6 meses | **5 h/semana** |

O número não descreve o seu estudo — descreve a distância até a prova. E ele
aparece **três vezes** na mesma tela: na barra, no rótulo à direita, e de novo
por extenso na caixa âmbar ("Cobrir tudo pediria 164h por semana").

Enquanto isso, a informação que decide — **onde você chega no ritmo real** —
já existe calculada no código (`alcance`, em `ritmoDoPlano`) e **nunca é
mostrada**.

---

## 2. Inventário da duplicação

| informação | aparece em |
|---|---|
| "cobrir tudo pede N h/semana" | barra 1 + rótulo + caixa âmbar = **3×** |
| "esta semana: 82 tópicos · 59h45" | topo do painel + cabeçalho da agenda = **2×** |
| progresso | `0/232 tópicos · 0%` **e** `0% do peso`, lado a lado = 4 números para 2 fatos |
| lista de tópicos | aba "Lista completa" + agenda + modal da disciplina = **3×** |

O caso do progresso merece nota: hoje os dois estão em 0% e parecem redundantes,
mas eles **divergem** assim que você estuda — 40% dos tópicos pode ser 12% do
peso. O erro não é mostrar os dois; é mostrá-los com o mesmo tamanho, quando
só um decide aprovação.

---

## 3. A régua está invertida

O painel lidera com **contagem de tópicos** (`0/232`) e trata **peso** como
acessório em letra menor. É o contrário do que você mesmo estabeleceu quando
pediu o dashboard: *"não adianta estudar todos os tópicos sem focar naqueles de
maior peso"*.

---

## 4. Escopo: respondendo diretamente

**O painel é de UM edital — o aberto. A agenda logo acima é de TODOS.** E nada
na tela diz isso.

Hoje isso passa porque você tem um edital só. Com dois, a tela mostra "82
tópicos" em cima (somando os concursos) e "0/232" embaixo (só um), com o mesmo
ar de verdade e sem rótulo que distinga. É o mesmo defeito das duas agendas,
esperando para acontecer de novo.

### Com dois ou mais editais, o formato precisa mudar

Não basta um seletor de escopo. Com dois concursos, a pergunta muda de
*"quanto já cobri?"* para **"estou abandonando um deles?"** — e essa pergunta
pede uma linha por edital:

```
                    dias    peso coberto      ritmo      projeção na prova
TCE-PE · Auditor      13   ███░░░░░  11%    6h/sem      → 19% do peso
TCU · AUFC           289   █░░░░░░░   4%    2h/sem      → 71% do peso
```

Aqui a coluna que importa é a última. Ela mostra sozinha que o TCE-PE está
perdido e o TCU está tranquilo — o que nenhum dos dois painéis atuais diz.

---

## 5. "Lista completa": manter, mas não como aba

Ela mostra 232 linhas com nome, disciplina, prioridade, horas e caixa de marcar.
Cada uma dessas colunas já existe na agenda ou no modal da disciplina.

O que ela tem de **próprio**, e que se perderia:

- ver o edital inteiro de uma vez, fora da ordem de prioridade;
- **marcar em lote** — quem já estudou meio edital antes de cadastrar precisa
  disso, e clicar 100 vezes na agenda é inviável;
- achar um tópico pelo nome.

Recomendação: deixa de ser aba de mesmo nível do painel e vira **"Buscar
tópico"**, com campo de busca e filtros (só pendentes, só alta, por
disciplina). Aba sugere "duas visões equivalentes"; e elas não são —
uma é o acompanhamento, a outra é uma ferramenta de manutenção.

---

## 6. A proposta: um bloco, três linhas

Substitui **os dois blocos** (ritmo + progresso) por um só.

```
┌ ACOMPANHAMENTO ────────────────── [ todos os editais | só TCE-PE ] ┐
│                                                                    │
│  COBERTURA DA PROVA (por peso)                                     │
│  ███████░░░░░░░░░░░░░░░░░░░░░░░░  11% estudado · 4% revisado       │
│  27 de 232 tópicos · faltam 13 dias                                │
│                                                                    │
│  SEU RITMO                                                         │
│  fez 6h30/sem (média de 2 semanas) · meta 60h · agenda pede 59h45  │
│                                                                    │
│  ▸ Mantendo 6h30 por semana, você chega a 19% do peso em 30/08.    │
│    Com as 60h da sua meta, chegaria a 78%.                         │
│                                                                    │
│  ⚠ 150 tópicos não cabem no prazo (35% do peso). Ver quais.        │
└────────────────────────────────────────────────────────────────────┘
```

Cinco decisões, com o porquê:

1. **"Para cobrir tudo" sai da posição de destaque.** Vira uma linha de aviso
   no rodapé do bloco, que é o seu papel: alerta, não meta.
2. **A projeção entra e vira a frase principal.** É a única linha da tela que
   responde *"vale a pena manter este ritmo?"*. O cálculo já existe.
3. **Peso lidera; contagem de tópicos vira legenda.** Uma barra só, empilhada:
   revisado (verde escuro) + estudado (verde claro) + intocado (cinza).
4. **O escopo fica escrito na tela**, no mesmo controle da agenda — e com dois
   editais ele ganha a tabela comparativa do item 4.
5. **Sem registro de estudo, a linha do ritmo diz o que fazer** ("registre duas
   sessões e esta linha aparece"), em vez de mostrar "0min · nada registrado"
   em três lugares.

---

## 7. Ordem

| fase | entrega | situação |
|---|---|---|
| **H1** | fundir ritmo + progresso num bloco; peso na frente; tirar as 3 repetições | **feito (v8.71)** |
| **H2** | a frase de projeção na tela | **feito (v8.71)** |
| **H3** | escopo escrito no bloco ("deste edital: X") | **feito (v8.72)** |
| **H4** | tabela comparativa quando houver 2+ editais ativos | **feito (v8.72)** |
| **H5** | "Lista completa" vira "Buscar tópico" com filtros e marcação em lote | **feito (v8.72)** |

### Correção de rumo no H3

O plano previa um *seletor* de escopo ("todos os editais / só este") igual ao da
agenda. Ao implementar ficou claro que a versão "todos" não existe: somar a
cobertura de dois concursos produz um número que não corresponde a nada —
ninguém presta uma prova média. O que o escopo "todos" quer dizer é a **tabela
comparativa**, que já é o H4. Então o H3 virou o que faltava de verdade: o
**rótulo** dizendo de qual edital são os números, sempre visível.

H1 e H2 juntos: separar não faz sentido, porque o espaço que a projeção precisa
é exatamente o que as repetições ocupam hoje.

---

## 8. Testes que nascem daqui

| | regra |
|---|---|
| H-A | nenhuma informação aparece em dois blocos da mesma tela (é o teste que faltou nas duas agendas) |
| H-B | a projeção só aparece com registro suficiente; sem registro, aparece a instrução |
| H-C | trocar o escopo muda **todos** os números do bloco, não só a barra |
| H-D | com 2 editais, a soma das linhas da tabela bate com o número do escopo "todos" |
| H-E | "cobrir tudo" nunca é apresentado como meta alcançável quando excede a meta declarada |

H-A é a que impede a duplicação de voltar: hoje ela não existe, e foi por isso
que duas "Agenda da semana" conviveram por duas versões sem ninguém notar.
