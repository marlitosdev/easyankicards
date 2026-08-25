# Plano — "O que eu já estudei disto?"

Este documento **substitui** o desenho em duas rodadas de
`PLANO-vinculo-editais.md` (seções 3 e 6) e o mecanismo de
`PLANO-historico-entre-editais.md` (seção 5). As decisões sobre risco,
armazenamento e apresentação daqueles dois continuam valendo.

---

## 1. Por que o botão é melhor que comparar dois editais

Comparar TCE-PE (232 tópicos) com ISS Caruaru (133) são **30.856 combinações**.
Mas o que interessa não é o cruzamento dos dois editais — é o cruzamento entre
**o que você estudou** e o edital novo. Vínculo entre dois tópicos que você
nunca estudou não produz informação nenhuma.

| o que se compara | combinações | tamanho |
|---|---|---|
| edital × edital | 30.856 | — |
| 10 estudados × edital | 1.330 | **96% menor** |
| 40 estudados × edital | 5.320 | **83% menor** |
| 80 estudados × edital | 10.640 | 66% menor |

O prompt fica entre 143 e 213 linhas — cabe numa conversa só, sem lote, sem
rodada de disciplinas, sem "sobrados". **A rodada A e a rodada B desaparecem.**

E há um ganho que não é de tamanho: o custo cresce com o que você **estuda**,
não com o tamanho dos editais. No começo, quando você mais precisa saber o que
já viu, é quando o prompt é menor.

---

## 2. Uma regra que decide o desenho: a IA não vê datas

O prompt manda **o que** você estudou, nunca **quando**. A IA responde uma
coisa só: estes dois tópicos são o mesmo assunto?

O app calcula a recência sozinho, a partir do diário — que já guarda
`d` (data), `disc`, `n` (tópico), `p` (peso), `a` (estudado/revisado) e `cc`
(o concurso) em cada registro.

Três motivos:

- data é aritmética, e IA não deve fazer aritmética que o app faz certo;
- o prompt fica menor e a tarefa mais fácil, o que melhora a resposta;
- se você refizer a comparação em março, os vínculos de janeiro continuam
  valendo — porque eles nunca dependeram da data.

---

## 3. O fluxo, do clique à marca

Um botão na bancada do edital: **"O que eu já estudei disto?"**

```
1. clique          → o app monta o prompt:
                     · seus registros de estudo (todos os editais)
                     · os tópicos AINDA PENDENTES deste edital
2. copiar/colar    → a IA devolve os pares equivalentes
3. colar de volta  → conferência: ALTA marcada, MÉDIA desmarcada
4. aplicar         → viram marcas de histórico, não marcas de estudado
```

Três ações suas. É o mesmo ciclo do prompt do edital e do de cartões — nada
novo para aprender.

### O prompt

```
Abaixo estão assuntos que eu JÁ ESTUDEI (em outros concursos) e os tópicos
PENDENTES de um edital novo. Diga quais tratam do mesmo conteúdo.

REGRA DE OURO: na dúvida, NÃO relacione. Dizer que eu já estudei algo que eu
não estudei me faz pular um assunto na prova. Deixar de relacionar só me custa
repetir um estudo. Os dois erros não têm o mesmo tamanho.

RELACIONE quando for o mesmo assunto, ainda que o nome mude:
  "Improbidade administrativa" ≡ "Lei nº 8.429/1992"
  "Restos a pagar" ≡ "Inscrição de despesas não pagas no exercício"

NÃO RELACIONE:
  · recorte diferente da mesma matéria
    ("Licitações: Lei 14.133" ≠ "Licitações: modalidades")
  · norma de outro ente ("Lei Orgânica do TCE/PE" ≠ "Lei Orgânica do Município")
  · nome parecido, assunto outro
    ("Responsabilidade Civil" ≠ "Responsabilidade Civil do Estado")

Confiança: ALTA (mesmo conteúdo) ou MEDIA (equivale com ressalva).
Não devolva nada de confiança baixa. Não explique fora do formato.

FORMATO — uma linha por par:
~ <assunto estudado> :: <tópico do edital> :: ALTA :: por quê

JÁ ESTUDEI
- Direito Financeiro > Restos a pagar
- Direito Administrativo > Improbidade administrativa
...

PENDENTES EM "ISS Caruaru 2026"
- Finanças Públicas > Inscrição de despesas não pagas
- Direito Administrativo > Lei nº 8.429/1992
...
```

