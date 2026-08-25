# Plano — revisão, resumos, sincronização e a identidade do plano

Documento de planejamento. Nada aqui foi implementado.

---

## 1. O painel de topo é redundante — e a redundância é perigosa

Hoje a mesma informação aparece duas vezes:

```
topo:      ESTUDADO 0/232 tópicos · 0% · 0% do peso    REVISADO 0/232 · 0% · 0% do peso
cobertura: (o que o plano anterior propõe) barra empilhada com estudado/revisado/intocado
```

Não é só desperdício de espaço. **Dois lugares que mostram o mesmo número acabam
discordando** — foi exatamente o que aconteceu com as horas por semana, quando o
campo e o controle deslizante brigavam, e com o diário mostrando zero enquanto o
contador mostrava oito. Quando divergem, o usuário não tem como saber qual está
certo, e passa a não confiar em nenhum dos dois.

### O que eu faria

O topo fica com o que só ele tem: **identidade e tempo**.

```
TCE-PE · Auditor de Controle Externo          63 dias · 9 semanas até a prova
▓▓▓▓▓░░░░░░░░░░░░░░░░░░░░░░░  11% da prova coberta
```

Uma barra só, na régua que decide — **peso**, não contagem de tópicos. Os quatro
números vão para o painel *Ritmo e cobertura*, onde ficam ao lado do que os
explica. A contagem de tópicos vira legenda da barra, não protagonista.

---

## 2. Revisão automática

### O que existe hoje

Um prazo fixo: sete dias depois de estudado, o tópico volta à fila como revisão
vencida, com metade do tempo. Um degrau só, e ele não sabe se você já revisou
aquilo três vezes ou nenhuma.

### O que fazer

Escada de intervalos por tópico, com o degrau subindo a cada revisão concluída:

| revisão | intervalo desde a anterior |
|---|---|
| 1ª | 1 dia |
| 2ª | 7 dias |
| 3ª | 21 dias |
| 4ª em diante | 60 dias |

Guardado por tópico: `{ n: 2, ultima: "2026-08-14", proxima: "2026-09-04" }`.
Registrar uma revisão faz `n++` e recalcula `proxima`. Nada de algoritmo com
fator de facilidade — isso é o que o Anki faz bem, e fazer pela metade seria
pior que não fazer.

**A divisão de trabalho entre os dois modos precisa estar escrita na tela:**

- o **edital** decide *o que abrir hoje* — assunto, no nível do tópico;
- o **Anki** decide *que cartão mostrar agora* — memória, no nível da frase.

Sem essa frase, o usuário vai perguntar por que existem duas revisões.

### Onde aparece

No painel de ritmo, uma linha nova: **"Revisões de hoje: 4"**, e elas já entram
na frente da fila da semana (o comportamento atual, mantido). Se as revisões
vencidas passarem de 20% da semana, um aviso: *"acumulou revisão; considere uma
semana só de revisar"*.

---

## 3. Resumos: o terceiro modo ganha função

O modo **Resumos** existe na barra lateral como esqueleto desde a v8.47. Ele é o
lugar natural para isto, e a ligação resolve as duas pontas de uma vez.

### Como funciona

- Cada tópico e cada disciplina ganha um botão **📄 Resumo** — na agenda, na
  janela da disciplina e na lista de tópicos.
- Vazio por padrão. Clicar abre um editor simples, salva ao fechar.
- O botão muda de aparência quando há resumo: `📄` vazio, `📄•` com conteúdo.

### O índice

```js
eac_resumos = {
  "direito financeiro›receita pública": {
    texto: "...", criado: "...", tocado: "...", plano: "p1"
  }
}
```

A chave é a mesma do progresso (`disciplina›tópico`), então resumo e progresso
andam juntos sem tabela de ligação.

### O que isso desbloqueia — e é aqui que o app fecha o ciclo

1. **Resumo → cartões.** Um botão "virar cartões" manda o resumo para a bancada
   de cartões, já dentro do prompt de geração, com a disciplina como tag.
2. **Revisão com material.** Hoje "revisar" é uma marca sem conteúdo; com
   resumo, a revisão tem o que ler.
3. **Resumo vindo da IA.** O prompt do modo Resumos recebe o nome do tópico e o
   peso, e devolve um resumo no formato do app — mesmo caminho do edital.

O grafo fica: **edital decide o assunto → resumo guarda o conteúdo → cartões
fixam a memória.** Cada modo com um papel, ligados pela mesma chave.

---

## 4. Identidade: para qual edital foi aquele estudo

Hoje o diário anota tópico, disciplina, peso, minutos e forma — mas não **para
qual concurso**. Com um plano só isso não incomoda; com dois, os registros se
misturam e as estatísticas mentem.

### O que muda

Isto depende dos **planos com nome** (fase D5 do plano do edital), e é a razão
para tirar D5 da fila de trás:

```js
eac_planos = [{ id: "p1", nome: "TCE-PE · Auditor", texto, progresso, criado }]
eac_plano_atual = "p1"
```

