# Plano — barra lateral de modos e Edital verticalizado

Documento de planejamento. Nada aqui foi implementado ainda.

Decisões tomadas: o painel direito entrega **tabela exportável, ordem priorizada,
distribuição de horas e marcação de progresso**; o peso do tópico **herda da
disciplina** e o usuário ajusta só o que importa; os dois modos ficam
**independentes** por enquanto.

---

## 1. A barra lateral é um roteador, não um menu

O ponto que decide se isso envelhece bem: a barra não pode ser um `if` gigante.
Ela é um registro de modos, e acrescentar um modo novo é acrescentar uma entrada
mais uma seção — sem tocar em nada do que já existe.

```js
/* modos.js — o registro. Um modo novo entra aqui e em uma <section>. */
const MODOS = [
  { id: "cartoes", icone: "🗂", rotulo: "flashcards_modo" },
  { id: "edital",  icone: "📋", rotulo: "edital_modo" },
  // futuros modos entram aqui
];
```

No HTML, cada modo é uma seção irmã, e só uma fica visível:

```html
<nav class="barra-modos" id="barraModos"></nav>
<section data-modo="cartoes"> …tudo que existe hoje, sem mudança… </section>
<section data-modo="edital" hidden> …novo… </section>
```

Três regras que evitam dor depois:

- **O modo atual fica em `localStorage` (`eac_modo`)** — reabrir o app volta onde
  você estava, como já acontece com o texto e a bandeja.
- **Cada modo tem seu próprio prefixo de armazenamento**: `eac_edital_texto`,
  `eac_edital_progresso`. Nada compartilhado por acidente.
- **Trocar de modo não recarrega a página.** O texto dos cartões continua no
  editor, intacto, quando você volta.

No celular a barra lateral não cabe: abaixo de 760px ela vira uma fileira de
abas no topo, com o mesmo registro alimentando as duas formas.

---

## 2. Arquivos novos, arquivos intocados

`app.js` já tem cerca de 3.400 linhas. Deixar o edital entrar nele é o erro mais
fácil de cometer e o mais caro de desfazer.

| arquivo | papel | testável em Node? |
|---|---|---|
| `docs/edital.js` | lê o texto do edital, calcula pesos e prioridades | **sim**, como `parser.js` |
| `docs/edital-ui.js` | a tela do modo edital | via DOM simulado |
| `docs/modos.js` | registro e troca de modo | via DOM simulado |
| `docs/app.js`, `docs/parser.js`, `docs/anki.js` | **não mudam** | — |

A regra de ouro do projeto continua valendo: lógica de negócio separada da tela,
textos visíveis só em `i18n.js`, com paridade pt/en.

---

## 3. O texto é a fonte da verdade (de novo)

Mesma escolha dos flashcards, pelo mesmo motivo: o usuário edita, cola, corrige e
leva para outro lugar. O formato canônico:

```
# Direito Constitucional :: 3
- Princípios fundamentais
- Direitos e garantias fundamentais :: 2
-- Direitos individuais e coletivos
-- Remédios constitucionais :: 3
# Língua Portuguesa :: 2
- Compreensão e interpretação de textos
- Ortografia oficial
```

- `#` abre uma **disciplina**; `:: N` é o peso dela (o que o edital dá: peso da
  prova, número de questões).
- `-`, `--`, `---` são **tópicos** e o nível vem da quantidade de traços.
- `:: N` em qualquer linha é opcional. Sem ele, o tópico é **neutro** — que é
  exatamente a decisão de "herda da disciplina e ajusta só o que importa".

Ajustar um peso na tela **reescreve a linha no texto**, como a edição de título
faz hoje nos cartões. Sem estado escondido.

---

## 4. O que se cola de verdade, e as correções

Edital real não vem assim. Vem assim:

```
CONHECIMENTOS BÁSICOS
LÍNGUA PORTUGUESA: 1 Compreensão e interpretação de textos. 2 Tipologia textual.
3 Ortografia oficial. 4 Acentuação gráfica.
DIREITO CONSTITUCIONAL: 1 Dos princípios fundamentais. 2 Dos direitos e garantias
fundamentais: 2.1 Direitos individuais e coletivos...
```

Daí a lista de correções automáticas, cada uma com detector, conserto e
idempotência — o mesmo desenho que já está de pé nos cartões:

| correção | o que resolve |
|---|---|
| separar tópicos numerados | "1 Compreensão… 2 Tipologia…" numa linha só vira uma linha por tópico |
| reconhecer hierarquia | `2.1`, `2.1.1` viram `--`, `---` |
| disciplina em CAIXA ALTA | `LÍNGUA PORTUGUESA:` vira `# Língua Portuguesa` |
| descartar cabeçalho | "CONHECIMENTOS BÁSICOS" não é disciplina |
| juntar linha quebrada | PDF quebra o tópico no meio da frase |
| peso ausente | aponta a disciplina sem `:: N` e pede o número |

E o que **não** dá para consertar sozinho vira **prompt de correção**, com as
mesmas âncoras `@@ N` e a mesma conferência da colagem de volta. Esse mecanismo
já está pronto e testado; reaproveitar é quase de graça.

---

## 5. Como o peso vira prioridade

```
prioridade(tópico) = peso(disciplina) × peso(tópico)
```

Com o peso do tópico neutro em 1, a prioridade de um tópico não ajustado é o
próprio peso da disciplina — que é o comportamento esperado de "herda".

Na tela a prioridade aparece **normalizada de 0 a 100** (o maior valor do edital
vira 100). Número absoluto não diz nada; posição relativa diz.

**Distribuição de horas**: você informa horas por semana, e cada tópico recebe

```
horas(tópico) = horas_semana × prioridade(tópico) / soma(todas as prioridades)
```

Com um piso configurável (padrão 15 min) para nenhum tópico sumir do plano.

---

## 5b. Prompts de peso — o que a IA responde e como se confere

Preencher peso à mão em 300 tópicos ninguém faz. A IA faz, mas só é útil se a
resposta voltar **verificável**. A lição das âncoras `@@ N` vale aqui, levada um
passo adiante.

### Dois prompts, escopos diferentes

| prompt | escopo | onde fica o botão |
|---|---|---|
| **Pesar disciplinas** | todas as disciplinas do edital | acima da tabela, uma vez |
| **Priorizar dentro da disciplina** | os tópicos de UMA disciplina | no cabeçalho de cada disciplina |

O segundo é o principal. Vinte tópicos de uma disciplina cabem folgado em
qualquer IA e a resposta é boa; trezentos de uma vez enchem o limite do Gemini
Notebook e a qualidade despenca no meio da lista. Além disso, dá para iterar:
pesar Constitucional hoje, Português amanhã, sem refazer o resto.

### O truque: a IA não devolve texto, devolve um mapa

O prompt numera os tópicos e pede **só a numeração de volta**:

```
CONTEXTO: FGV · Analista Judiciário · TJ-RJ · 2025

DISCIPLINA: Direito Constitucional (peso 3 no edital)

TÓPICOS:
T1  Princípios fundamentais
T2  Direitos e garantias fundamentais
T3  Direitos individuais e coletivos
T4  Remédios constitucionais
T5  Organização do Estado

Responda SOMENTE a lista de pesos, uma linha por tópico, no formato:
T1 :: 3 | motivo em até 10 palavras

Peso 1 = raramente cobrado · 5 = cai em quase toda prova.
Use a incidência histórica desta banca para este cargo. Não reescreva os
tópicos, não acrescente nem remova nenhum, não pule números.
```

Resposta esperada:

```
T1 :: 2 | conceitual, cai pouco e de forma direta
T4 :: 5 | remédios aparecem em quase toda prova da FGV
```

**Por que assim.** O texto do tópico nunca sai do app, então não há como voltar
corrompido, resumido ou reescrito — o problema que custou três versões no lado
dos cartões. O que volta é número para número. A conferência é aritmética:

| verificação | reação |
|---|---|
| todo `T` enviado voltou? | os que faltarem ficam com o peso que tinham |
| voltou `T` que não existe? | ignorado, com aviso |
| peso fora de 1–5 ou não numérico | linha recusada, com aviso |
| resposta sem nenhum `T` reconhecível | recusa tudo, texto intacto |

O motivo depois do `|` é opcional e não afeta o cálculo — vira uma coluna
"por quê" na tabela, que é o que permite discordar da IA com base.

### O peso de disciplina usa o mesmo desenho

```
DISCIPLINAS DO EDITAL (com o peso oficial, quando há):
D1  Língua Portuguesa — 10 questões
D2  Direito Constitucional — 15 questões
D3  Direito Administrativo — sem indicação

Responda SOMENTE: D1 :: 2 | motivo
```

Quando o edital já dá peso ou número de questões, o prompt manda esse dado e
pede à IA que **respeite o oficial** e só desempate o que estiver em branco.
Peso inventado por cima de peso oficial é erro, não ajuda.

### Como isso conversa com "herda e ajusta"