O `~` segue o padrão do app (`@` disciplina, `+` tópico), então a colagem passa
pela mesma bancada e pela mesma conferência que já existem.

---

## 4. O que a comparação de nomes ainda faz

Medi um comparador local contra o seu edital: acerta **1 de 7** equivalências
reais e o par de maior pontuação dele é errado ("Responsabilidade Civil" ≈
"Responsabilidade Civil do Estado"). Ele não serve para decidir.

Sobra-lhe **um** papel, seguro e útil: **igualdade exata do nome normalizado**
(sem acento, minúsculas, sem pontuação). Aí não há falso positivo possível — é
literalmente o mesmo nome. Isso é aplicado sozinho, sem IA e sem conferência,
e cobre o caso mais comum entre editais da mesma banca.

O botão então mostra, antes de qualquer prompt:

> 18 tópicos deste edital têm nome idêntico a assuntos que você já estudou.
> Outros 115 precisam da IA para comparar. [comparar agora] [depois]

---

## 5. O que a marca faz — e o que ela não faz

**Não marca como estudado.** O vínculo diz "equivale"; quem diz "eu sei isto"
é você. A marca informa e a agenda reage a ela — mas a decisão continua sua.

As seis marcas e as três faixas de tempo estão em
`PLANO-historico-entre-editais.md`, seção 2, e não mudam:

| ≤ 30 dias | pular |
| 31–90 dias | revisar, não reestudar (metade do tempo) |
| > 90 dias | conta como não estudado, mas avisa que há resumo e cartões |

---

## 6. Onde o botão fica

Na bancada do edital, ao lado dos outros três do mesmo ciclo:

```
[ Criar prompt para a IA organizar o edital ]
[ Diagnóstico do planejamento ]
[ Colar plano corrigido ]
[ O que eu já estudei disto? ]        ← novo
```

E o app o oferece sozinho **uma vez**, logo depois de colar um plano num edital
recém-criado — que é o momento em que a informação vale mais.

Enquanto o diário estiver vazio, o botão fica desligado com a explicação:
*"Marque alguns tópicos como estudados e este botão passa a comparar o que
você já viu com este edital."* Botão que existe mas não funciona sem dizer por
quê é pior que botão ausente.

---

## 7. Ordem — e ela ficou bem menor

> **Correção sua, aplicada.** A versão anterior deste plano aplicava a
> igualdade exata de nome sozinha, sem conferência. Estava errado: o mesmo
> nome em outra disciplina, ou de outro ente federativo, costuma ser outro
> assunto — "Controle interno e externo" num TCE e numa prefeitura cobram
> normas diferentes. Agora **nada é aplicado sozinho**: os idênticos entram
> numa triagem onde cada item nasce marcado como "perguntar à IA", e você
> escolhe item a item ou em bloco.

| fase | entrega | situação |
|---|---|---|
| **J1** | triagem dos nomes idênticos, sem aplicar nada | **feito (v8.74)** |
| **J2** | prompt + colagem + conferência (ALTA aplicada, MÉDIA só com confirmação) | **feito (v8.74)** |
| **J3** | `vkHistorico()` e a marca na linha da agenda | **feito (v8.74)** |
| **J4** | filtro de recência, com o aviso de quantos escondeu | 2 h |
| **J5** | resumo por disciplina ("4 aqui · 9 de outro concurso · 9 sem histórico") | 2 h |
| **J6** | "revisar em vez de estudar" na agenda | 2 h |

Contra as 9 fases dos dois planos anteriores. **J1 sozinho já entrega valor** e
não depende de IA nenhuma.

---

## 8. Testes

| | regra |
|---|---|
| J-A | o prompt só inclui tópicos PENDENTES do edital aberto — comparar o que já foi estudado aqui é desperdício e polui a conferência |
| J-B | igualdade exata nunca gera par entre nomes diferentes |
| J-C | a marca de histórico nasce só de vínculo confirmado, nunca de semelhança de nome |
| J-D | refazer a comparação não duplica vínculos existentes |
| J-E | a faixa de tempo vem da data do diário, não da data do vínculo |
| J-F | com o diário vazio, o botão fica desligado e explica por quê |
| J-G | apagar o edital de origem não deixa marca apontando para concurso inexistente |

J-D é a que evita o incômodo previsível: você vai apertar esse botão de novo
todo mês, e ele precisa acrescentar apenas o que é novo.
