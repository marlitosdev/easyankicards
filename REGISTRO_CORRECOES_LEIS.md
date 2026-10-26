# Registro das correções na consolidação de leis em PDF

**Data:** 26/10/2026  
**Aplicativo:** EasyAnkiCards  
**Versão analisada:** 19.27.0  
**Versão das correções:** 19.27.1  
**Branch:** `main`  
**Commit-base:** `217b3db868ce304bd5581d02f02d2e42a43a9a87`

## 1. Objetivo e escopo

Corrigir problemas encontrados ao importar e consolidar o Código Tributário Municipal de Caruaru e suas leis alteradoras:

1. **LC 15/2009** — Código Tributário Municipal de Caruaru, usada como texto-base;
2. **LC 95/2022** — altera o Código Tributário Municipal;
3. **LC 112/2023** — altera a LC 15/2009;
4. **LC 145/2024** — altera a LC 15/2009.

O trabalho foi restrito à leitura das ordens de revogação, à associação de anexos e à consolidação hierárquica dos dispositivos. Os PDFs originais e os dados reais armazenados no aplicativo não foram alterados.

## 2. Arquivos alterados

- `docs/lei-seca.js` — regras de interpretação e consolidação das leis;
- `tests/lei-alteradora.js` — testes de revogações, hierarquia e substituição de redação;
- `tests/lei-anexos.js` — testes de associação e substituição de anexos;
- `docs/app.js` e `docs/sw.js` — versão do aplicativo e atualização do cache;
- `README.md` — versão pública do projeto;
- `REGISTRO_CORRECOES_LEIS.md` — este registro.

Nas regras e testes de leis, o diff contém **212 inserções e 20 remoções**, antes da inclusão deste documento e da atualização de versão.

## 3. Correções realizadas

### 3.1 Revogações mistas e endereço até a alínea — LC 95/2022

**Problema**

A rotina não interpretava corretamente uma mesma frase que revogava artigos inteiros e também unidades internas. Além disso, o endereço `alínea "i", do inciso I do art. 248` podia ser resolvido no inciso pai, ampliando indevidamente o alcance da revogação.

**Correção**

- A leitura da frase passou a processar artigos inteiros, parágrafos, incisos e alíneas em conjunto;
- Foi incluído o reconhecimento do endereço composto com alínea e inciso;
- Foram evitadas revogações duplicadas;
- Quando a busca devolve o caminho hierárquico completo, a revogação é aplicada à unidade mais específica, e não ao inciso pai.

**Resultado conferido nos PDFs**

- Os arts. **174** e **203** passaram a ser revogados por inteiro;
- No art. **248**, somente a **alínea “i” do inciso I** foi revogada pela LC 95/2022;
- O inciso I e suas demais alíneas foram preservados;
- A alínea “i” pôde ser reincluída posteriormente pela LC 145/2024.

### 3.2 Associação dos anexos e ordens no futuro

**Problema**

A existência de um Anexo I com alteração apenas parcial deslocava a associação por posição dos demais anexos. Isso impedia o reconhecimento correto das tabelas integrais. As expressões `passará a vigorar` e `passarão a vigorar` também não eram tratadas como ordens de substituição.

**Correção**

A associação passou a seguir esta ordem:

1. Procurar o alvo explicitamente indicado na ordem;
2. Procurar o número do próprio título do anexo, como `ANEXO VII (NR)`;
3. Usar a posição somente quando não houver bloco estranho e a correspondência posicional for segura.

Também foram reconhecidas as formas `passará a vigorar` e `passarão a vigorar` nas rotinas pertinentes.

**Resultado conferido nos PDFs**

- O Anexo I parcial deixou de deslocar os anexos seguintes;
- Os anexos **VI**, **VII** e **XV** passaram a gerar substituições pela LC 145/2024;
- O Anexo **XI** foi marcado como revogado pela LC 145/2024;
- Os anexos VII e XV ficaram com o histórico `LC 95/2022; LC 145/2024`;
- O Anexo VI ficou com a fonte `LC 145/2024`;
- Os anexos VIII, X e XVI mantiveram as substituições provenientes da LC 95/2022.

### 3.3 Hierarquia dos incisos III–XX do art. 248 — LC 145/2024

**Problema**

Depois do § 6º, a lei alteradora apresenta uma sequência de incisos revogados. A interpretação estrutural podia vincular esses incisos ao parágrafo anterior, embora eles continuassem a numeração do caput.

**Correção**

Uma sequência de pelo menos dois incisos revogados, numericamente contínua com os incisos do caput, passou a ser reenquadrada no caput. A exigência de sequência evita reenquadrar um inciso isolado que pertença legitimamente a um parágrafo.

**Resultado conferido nos PDFs**

- Os incisos **III a XX** do art. 248 foram revogados no nível correto;
- Os dispositivos internos de parágrafos que não faziam parte dessa sequência foram preservados.

### 3.4 Revogação e nova redação no mesmo bloco

**Problema**

Um mesmo bloco podia conter a revogação da redação antiga e o acréscimo de nova redação para o mesmo endereço. A ordem de aplicação podia apagar o texto novo ou produzir alertas indevidos de `ja_existia` e `nao_achou`.

**Correção**

- As revogações passaram a ser processadas antes dos acréscimos e das novas redações no mesmo bloco;
- A revogação atinge a redação antiga, e o novo texto é inserido depois;
- Não é gerado `nao_achou` quando o endereço ausente será reposto no próprio bloco;
- Não é gerado `ja_existia` quando o acréscimo ocupa uma unidade que estava revogada.

