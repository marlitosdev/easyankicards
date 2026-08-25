# Plano — "eu já estudei isso?"


> **Superado em parte.** O mecanismo de comparação descrito aqui (duas
> rodadas: disciplinas e depois tópicos) foi substituído pelo botão
> "O que eu já estudei disto?", em `PLANO-ja-estudei.md` — que compara o
> DIÁRIO com o edital em vez de dois editais inteiros, e é 83% menor.
> As decisões deste documento sobre **risco, armazenamento e apresentação**
> continuam valendo integralmente.
Pedido: ao começar um edital novo, não reestudar o que já foi estudado em outro
concurso. Marcas de histórico em cada tópico, alerta de assunto similar recente,
e um filtro para esconder o que foi visto há pouco tempo.

Documento de planejamento. Nada aqui foi implementado.

---

## 1. Antes de desenhar: dá para comparar sem IA?

Testei um comparador local (normalização, remoção de palavras vazias, radical
tosco, sobreposição de palavras) contra o **seu** edital do TCE-PE e contra
pares realistas de renomeação entre bancas.

### O que ele acha dentro do seu próprio edital

Os oito pares de maior pontuação, com contenção 1.00:

| par | veredito |
|---|---|
| Responsabilidade Civil → **Responsabilidade Civil do Estado** | **ERRADO** — matérias diferentes |
| Restos a pagar → Restos a pagar, créditos adicionais e estágios… | certo |
| Sistema Tributário Nacional → …na Constituição Federal | certo |
| Regimes contábeis: misto, de caixa… → Regimes de competência e de caixa | certo |
| Controle interno e externo → …da contabilidade pública | discutível |
| Princípios orçamentários → …e contábeis aplicados à administração | discutível |
| Controle de constitucionalidade → …exercido pelos Tribunais de Contas | discutível |
| Finanças Públicas na CF → Finanças públicas | certo |

**O par de MAIOR pontuação é o errado.** Abaixo desse patamar vira ruído puro:
"Receita Pública" ≈ "Despesa pública", "Lei de Responsabilidade Fiscal" ≈
"Responsabilidade Civil", "Medidas de tendência central" ≈ "Medidas de
dispersão".

### O que ele perde

Sete pares que são o mesmo assunto com nome de outra banca:

```
PERDE  Restos a pagar              ~ Inscrição e cancelamento de despesas não pagas
PERDE  Lei de Responsabilidade…    ~ LRF: limites de gastos e metas fiscais
PERDE  Princípios orçamentários    ~ Regras informadoras do orçamento público
PERDE  Atos Administrativos        ~ Ato administrativo: conceito, atributos e espécies
 pega  Concordância nominal…       ~ Concordância
PERDE  Improbidade administrativa  ~ Lei nº 8.429/1992
PERDE  Poderes Administrativos     ~ Poder de polícia, hierárquico e disciplinar
```

**Acerto: 1 de 7.** Com radical/stemming continua 1 de 7 — o problema não é
plural, é que bancas diferentes **usam palavras diferentes** para o mesmo
assunto, e "Improbidade administrativa" ≡ "Lei nº 8.429/1992" não tem uma
palavra em comum.

### Conclusão que decide o desenho

Comparação local **não pode ser o mecanismo**: perde 86% do que interessa e
erra com confiança máxima justamente onde erra. Ela sobrevive num papel só:
**igualdade exata do nome normalizado**, onde não há falso positivo possível.

Então: **a IA compara — uma vez, por par de editais. O app guarda o resultado.
Daí em diante tudo é local, instantâneo e funciona offline.** Você paga o custo
da IA no dia em que cadastra um edital novo, não todo dia.

---

## 2. As marcas de histórico

Vocabulário fechado — seis estados, e cada tópico está em exatamente um:

| marca | quando | cor |
|---|---|---|
| **sem histórico** | nunca estudado, aqui nem em outro edital | cinza |
| **estudado aqui** · 12/08 | marcado neste edital | verde claro |
| **revisado aqui** · 12/08 | revisado neste edital | verde escuro |
| **já visto** · TCE-PE · há 9 dias | vinculado, estudado em outro concurso há ≤ 30 dias | azul |
| **vale revisar** · TCE-PE · há 2 meses | vinculado, entre 31 e 90 dias | âmbar |
| **visto há muito** · TCE-PE · há 7 meses | vinculado, mais de 90 dias | cinza-azulado |

### Por que três faixas de tempo e não uma

Porque a decisão é diferente em cada uma, e é isso que você quer decidir:

- **≤ 30 dias** — pular. Reestudar é desperdício puro.
- **31 a 90 dias** — não reestudar do zero, mas **revisar**: entra na fila como
  revisão, com metade do tempo, exatamente como o app já trata a revisão
  vencida interna. É o caso mais comum entre dois concursos seguidos.
- **> 90 dias** — conta como não estudado para a cobertura, **mas** o tópico
  carrega o aviso de que existe material e cartões salvos daquele estudo. Não é
  "já sei", é "não começo do zero".

A terceira faixa é a que evita o pior erro possível deste recurso: marcar como
coberto algo que você estudou em fevereiro e não lembra mais.

