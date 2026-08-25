/* USO:  node tests/viajar.js 200
 *
 * Roda a suíte inteira com o relógio adiantado N dias.
 *
 * Por que existe: a suíte ficou vermelha sozinha num dia em que ninguém
 * tocou no aplicativo. Um teste seedava o diário com "2026-08-14"; na
 * véspera isso era 6 dias atrás e entrava na janela de 7 dias, no dia
 * seguinte virou 7 e caiu fora. Datas escritas à mão são bombas com
 * relógio: quebram sozinhas, e — pior — podem ficar VERDES por a data ter
 * entrado na janela, não por o código estar certo.
 *
 * Rode isto antes de empacotar. Falhou aqui? Alguma data virou literal
 * de novo; troque por diasAtras(n) ou emDias(n).
 */
/* Adianta o relógio e roda a suíte: qualquer teste que dependa de uma data
 * escrita à mão aparece aqui, hoje, em vez de quebrar sozinho num dia
 * qualquer no futuro. */
const DIAS = Number(process.argv[2] || 45);
const Real = Date;
const off = DIAS * 86400000;
global.Date = class extends Real {
  constructor(...a) { super(...(a.length ? a : [Real.now() + off])); }
  static now() { return Real.now() + off; }
};
global.Date.parse = Real.parse; global.Date.UTC = Real.UTC;
process.argv = process.argv.slice(0, 2);
require(require("path").join(__dirname, "rodar.js"));
