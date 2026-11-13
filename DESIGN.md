# Padrão de design do EasyAnkiCards

Este é o padrão visual do app. **Toda tela nova e toda mudança de estilo seguem estas regras.**
As medidas moram em um lugar só: as variáveis `--…` no começo do `<style>` de `docs/index.html`.
O teste `tests/estrutura.js` (bloco "padrão de design") recusa tamanho de letra, raio de canto ou cor
escritos à mão que ainda não existam no app.

## Por que existe

Medido na versão 19.120.0: 35 tamanhos de letra, 33 raios de canto e 153 cores escritas à mão, com
dezenas de ajustes locais de botão. Cada tela escolhia os seus valores, e o conjunto parecia montado aos
pedaços. O padrão troca a escolha caso a caso por uma tabela curta.

## Princípios

1. **Uma ação principal por grupo.** Só ela é um botão cheio; o resto é secundário ou quieto.
2. **A cor diz o significado, não enfeita.** Azul é ação; verde deu certo; laranja pede atenção; vermelho é
   erro ou perda. Texto comum não é colorido.
3. **Menos texto, mais hierarquia.** Título forte, apoio pequeno e cinza, nada repetido.
4. **O mesmo gesto, o mesmo desenho.** Canto, peso da letra, tempo de transição e anel de foco são iguais
   em todo controle.
5. **Funciona nos três temas** (claro, escuro, preto) e no celular. Cor nova só por variável.

## A tabela de medidas

| O quê | Variáveis | Valores |
|---|---|---|
| Letra | `--fs-1` … `--fs-6` | 11 · 12 · 13 · 15 · 18 · 22 px |
| Peso | `--peso-n` `--peso-m` `--peso-f` | 400 · 600 · 700 |
| Cantos | `--r-p` `--r-m` `--r-g` `--r-pilula` | 6 · 10 · 14 px · pílula |
| Espaços | `--esp-1` … `--esp-6` | 4 · 8 · 12 · 16 · 24 · 32 px |
| Altura de controle | `--h-p` `--h-m` `--h-g` | 28 · 36 · 44 px |
| Relevo | `--sombra-1` `--sombra-2` | na página · flutuando |
| Movimento | `--mov` | 0,12 s |
| Foco | `--anel` | anel de 3 px na cor de ação |

Uso da letra: `--fs-1` selos e legendas · `--fs-2` botões secundários e apoio · `--fs-3` texto e botões ·
`--fs-4` texto de leitura e botão grande · `--fs-5` título de janela · `--fs-6` título de tela.

## Cores

Use sempre as variáveis; nunca um `#hex` novo.

| Papel | Variável |
|---|---|
| Fundo da página · painel · campo | `--bg` · `--panel` · `--campo` |
| Texto · texto de apoio | `--texto` · `--sutil` |
| Contorno | `--borda` |
| Ação (botão principal, link, foco) | `--acao` |
| Deu certo · atenção · erro · informação | `--ok` · `--atencao` · `--erro` · `--info` |

Para variar um tom, misture com a própria variável:
`color-mix(in srgb, var(--texto) 7%, var(--campo))`.

## Botões

Três tipos, um desenho.

| Tipo | Classe | Quando |
|---|---|---|
| **Primário** | `btn` + cor (`btn-azul`, `btn-verde`…) | A ação principal da tela ou do grupo. Um só. |
| **Secundário** | `btn-min` | Tudo o que acompanha: abrir, copiar, conferir. |
| **Quieto** | `btn-quieto` | Ação de apoio dentro de uma linha: "ver mais", "desfazer". |

Variações do secundário: `btn-min-ok` (confirma algo bom) e `btn-min-perigo` (apaga ou descarta).
Perigo cheio (`btn-perigo`) só na confirmação final de algo que não volta.

Tamanhos: o padrão, `btn-p` (compacto, 28 px) e `btn-g` (de toque, 44 px). **Não crie padding próprio.**

Rótulo: verbo primeiro, minúsculas, até 3 palavras ("copiar o pedido", "importar de PDF"). Emoji só
quando ajuda a achar o botão, e no começo.

Todo botão precisa de: estado ao passar o mouse, ao apertar, desligado e foco pelo teclado. As classes acima
já trazem os quatro.

## Outros componentes

- **Janelas (`<dialog>`):** canto `--r-g`, borda fina, `--sombra-2`; o fundo de trás fica desfocado. Título
  em `--fs-5`; o botão principal fica à direita no rodapé.
- **Painéis e cartões:** fundo `--campo` ou `--panel`, borda `--borda`, canto `--r-m`, espaço interno
  `--esp-3` ou `--esp-4`.
- **Selos (status, contagem):** pílula, `--fs-1`, peso `--peso-m`; a cor vai no contorno e no texto, não
  no fundo inteiro.
- **Linha de status:** selos curtos ("✓ 3 lidos", "⚠ 2 avisos"); amarelo só quando há aviso.
- **Listas de avisos:** agrupadas pela causa, texto uma vez só, ação na própria linha.
- **Campos:** canto 8 px, foco com a borda na cor de ação e o anel `--anel`.

## Texto da interface

- Frases curtas, em português simples; a conclusão vem primeiro.
- Um aviso diz o que aconteceu e o que fazer, sem repetir o que a tela já mostra.
- Números sempre com a unidade ("3 tópicos · 4h30").

## Antes de entregar uma tela

- [ ] Só variáveis da tabela para letra, canto, espaço e cor.
- [ ] Um botão primário por grupo; os demais secundários ou quietos.
- [ ] Conferida nos temas claro e escuro e na largura de celular (375 px).
- [ ] Navegável pelo teclado, com o foco visível.
- [ ] `node tests/rodar.js` passa (inclui o teste do padrão).

## Migração do que já existe

O CSS antigo continua valendo e vai sendo trazido para a tabela quando a tela for tocada: ao mexer numa
área, troque os valores soltos dela pelas variáveis. O teste só impede valores **novos**; os limites dele
devem diminuir a cada limpeza, nunca aumentar.
