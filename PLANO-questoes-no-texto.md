# Questões que já estão escritas no resumo

## O problema

Boa parte do material já vem em forma de questão:

```
**Questão 2 (Cebraspe - Procurador):** A vedação de inscrição em restos a pagar
para emendas impositivas em nível estadual é válida como controle fiscal?

* **Resposta: Não.** O modelo federal prevê a possibilidade de inscrição para
  cumprimento do mínimo da saúde. Estados seguem por simetria (ADI 7493).
```

Lendo isso, a resposta está à vista antes da pergunta terminar de ser lida.
Não há teste nenhum — há leitura. O trabalho de gerar questões pela IA
existe para resolver isto, mas é trabalho desnecessário quando a questão
**já está escrita**: falta só escondê-la e deixá-la respondível.

## O que foi medido

Protótipo do detector rodado contra os quatro exemplos reais:

| | resultado |
|---|---|
| blocos detectados | 4 de 4 |
| tipo certo (CE / ME) | 4 de 4 |
| gabarito certo | 4 de 4 (Sim→C, Não→E, "B."→B) |
| opções extraídas da linha corrida | 3 de 3 |
| falsos positivos nas duas linhas-isca | 0 |

Uma falha encontrada: **o que está entre parênteses nem sempre é banca**.
"(FGV - Juiz)" é banca e cargo, mas "(Questão de Pegadinha)" e
"(FGV - Adaptada)" não são. O detector não vai adivinhar — guarda o
parêntese inteiro como rótulo e deixa a banca para confirmação.

## A forma proposta

Três peças independentes. Cada uma útil sozinha.

### D1 — o detector (`matQuestoesNoTexto`)

Função pura, sem tela e sem gravação. Devolve os blocos encontrados com
linha de início, linha da resposta, tipo, opções, gabarito e comentário.

Reconhece:
- cabeçalho `Questão N (rótulo):`, com ou sem negrito, com ou sem número;
- opções `A) … B) … C) …` na mesma linha **ou** em linhas separadas;
- resposta em `Resposta:` ou `Gabarito:`, precedida ou não de `-`/`*`;
- gabarito por letra (`B.`) ou por palavra (`Sim`, `Não`, `Certo`, `Errado`).

Conservador de propósito: **exige o par** cabeçalho + resposta. Um deles
sozinho não vira questão. É o que manteve zero falso positivo no teste.

### D2 — modo prova na leitura

Um botão no topo do resumo, ao lado de "recolher dicas": **modo prova**.
Desligado, o resumo é o de hoje, sem nenhuma mudança. Ligado, cada bloco
detectado vira respondível na própria leitura:

- o enunciado fica como está;
- as opções viram botões (ou Certo/Errado, se for CE);
- a resposta e o comentário **somem** até você escolher;
- escolhida a resposta, aparece o gabarito com a certa em verde;
- o **comentário fica recolhido**, atrás de um clique — decidido assim para
  dar para passar rápido por muitas questões sem parar para ler cada
  explicação, e abrir só a das que importam.

A escolha do botão fica lembrada por resumo, como a das dicas.

**O texto não é alterado.** Isto é só desenho — nada é reescrito, nada é
gravado. Desligar o modo prova devolve o resumo exatamente como estava.

### D3 — importar para o banco

Botão **"importar questões do texto"**, que abre a mesma conferência das
questões geradas pela IA: mostra o que entendeu, o que recusou e por quê, e
só grava depois do seu aval, com desfazer.

Serve para o que o modo prova não faz: histórico de acertos, aparecer na
aba Questões, misturar com as de outros tópicos, filtrar por banca. É aqui
que você confirma a banca, já que o parêntese pode não ser uma.

Importar **não duplica** o que a IA já tiver gerado do mesmo trecho: a
comparação por enunciado normalizado já existe (`qsIgual`).

## Por que separado em três

O modo prova responde ao pedido imediato e não toca em nada — risco quase
zero, vale para todos os resumos que você já tem, sem migração.

A importação é o caminho para as estatísticas, mas mexe no banco, então
pede conferência. Amarrar as duas coisas obrigaria a importar 200 questões
para poder esconder um gabarito.

## O que fica de fora, e por quê

- **Não reescrevo o resumo** para o formato canônico `?>` / `>>`. Seria mais
  simples de renderizar, mas altera um texto que é seu, em massa, com base
  numa detecção que pode errar.
- **Não detecto questão sem marcador explícito** (frase terminada em "?"
  seguida de um parágrafo) — decisão confirmada. Material didático é cheio
  de pergunta retórica seguida de explicação: ligaria falso positivo em
  cima de texto que se quer ler corrido. Se aparecer material seu num
  formato diferente que ficou de fora, o caminho é me mandar o exemplo e
  ampliar com caso concreto, em vez de alargar por suposição.

## Risco principal

Um bloco mal detectado esconde texto que você queria ler. Mitigação: o modo
prova é um botão, não um padrão; e o contador diz quantos blocos foram
encontrados antes de você ligar ("modo prova — 4 questões neste resumo").

## Ordem de execução

1. D1 detector + testes contra os quatro exemplos reais e contra iscas
2. D2 modo prova (desenho e resposta na leitura)
3. D3 importação com conferência e desfazer