**Resultado conferido nos PDFs**

- Os novos **§§ 1º a 6º do art. 248** permaneceram com a redação da LC 145/2024;
- As revogações das redações antigas não apagaram esses novos textos;
- Os alertas indevidos de `ja_existia` deixaram de ocorrer.

## 4. Testes de regressão adicionados

Foram acrescentados cenários identificados como `CR` nos arquivos `tests/lei-alteradora.js` e `tests/lei-anexos.js`, usando as redações relevantes das leis de Caruaru.

A cobertura verifica:

- Revogação de artigos inteiros e unidades na mesma frase;
- Endereço contendo inciso e alínea;
- Preservação do inciso pai;
- Revogação do § 2º do art. 273-B sem alterar o § 1º;
- Reenquadramento dos incisos III–XX no caput;
- Permanência dos novos §§ 1º–6º;
- Reinclusão da alínea “i” depois de revogada;
- Reconhecimento de `passará` e `passarão a vigorar`;
- Associação correta das tabelas integrais na presença de anexo parcial;
- Manutenção do aviso para alteração parcial ainda não automatizada.

**Testes direcionados:** `lei-alteradora: 0 falhas` e `lei-anexos: 0 falhas`.

Também foram executados `node --check docs/lei-seca.js` e `git diff --check`, sem erros.

## 5. Comparação da simulação com os quatro PDFs

A simulação aceita deliberadamente todos os itens para permitir a inspeção estrutural do resultado. Portanto, os números abaixo são diagnóstico técnico, e não certificação jurídica da consolidação.

| Etapa | Métrica | Antes | Depois |
|---|---|---:|---:|
| LC 95/2022 | Itens identificados | 30 | 38 |
| LC 95/2022 | Itens seguros | 26 | 33 |
| LC 95/2022 | Itens com atenção | 4 | 5 |
| LC 112/2023 | Itens identificados | 8 | 8 |
| LC 112/2023 | Itens seguros | 8 | 8 |
| LC 112/2023 | Itens com atenção | 0 | 0 |
| LC 145/2024 | Itens identificados | 51 | 54 |
| LC 145/2024 | Itens seguros | 48 | 51 |
| LC 145/2024 | Itens com atenção | 3 | 3 |
| LC 145/2024 | Alertas `ja_existia` | 5 | 0 |
| LC 145/2024 | Alertas `nao_achou` | 20 | 2 |

O aumento de itens na LC 95 e na LC 145 representa ordens que antes não eram convertidas corretamente em alterações, e não inclusão de conteúdo estranho às leis.

### Resultado final da simulação

- **598 artigos efetivos**;
- **87 alterações acumuladas**;
- **0 erros no registro da simulação**;
- Art. 248 presente uma única vez e não revogado por inteiro;
- Novos §§ 1º–6º preservados;
- Incisos III–XX marcados como revogados;
- Anexos VI, VII e XV substituídos e Anexo XI revogado, com histórico de origem.

## 6. Validação da suíte e limitações do ambiente

A suíte monolítica foi interrompida no ambiente por problemas de execução e memória. Para não confundir essa interrupção com resultado dos testes, os módulos foram executados em grupos menores e sequenciais, usando o Node.js independente.

Resultado dessa validação:

- **19 casos de texto:** sem falhas;
- **185 módulos de teste executados:** 183 sem falhas e 2 com alertas;
- **Teste de colagem HTML:** pulado porque `jsdom` não está instalado;
- **Testes das correções de leis:** sem falhas.

Os dois alertas restantes são:

1. `gerenciador` — `G13h o 'como usar' corrido sai em qualquer tela; o '?' fica`;
2. `questoes-tela` — `H4 a janela ocupa a tela inteira em qualquer largura`.

Os mesmos dois testes foram executados em uma cópia destacada do commit-base `217b3db` e apresentaram as mesmas falhas. Portanto, são **problemas preexistentes, fora do escopo destas correções**, e não regressões introduzidas por este trabalho.

## 7. Pendências e cuidados remanescentes

- A alteração parcial do **subitem 11.05 do Anexo I**, pela LC 95/2022, ainda exige tratamento manual; a rotina não automatiza essa inclusão pontual na lista;
- Os dois `nao_achou` restantes da LC 145/2024 referem-se aos **§§ 7º e 8º do art. 248**, ausentes do texto-base; são alertas genuínos para conferência, e não falsos positivos eliminados por esta correção;
- A consolidação automática não substitui a revisão jurídica do texto final;
- Os dados reais do aplicativo não foram alterados durante os testes.

## 8. Artefatos de verificação

Os arquivos abaixo ficaram no diretório `../teste-leis`, fora do repositório do aplicativo:

- `saida/resultado-antes-correcao.json` — diagnóstico anterior às correções;
- `saida/resultado.json` — diagnóstico posterior às correções;
- `saida/final-lei.json` — lei consolidada produzida pela simulação;
- `execucao-depois.log` — execução da simulação posterior;
- `suite-completa.log` — tentativa de execução da suíte monolítica;
- `rodar-em-grupos.js` — executor usado para isolar os módulos e reduzir o consumo de memória;
- `suite-modulos.log` — resultado da validação modular.

## 9. Estado das alterações

As correções e este registro integram a versão **19.27.1**, na branch `main` do projeto.
