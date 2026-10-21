/* =====================================================================
 * ARTIGO COM DOIS SUFIXOS — "Art. 359-M-A" (v18.98.0)
 *
 * O caso real (21/10, inclusão do Código Penal compilado do Planalto): a Lei 15.402/2026 acrescentou os arts. 359-M-A
 * e 359-M-B. O app lia só até "359-M", achava "o 359-M repetido 3 vezes" e pedia para escolher UM — apagando dois
 * artigos de verdade.
 *
 * O QUE PRECISA SER VERDADE:
 *  1. 359-M, 359-M-A, 359-M-B e 359-N são quatro artigos, nessa ordem — no texto em linhas e no texto achatado;
 *  2. nenhum "repetido"; mas o 359-M-A escrito duas vezes continua sendo repetido (dele, não do 359-M);
 *  3. o sufixo SEPARADO continua sendo texto: "Art. 359-M - A pena…" é o 359-M;
 *  4. a remissão "art. 359-M-A do CP" é ao 359-M-A.
 * ===================================================================== */
const { rodar } = require("./fumaca.js");

async function testes() {
  const falhas = [];
  const ok = (c, m) => { if (!c) falhas.push(m); };
  const NL = String.fromCharCode(10);
  /* trecho do Código Penal compilado (Planalto), como chega depois de lido o HTML */
  const CP = [
    "Art. 359-L. Tentar, com emprego de violência ou grave ameaça, abolir o Estado Democrático de Direito, impedindo ou restringindo o exercício dos poderes constitucionais: (Incluído pela Lei nº 14.197, de 2021) (Vigência)",
    "Pena - reclusão, de 4 (quatro) a 8 (oito) anos, além da pena correspondente à violência.",
    "Art. 359-M. Tentar depor, por meio de violência ou grave ameaça, o governo legitimamente constituído: (Incluído pela Lei nº 14.197, de 2021) (Vigência)",
    "Pena - reclusão, de 4 (quatro) a 12 (doze) anos, além da pena correspondente à violência. (Incluído pela Lei nº 14.197, de 2021) (Vigência)",
    "Art. 359-M-A. Quando os delitos deste Capítulo estão inseridos no mesmo contexto, a pena deverá ser aplicada, ainda que existente desígnio autônomo, na forma do concurso formal próprio de que trata a primeira parte do art. 70, vedando-se a aplicação do cômputo cumulativo previsto na segunda parte desse dispositivo. (Incluído pela Lei nº 15.402, de 2026)",
    "Art. 359-M-B. Quando os crimes previstos neste Capítulo forem praticados em contexto de multidão, a pena será reduzida de 1/3 (um terço) a 2/3 (dois terços), desde que o agente não tenha praticado ato de financiamento ou exercido papel de liderança. (Incluído pela Lei nº 15.402, de 2026)",
    "Art. 359-N. Impedir ou perturbar a eleição ou a aferição de seu resultado, mediante violação indevida de mecanismos de segurança do sistema eletrônico de votação estabelecido pela Justiça Eleitoral: (Incluído pela Lei nº 14.197, de 2021) (Vigência)",
    "Pena - reclusão, de 3 (três) a 6 (seis) anos, e multa.",
  ].join(NL);

  const { api: a } = rodar();
  const nums = (txt) => a.leiArtigos(txt).map((x) => x.num).join(", ");
  ok(nums(CP) === "359-L, 359-M, 359-M-A, 359-M-B, 359-N", "S1 quatro artigos distintos, na ordem: " + nums(CP));
  const arts = a.leiArtigos(CP);
  ok(arts.every((x, k) => k === 0 || x.ordem > arts[k - 1].ordem), "S1a a ordem é crescente (359-M < 359-M-A < 359-M-B < 359-N)");
  ok(a.leiNumOrdem("359-M") < a.leiNumOrdem("359-M-A") && a.leiNumOrdem("359-M-A") < a.leiNumOrdem("359-M-B") && a.leiNumOrdem("359-M-B") < a.leiNumOrdem("359-N")
    && Math.floor(a.leiNumOrdem("359-M-B") / 100) === 359, "S1b o peso: entre o 359-M e o 359-N, e o /100 continua dando 359");
  const mA = arts.find((x) => x.num === "359-M-A");
  ok(mA && /^Quando os delitos/.test(String(mA.corpo || mA.texto || "").replace(/^\s*Art\.\s*359-M-A\.\s*/, "")) && /cômputo cumulativo/.test(mA.texto || mA.corpo), "S1c o 359-M-A leva o próprio texto");
  /* achatado (uma linha só, como sai de alguns PDFs): quem separa é o "separar a colagem" */
  const achatado = CP.split(NL).join(" ");
  const sep0 = a.leiSepararColagem(achatado);
  ok(sep0.artigos.map((p) => p.num).join(", ") === "359-L, 359-M, 359-M-A, 359-M-B, 359-N" && sep0.texto.split(NL).filter((l) => /^Art\./.test(l)).length === 5,
    "S1d texto achatado numa linha: a separação acha os mesmos cinco: " + JSON.stringify(sep0.artigos.map((p) => p.num)));
  /* repetidos */
  const dup = a.leiDuplicados(CP) || [];
  ok(!dup.length, "S2 nenhum repetido (o caso real pedia para escolher entre os três): " + JSON.stringify(dup.map((g) => g.num)));
  /* o caso do PDF: o artigo antigo (tachado) e o novo, LADO A LADO */
  const dobrado = CP.replace("Art. 359-M-B.", "Art. 359-M-A. Quando os delitos deste Capítulo estão inseridos no mesmo contexto, a pena deverá ser aplicada. (Redação antiga)" + NL + "Art. 359-M-B.");
  const d2 = a.leiDuplicados(dobrado) || [];
  ok(d2.length === 1 && d2[0].num === "359-M-A" && d2[0].candidatos.length === 2, "S2a o 359-M-A escrito duas vezes é repetido — dele, não do 359-M: " + JSON.stringify(d2.map((g) => g.num + "×" + g.candidatos.length)));
  /* sufixo separado continua sendo texto */
  const sep = ["Art. 359-M - A pena aplica-se em dobro.", "Art. 359-N. Outro."].join(NL);
  ok(nums(sep) === "359-M, 359-N", "S3 'Art. 359-M - A pena…' é o 359-M (o 'A' separado é a primeira palavra do texto): " + nums(sep));
  ok(nums(["Art. 5º-A. Texto.", "Art. 5º-B. Texto."].join(NL)) === "5º-A, 5º-B", "S3a um sufixo só continua como era: " + nums(["Art. 5º-A. Texto.", "Art. 5º-B. Texto."].join(NL)));
  /* remissão */
  const cit = a.leiCitacoesNoTexto("aplica-se o art. 359-M-A do Código Penal ao caso");
  ok(cit.length === 1 && String(cit[0].num).replace(/\s/g, "") === "359-M-A", "S4 a remissão 'art. 359-M-A' é ao 359-M-A: " + JSON.stringify(cit.map((c) => c.num)));
  const cit2 = a.leiCitacoesNoTexto("nos termos do art. 359-M, a pena…");
  ok(cit2.length === 1 && String(cit2[0].num).replace(/\s/g, "") === "359-M", "S4a e 'art. 359-M,' continua sendo o 359-M");
  return falhas;
}

module.exports = { testes };
