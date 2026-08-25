# Plano — vincular tópicos entre editais


> **Superado em parte.** O mecanismo de comparação descrito aqui (duas
> rodadas: disciplinas e depois tópicos) foi substituído pelo botão
> "O que eu já estudei disto?", em `PLANO-ja-estudei.md` — que compara o
> DIÁRIO com o edital em vez de dois editais inteiros, e é 83% menor.
> As decisões deste documento sobre **risco, armazenamento e apresentação**
> continuam valendo integralmente.
Pedido: comparar dois editais e ligar os tópicos equivalentes, de modo que
estudar num conte no outro. A ligação é proposta por uma IA, via prompt, e só
para tópicos **iguais ou muito próximos**.

Documento de planejamento. Nada aqui foi implementado.

---

## 1. Por que isto vale mais do que parece

Você tem TCE-PE (232 tópicos) e ISS Caruaru (133). Direito Financeiro, Controle
Externo e Português aparecem nos dois. Hoje, estudar "Restos a pagar" para o
TCE-PE deixa o mesmo tópico do ISS marcado como intocado — e a cobertura do
segundo edital mente para baixo, o que faz o painel recomendar horas onde elas
não são necessárias.

É o inverso do defeito que já corrigimos (progresso vazando entre editais).
Aqui o problema é progresso **não** fluindo onde deveria.

---

## 2. A decisão que define tudo: o que "vincular" significa

Três desenhos possíveis, e a escolha muda o risco:

| | como funciona | risco |
|---|---|---|
| **A. Cópia** | marcar em A grava a marca em B | se o vínculo estiver errado, B fica com progresso falso e ninguém percebe |
| **B. Referência** | B mostra "estudado via TCE-PE em 12/08" | nada é copiado; desfazer o vínculo devolve tudo ao lugar |
| **C. Sugestão** | B mostra "você estudou o equivalente; marcar aqui também?" | mais cliques, mas nenhuma decisão automática |

**Eu escolheria B.** O motivo é o mesmo que fez "duplicar edital" não copiar
progresso: marca de estudado é afirmação sobre o que você fez, e uma afirmação
derivada precisa continuar sabendo que é derivada. Com B:

- o painel de cobertura conta o tópico como estudado (é o que você quer);
- a linha na agenda diz **de onde veio**, e não some se você desfizer;
- desvincular não apaga nada, porque nada foi escrito.

C fica como opção para quem preferir confirmar caso a caso — um interruptor,
não um segundo sistema.

---

## 3. O prompt

O app já tem seis prompts no mesmo padrão, com REGRA DE OURO. Este recebe os
dois editais e devolve só os pares.

```
Você vai comparar dois editais de concurso e identificar SOMENTE os tópicos
que tratam do mesmo conteúdo.

REGRA DE OURO: na dúvida, NÃO vincule. Um vínculo errado faz a pessoa deixar
de estudar um assunto que ela não estudou. Um vínculo faltando só custa um
pouco de trabalho repetido. Os dois erros não têm o mesmo tamanho.

VINCULE quando:
- o assunto é o mesmo, ainda que o nome mude
  ("Restos a pagar" ≡ "Restos a pagar e despesas de exercícios anteriores")
- um é claramente subconjunto do outro E cobre a maior parte dele

NÃO VINCULE quando:
- é a mesma disciplina mas recorte diferente
  ("Licitações: Lei 14.133" ≠ "Licitações: modalidades")
- a norma de referência é outra (lei estadual de PE ≠ lei municipal)
- é o mesmo nome com aplicação diferente
  ("Controle externo" no TCE ≠ "Controle interno" na prefeitura)

Para cada par devolva a confiança: ALTA (mesmo conteúdo) ou MEDIA (equivalente
com ressalva). Não devolva pares de confiança baixa.

FORMATO (uma linha por par, nada além disso):
~ disciplina A > tópico A :: disciplina B > tópico B :: ALTA :: por quê

EDITAL 1 — {nome}
{texto}

EDITAL 2 — {nome}
{texto}
```

O `~` como marcador segue o padrão do app (`@` disciplina, `+` tópico) e permite
colar a resposta na mesma bancada, com a mesma conferência.