---

## 3. Onde a marca aparece — e o que sai para caber

A linha da agenda hoje diz:

```
+ Finanças Públicas na CF
  Direito Financeiro · peso 5 · estudar primeiro · disciplina vale 15% da prova
```

"disciplina vale 15% da prova" é a informação mais fraca da linha: é da
disciplina, não do tópico, e já aparece no painel e no mapa das disciplinas.
Ela sai, e entra o histórico:

```
+ Finanças Públicas na CF
  Direito Financeiro · peso 5 · estudar primeiro · ↗ já visto no TCE-PE há 9 dias
```

No painel da disciplina, um resumo novo no topo:

```
Direito Financeiro · 22 tópicos
  4 estudados aqui · 9 já vistos em outro concurso · 9 sem histórico
```

Essa linha responde de relance a pergunta do seu pedido: **quanto desta matéria
eu já tenho de outro edital?**

---

## 4. O filtro

Na barra de "Buscar tópico", junto dos que já existem:

```
[ tudo ] [ só pendentes ] [ só prioridade alta ] [ só estudados ]
[ esconder o que já vi em outro concurso:  nunca | há 30d | há 60d | há 90d ]
```

E — mais importante — o mesmo filtro vale para a **agenda da semana**, com um
aviso quando ele está ativo:

> Escondendo 23 tópicos já vistos em outro concurso nos últimos 60 dias.
> [mostrar assim mesmo]

Filtro que esconde sem dizer que está escondendo é como se perde a confiança na
ferramenta. O aviso não é opcional.

---

## 5. Como o app sabe a data

Já sabe. Desde a v8.66 cada registro do diário guarda `cc` (o concurso), e
desde a v8.68 cada edital tem o seu `progresso` separado. O que falta é só a
ponte entre tópicos — os vínculos do `PLANO-vinculo-editais.md`.

```
vínculo (IA)  +  diário (data + concurso)  =  marca de histórico
```

Nenhuma estrutura nova além dos vínculos. É o mesmo motivo de guardar o
concurso em cada registro, que na época pareceu detalhe.

---

## 6. O alerta na hora certa

Duas situações, e são diferentes:

**Ao cadastrar um edital novo**, depois de colar o plano:

> Este edital tem 133 tópicos. Comparando com o TCE-PE, **41 deles você já
> estudou** — 12 nos últimos 30 dias.
> [comparar com a IA agora] [depois]

**Ao abrir a agenda do dia**, se algum item da semana tem histórico recente:

> 3 tópicos de hoje você já viu no TCE-PE nas últimas semanas.
> [pular estes] [revisar em vez de estudar] [estudar normalmente]

O segundo botão é o mais útil dos três e não existe em nenhum outro lugar do
app: converter um item da agenda de "estudo" para "revisão", com o tempo
reduzido, sem sair da tela.

---

## 7. O que NÃO fazer

- **Não marcar automaticamente como estudado.** O vínculo diz "equivale"; quem
  diz "eu sei isto" é você. A marca de histórico informa; ela não decide.
- **Não somar cobertura própria e emprestada num número só.** Já está no
  `PLANO-vinculo-editais.md` e vale repetir: na véspera da prova essas duas
  coisas não são a mesma.
- **Não usar o comparador local para vincular.** Os números da seção 1 dizem
  por quê. Ele fica só na igualdade exata e como gerador de candidatos para a
  IA conferir.

---

## 8. Ordem

Depende do `PLANO-vinculo-editais.md` (fases V1–V2), que cria os vínculos.

| fase | entrega | esforço |
|---|---|---|
| **H1** | função `historicoDoTopico(chave)` → marca + concurso + data + faixa | meio dia |
| **H2** | marca na agenda e na lista, trocando "disciplina vale X%" | meio dia |
| **H3** | resumo por disciplina ("4 aqui · 9 de outro concurso · 9 sem histórico") | 2 h |
| **H4** | filtro de recência na busca e na agenda, com o aviso de quantos escondeu | meio dia |
| **H5** | alerta ao cadastrar edital novo, com a contagem | 2 h |
| **H6** | "revisar em vez de estudar" na agenda: converte o item, reduz o tempo | meio dia |

H1 primeiro porque as outras cinco são apresentações da mesma função.

---

## 9. Testes

| | regra |
|---|---|
| Hi-A | tópico sem vínculo e sem estudo é sempre "sem histórico" — nunca herda marca por semelhança de nome |
| Hi-B | a faixa de tempo é calculada da data do registro, não da data do vínculo |
| Hi-C | desfazer o vínculo devolve o tópico a "sem histórico", sem apagar o diário |
| Hi-D | o filtro de recência esconde e **diz quantos** escondeu |
| Hi-E | "revisar em vez de estudar" reduz o tempo do item e o registra como revisão, não como estudo |
| Hi-F | apagar o edital de origem não deixa marca apontando para concurso inexistente |

Hi-A é a que impede o comparador local de voltar pela porta dos fundos: marca
de histórico só nasce de vínculo confirmado, nunca de palpite.
