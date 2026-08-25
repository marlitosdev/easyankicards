# Plano — formato de exportação e painel de estudos no celular

Documento de planejamento. Nada aqui foi implementado.

Inspirado no `painel_estudos_TCE-PE.html` que você mandou. Uma observação sobre
ele, antes de tudo: aquele arquivo salva o progresso em `window.storage`, que é
uma API do ambiente onde ele foi gerado. **Como arquivo solto no celular ele
abre, mas não guarda nada** — os riscos marcados somem ao fechar. É exatamente o
problema que este documento resolve.

---

## 1. Um formato, várias saídas

A tentação é escrever um exportador para cada destino. O caminho certo é o
contrário: **um formato de intercâmbio**, e todo o resto é uma renderização dele.

```
                    plano.json
                        │
      ┌─────────┬───────┼───────┬──────────┐
      ▼         ▼       ▼       ▼          ▼
   painel     .csv     .md    .txt    voltar para o app
  (celular) (planilha) (Notion) (papel)   (reimportar)
```

Se um destino novo aparecer amanhã — Google Agenda, Trello, o que for — ele lê
`plano.json` e pronto. E o mais importante: **o painel do celular devolve o
`plano.json` de volta**, com o progresso dentro. O ciclo fecha.

---

## 2. O formato: `plano-estudo/1`

```json
{
  "app": "EasyAnkiCards",
  "formato": "plano-estudo/1",
  "gerado": "2026-08-09T22:30:00Z",
  "concurso": {
    "nome": "TCE-PE",
    "cargo": "Auditor de Controle Externo — Contas Públicas",
    "banca": "FGV",
    "prova": "2026-08-30"
  },
  "config": { "horasSemana": 12, "pisoMinutos": 15 },

  "disciplinas": [
    {
      "id": "d1",
      "nome": "Auditoria Governamental",
      "peso": 3,
      "grupo": "Módulo III — Específicos",
      "topicos": [
        {
          "id": "d1t1",
          "nome": "Achado de auditoria",
          "nivel": 1,
          "peso": 5,
          "motivo": "cai em quase toda prova da FGV",
          "prioridade": 100,
          "horasSemana": 2.5,
          "feito": false,
          "revisado": false
        }
      ]
    }
  ],

  "semanas": [
    {
      "id": "w1",
      "inicio": "2026-07-10",
      "fim": "2026-07-16",
      "titulo": "Auditoria Governamental + Controle Externo",
      "tarefas": [
        { "id": "w1-1", "topico": "d1t1", "rotulo": "Achado de auditoria", "horas": 2.5 }
      ]
    }
  ]
}
```

Quatro decisões que sustentam isso:

- **`formato` versionado.** Um leitor futuro sabe o que está lendo. Campo novo
  que ele não conhece é ignorado; campo que falta ganha padrão. É o que permite
  o painel antigo abrir um plano novo sem quebrar.
- **`id` estável e legível** (`d1t1`), não índice de posição. Reordenar
  disciplinas não pode embaralhar o progresso — é a mesma lição da chave por
  linha que se perdeu na revisão dos cartões.
- **`prioridade` e `horasSemana` vão calculados**, não como fórmula. O painel do
  celular não precisa saber a regra; ele mostra o que recebeu.
- **`feito`/`revisado` moram no mesmo arquivo.** O plano e o progresso não se
  separam — separados, um dia um dos dois se perde.

As semanas saem de: data da prova + horas por semana + prioridade. O app monta o
cronograma; você ajusta o que quiser antes de exportar.

---

## 3. O painel do celular — como não perder o progresso

Aqui está o ponto crítico, e ele tem uma resposta clara.

### O que NÃO funciona

**Arquivo `.html` solto, aberto do Downloads.** É a solução que parece óbvia e é
a que falha:

| plataforma | o que acontece |
|---|---|
| iPhone / Safari | `file://` não guarda dados de forma confiável; a cada abertura pode vir zerado |
| Android / Chrome | funciona, mas cada arquivo é uma "ilha"; renomear ou mover perde tudo |
| qualquer um | não dá para "adicionar à tela inicial" de verdade |

Serve para **ler** o plano. Não serve para **acompanhar** o plano.

### O que funciona

**O painel hospedado, no mesmo endereço do app, aberto pelo link e adicionado à
tela inicial.**

```
marlitosdev.github.io/easyankicards/painel.html#p=<plano comprimido>
```

1. O app gera o link com o plano comprimido no fim do endereço (depois do `#`,
   que nunca vai para servidor nenhum — fica só no seu aparelho).
2. Você abre o link no celular. O painel lê o plano, guarda em `localStorage` e
   **limpa o `#` do endereço**.
3. "Adicionar à tela inicial". A partir daí é um ícone como qualquer app.
4. O painel pede `navigator.storage.persist()` — e para app adicionado à tela
   inicial o Chrome costuma conceder sem perguntar.