---

## 4. Armazenamento

```js
eac_vinculos = [
  { a: "e1", ta: "direito financeiro›restos a pagar",
    b: "e2", tb: "financas publicas›restos a pagar",
    conf: "ALTA", por: "mesma matéria e mesma norma",
    criado: "2026-08-16T...", origem: "ia" }
]
```

Regras:

- **simétrico**: o vínculo vale nos dois sentidos, mas é gravado uma vez só;
- **um tópico pode ter vários vínculos** (três editais com o mesmo assunto);
- **não é transitivo por conta própria**: se A↔B e B↔C, o app mostra A↔C como
  *sugestão*, nunca como fato. Encadear equivalências aproximadas é como o
  vínculo errado se espalha.

Entra no backup junto com os editais.

---

## 5. O que aparece na tela

Na agenda e na lista de tópicos, o tópico coberto por vínculo ganha um selo:

```
+ Restos a pagar          Direito Financeiro · peso 5     ↗ TCE-PE · 12/08
```

Clicar no selo abre: *"Você marcou 'Restos a pagar' no TCE-PE em 12/08.
Este tópico conta como estudado aqui. [ver o vínculo] [desfazer]"*.

No painel de acompanhamento, uma linha a mais na cobertura:

```
COBERTURA DA PROVA (por peso)
████████░░░░░░  18% estudado — 11% aqui, 7% aproveitado do TCE-PE
```

**Separar as duas parcelas é obrigatório.** Cobertura emprestada e cobertura
própria não são a mesma coisa na véspera da prova, e juntá-las num número só
recria exatamente o problema que este projeto passou as últimas versões
desfazendo.

---

## 6. A conferência antes de aplicar

Mesmo caminho do "colar plano corrigido", que já funciona assim:

```
34 vínculos propostos · 28 de confiança ALTA, 6 MÉDIA

▸ Restos a pagar → Restos a pagar                        ALTA   ✓
▸ Licitações e Contratos → Licitações: modalidades       MÉDIA  ✗ (desmarcado)
▸ Lei Orgânica do TCE/PE → Lei Orgânica do Município     MÉDIA  ✗ (desmarcado)

[aplicar os 28 marcados]   [rever um a um]
```

**MÉDIA vem desmarcada por padrão.** Se o app marcasse tudo, a revisão viraria
o gesto de apertar "aplicar", e a distinção de confiança não serviria para nada.

---

## 7. O risco que precisa estar escrito na tela

Um vínculo errado faz você **deixar de estudar um assunto que não estudou**, e
o erro só aparece na prova. Por isso:

- o selo de vínculo é sempre visível, nunca silencioso;
- a cobertura mostra as duas parcelas separadas;
- há um lugar único ("Vínculos entre editais") que lista todos e permite
  desfazer em lote;
- desfazer não apaga nada — só para de contar.

---

## 8. Ordem

| fase | entrega | esforço |
|---|---|---|
| **V1** | prompt + colagem + conferência com ALTA/MÉDIA | 1 dia |
| **V2** | armazenamento e a cobertura contando vínculo, com as parcelas separadas | meio dia |
| **V3** | selo na agenda e na lista, com "de onde veio" | meio dia |
| **V4** | tela "Vínculos entre editais": listar, filtrar, desfazer em lote | meio dia |
| **V5** | sugestão transitiva (A↔B, B↔C ⇒ propor A↔C), sempre como proposta | opcional |

---

## 9. Testes que nascem daqui

| | regra |
|---|---|
| V-A | vínculo é simétrico: contar a partir de A e de B dá o mesmo resultado |
| V-B | desfazer um vínculo devolve a cobertura exatamente ao valor anterior |
| V-C | a cobertura própria e a emprestada nunca são somadas num número só na tela |
| V-D | apagar um edital não deixa vínculo apontando para o que não existe |
| V-E | vínculo de confiança MÉDIA nunca entra sem marcação explícita |
| V-F | A↔B e B↔C não produzem A↔C automaticamente |

V-D é a que costuma passar despercebida: o vínculo órfão continua contando
cobertura de um edital que já não existe.