A decisão continua a mesma — o que muda é o ponto de partida. Sem IA, todo
tópico nasce neutro e você sobe o que importa. Com a IA, ele nasce com a
sugestão dela, marcada como **sugerido** na tela; quando você mexe no valor, a
marca some e vira **seu**. Assim dá para ver de relance o que você conferiu e o
que ainda está no chute da máquina.

E o peso continua sendo escrito no texto como `:: N`. Nada de estado paralelo.

---

## 6. O painel direito

Uma tabela agrupada por disciplina, ordenável por prioridade:

| | tópico | peso | prioridade | horas | ✓ |
|---|---|---|---|---|---|
| Direito Constitucional (peso 3) ||||||
| | Remédios constitucionais | 3 | **100** | 2h30 | ☐ |
| | Direitos e garantias | 2 | 67 | 1h40 | ☑ |
| | Princípios fundamentais | 1 | 33 | 50min | ☐ |

- **Ordem priorizada**: alternar entre "agrupado por disciplina" e "corrido, do
  mais para o menos relevante".
- **Progresso**: a caixa guarda no navegador. A chave é
  `disciplina|tópico` normalizado — **não** o número da linha. Essa lição custou
  caro na revisão dos cartões: chave por linha se perde na primeira edição.
- **Exportar**: copiar a tabela, baixar `.csv` (planilha) ou `.txt` (caderno).

---

## 7. Ordem de construção

Cada fase é publicável sozinha e não quebra o que existe.

| fase | entrega | risco |
|---|---|---|
| **F1** | barra lateral + roteador + modo Edital vazio | baixo — nada do que existe muda de lugar |
| **F2** | `edital.js` + painel esquerdo com análise e correções | médio — é onde mora a bagunça do texto real |
| **F3** | painel direito: tabela e ordem priorizada | baixo |
| **F4** | pesos ajustáveis na tela, horas, progresso | médio — reescrever o texto ao ajustar peso |
| **F5** | prompts de peso (disciplina e tópicos) + colagem conferida | médio — é a parte com IA, mas o mapa `T1 :: 3` reduz muito o risco |
| **F6** | exportações `.csv` / `.txt` / copiar | baixo |

Publicar a F1 sozinha vale a pena: ela prova que a troca de modo não estraga
nada antes de existir código novo para culpar.

---

## 8. Testes — o que já serve e o que falta

Aproveita direto:

- `tests/estrutura.js` — precisa ganhar os painéis novos na lista de ninhos, e
  passa a garantir que cada seção de modo fica onde deve.
- `tests/fumaca.js` — carrega os arquivos novos junto; o seletor mínimo que
  acabou de ser ensinado já cobre tela em lista.
- `tests/rodar.js` — ganha `tests/casos-edital/` com editais reais colados.

Invariantes do modo edital, no mesmo espírito das I1–I6:

| | regra |
|---|---|
| E1 | ler um edital nunca quebra o app |
| E2 | nenhuma correção pode **perder disciplina ou tópico** |
| E3 | corrigir duas vezes = corrigir uma vez |
| E4 | texto → estrutura → texto não muda nada |
| E5 | soma das horas distribuídas = horas informadas (com arredondamento controlado) |
| E6 | colar peso da IA **nunca altera o texto de um tópico** — só o número depois de `::` |
| E7 | tópico cujo `T` não voltou mantém o peso que tinha |

E2 é a que mais importa: é a versão editalística do bug que apagava cartões.
E6 é a que fecha a porta do outro: enquanto a IA só devolver números, ela não
tem como estragar o conteúdo.

---

## 9. Armadilhas que já conhecemos

- **Não deixar `edital.js` importar de `parser.js`.** A tentação é reaproveitar
  `hasDelim` e amigos. Um `::` no edital não significa a mesma coisa que num
  cartão; acoplar os dois faz uma mudança em cartões quebrar editais.
- **Prefixar todo `localStorage`** com `eac_edital_`. Hoje há oito chaves sem
  namespace; duas colidindo seria um bug difícil de enxergar.
- **A barra lateral não pode virar depósito.** Cada modo precisa justificar uma
  entrada permanente na tela. Se um dia forem seis, viram menu suspenso.
- **Não deixar a IA escrever no texto do edital.** A tentação será pedir o
  edital inteiro reescrito com os pesos embutidos. É o caminho curto que já
  custou caro nos cartões: conteúdo volta resumido, e ninguém percebe. O mapa
  `T1 :: 3` existe justamente para tirar essa possibilidade da mesa.
- **Peso zero.** Disciplina com peso 0 (eliminatória mas sem pontos) zera a
  prioridade de todos os seus tópicos e some do plano. Tratar explicitamente:
  peso 0 vale como "só eliminatória" e recebe piso próprio.
