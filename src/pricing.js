// Cálculo de preços e formatação — compartilhado entre a calculadora e o relatório.

export function calcPrice(adults, children, piso, adultoFee, criancaFee, inflacao) {
  const total = adults + children;
  let base;
  if (total <= 30) base = piso;
  else if (adults < 30) base = piso + (total - 30) * criancaFee;
  else base = piso + (adults - 30) * adultoFee + children * criancaFee;
  return base * (1 + inflacao / 100);
}

export function getInflacao(premissas, adults, children) {
  return (adults + children) < 60 ? premissas.inflacaoAbaixo60 : premissas.inflacaoAcima60;
}

export function fmt(v) { return v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
export function fmtShort(v) { return "R$ " + (v / 1000).toFixed(1).replace(".", ",") + "k"; }