Cada registro do diário passa a levar `plano: "p1"`, **preenchido sozinho** com
o plano aberto no momento — o usuário não escolhe nada, mas pode trocar depois,
no próprio diário, se estudou pensando em outro concurso.

Com isso o diário responde perguntas que hoje não sabe:

- *quanto estudei para o TCE-PE este mês?*
- *Direito Financeiro que estudei para o TCU conta para o TCE-PE?* — conta, e o
  app pode oferecer: "você já estudou este tópico no plano TCU, há 12 dias.
  Marcar como estudado aqui também?"

Essa última é o argumento mais forte a favor de guardar o plano no registro:
**reaproveitar estudo entre concursos**, que é o que a pessoa realmente faz.

---

## 5. Sincronização e backup

Aqui preciso ser direto sobre uma coisa: hoje **todo o seu material vive em
`localStorage`**, e este projeto já perdeu 137 cartões exatamente assim. O
edital é pior, porque meses de progresso marcado não se refazem colando texto.

### Um formato, quatro níveis

Tudo começa por um arquivo único e versionado:

```json
{
  "app": "EasyAnkiCards",
  "formato": "backup/1",
  "gerado": "2026-08-16T10:00:00Z",
  "versao_app": "8.63.1",
  "cartoes": { "texto": "...", "bandeja": [...], "revisados": {...} },
  "planos": [{ "id": "p1", "nome": "...", "texto": "...", "progresso": {...} }],
  "diario": [...],
  "resumos": {...},
  "preferencias": { "tema": "dark", "lang": "pt", ... }
}
```

| nível | o que é | onde funciona | esforço |
|---|---|---|---|
| **0** | o que já existe: `persist()` + 12 versões do texto | tudo | feito |
| **1** | **backup manual**: baixar e restaurar este `.json` | tudo, inclusive celular | meio dia |
| **2** | **pasta conectada**: grava sozinho a cada mudança | Chrome/Edge no PC; app de desktop | 1–2 dias |
| **3** | **sincronização entre aparelhos** | pasta em nuvem | pouco, se o 2 existir |

### Por que não um servidor

Sincronização de verdade pediria backend, conta, autenticação e resolução de
conflito — semanas de trabalho, custo mensal e o seu material de estudo na
máquina de outra pessoa. Para **um** usuário com dois ou três aparelhos, a pasta
dentro do Drive ou do OneDrive entrega 90% do resultado com 5% do trabalho: eles
já resolvem transferência, versão e histórico, e são melhores nisso do que eu
seria.

### O que fazer primeiro, e por quê

**Nível 1 antes de qualquer coisa desta lista.** Um botão de baixar e um de
restaurar, mais o aviso *"último backup há 9 dias"* no rodapé quando passar de
duas semanas. É meio dia de trabalho e resolve o caso que já aconteceu.

Nível 2 e 3 já estão desenhados em `PLANO-persistencia.md`; a decisão que ficou
pendente ali — **espelho ou fonte da verdade** — continua pendente, e eu
recomendo espelho: o app grava na pasta, mas continua lendo do armazenamento
interno ao abrir, e restaurar é um botão que você aperta. Sem divergência
silenciosa.

### A regra que não pode ser esquecida

Gravar em arquivo temporário e **só então** renomear por cima do bom. Uma
gravação interrompida no meio não pode destruir o backup anterior — é a falha
que transforma um sistema de segurança em causa de perda.

---

## 6. Ordem sugerida

| fase | entrega | por quê nesta posição |
|---|---|---|
| **F1** | backup `.json` completo: baixar, restaurar, aviso de dias sem backup | o risco é real e já se concretizou uma vez |
| **F2** | topo enxuto + cobertura integrada ao ritmo | tira a redundância antes que ela divirja |
| **F3** | planos com nome + `plano` em cada registro do diário | tudo depois disso depende de saber "de qual edital" |
| **F4** | escada de revisão 1-7-21-60 + "revisões de hoje" | o motor do estudo continuado |
| **F5** | resumos por tópico, com o modo Resumos como casa | fecha o ciclo edital → resumo → cartões |
| **F6** | pasta conectada (espelho) | quando o resto estiver estável |

---

## 7. Testes que nascem daqui

| | regra |
|---|---|
| F-A | backup exportado e restaurado devolve **exatamente** o mesmo estado, em todos os modos |
| F-B | restaurar backup de versão anterior não quebra: campo desconhecido é ignorado, campo ausente ganha padrão |
| F-C | a barra de cobertura do topo e a do painel de ritmo mostram o mesmo número — ou existe uma só |
| F-D | revisar um tópico empurra a próxima revisão para o degrau seguinte, nunca para trás |
| F-E | registro do diário sempre nasce com um plano; trocar de plano não reescreve os registros antigos |
| F-F | resumo salvo sobrevive a trocar de modo, recarregar e restaurar backup |

F-C é a que impede a redundância de voltar: ou os dois números batem, ou só
existe um lugar mostrando aquilo.