5. Um service worker guarda o painel para funcionar **sem internet**.

Por que isso resolve: os dados ficam sob um endereço estável e permanente, não
sob um arquivo que você pode mover. É a mesma base do EasyAnkiCards instalado —
que, com o `persist()` da fase P1, passa a ser confiável também.

**Compressão**: um edital de 300 tópicos dá uns 40 KB de JSON. Com
`CompressionStream('gzip')` cai para 5–8 KB em base64, que cabe folgado num
endereço. Acima disso, o app oferece o caminho do arquivo: baixar
`plano.json` e abrir pelo botão "Carregar plano" do painel.

### E mesmo assim: backup

Nenhum armazenamento de navegador é eterno. O painel tem, no rodapé:

- **Baixar progresso** → `plano.json` atualizado, com o que você já marcou.
- **Carregar plano** → restaura de um `.json`, seja backup ou plano novo.
- **"último backup há N dias"** quando passar de duas semanas.

Esse `.json` é o que você leva de volta para o EasyAnkiCards no computador — e o
que salva se trocar de celular.

---

## 4. O que o painel mostra

Seguindo o seu arquivo de referência, que acertou a estrutura:

| bloco | conteúdo | de onde vem |
|---|---|---|
| Topo | dias até a prova, barra de progresso | `concurso.prova`, contagem de `feito` |
| **Semana** | as tarefas da semana atual, expansíveis | `semanas[]` |
| **Cobertura** | disciplinas por grupo/módulo, quanto já foi | `disciplinas[]` agrupadas por `grupo` |
| **Prioridades** | tópicos ordenados por `prioridade`, com o "por quê" | `topicos[]` |
| Rodapé | baixar progresso, carregar plano | — |

Três coisas do seu arquivo que valem manter, e uma para mudar:

**Manter** — a semana atual aberta por padrão (você abre e já sabe o que fazer
hoje); o "N dias até a prova" no topo, que é o número que move; e as abas, que
evitam rolagem infinita no celular.

**Mudar** — a data "hoje" está fixa no código (`dayjs('2026-07-12')`). Precisa
ser a data real do aparelho, senão a semana atual congela.

---

## 5. As outras saídas

### `.csv` — planilha

```csv
Módulo;Disciplina;Peso disc.;Tópico;Nível;Peso tóp.;Prioridade;Horas/sem;Feito;Por quê
Módulo III;Auditoria Governamental;3;Achado de auditoria;1;5;100;2,5;não;cai em quase toda prova
```

Ponto e vírgula e vírgula decimal — é o que o Excel em português abre com dois
cliques, sem assistente de importação. Detalhe pequeno que decide se a pessoa usa
ou desiste.

### `.md` — Notion, Obsidian

```markdown
## Auditoria Governamental · peso 3
- [ ] **Achado de auditoria** — prioridade 100 · 2h30/sem
      _cai em quase toda prova da FGV_
```

Caixas de tarefa em markdown funcionam nos dois, e o negrito/itálico sobrevive à
colagem.

### `.txt` — papel

O mesmo formato canônico do editor (`# Disciplina :: 3`), para reabrir no app ou
imprimir. É o formato que não depende de nada.

---

## 6. Ordem de construção

| fase | entrega | depende de |
|---|---|---|
| **X1** | `plano.json` (gerar e reimportar) | edital F3 |
| **X2** | `.csv` e `.md` | X1 |
| **X3** | `painel.html` hospedado, lendo o plano do `#` | X1 |
| **X4** | painel: progresso, `persist()`, service worker, offline | X3 |
| **X5** | painel: baixar progresso / carregar plano | X4 |
| **X6** | reimportar o progresso do painel no app | X5, X1 |

**X1 é o alicerce.** Enquanto o formato não estiver fechado, cada saída
construída é retrabalho garantido.

---

## 7. Testes

| | regra |
|---|---|
| X-A | `plano.json` exportado e reimportado devolve o mesmo estado — ida e volta sem perda |
| X-B | plano com campo desconhecido abre; plano sem campo opcional abre com padrão |
| X-C | soma de `horasSemana` de todos os tópicos = `config.horasSemana` (com folga de arredondamento) |
| X-D | todo `tarefa.topico` aponta para um `topico.id` que existe |
| X-E | o painel abre um plano gerado por versão anterior do formato |

X-D é a que pega o erro silencioso: tarefa órfã no cronograma não aparece na
tela e ninguém percebe que sumiu.

---

## 8. Duas armadilhas

- **Não deixar o painel virar um segundo editor.** Ele marca progresso e mostra
  o plano. Editar peso, reordenar, acrescentar tópico — isso é no app. Painel que
  edita vira duas fontes da verdade, e um dia elas divergem.
- **`#` e não `?`.** O plano vai depois do `#` porque essa parte do endereço
  nunca é enviada ao servidor. Com `?`, o edital inteiro apareceria nos registros
  do GitHub Pages.
