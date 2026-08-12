// data.js — Asset data, existing holdings, valuations, and asset colors
// Classic script (not a module) — loaded with <script src defer>

window.ASSET_DATA = [
  { ticker: 'VOO', label: 'VOO', icon: 'V', type: 'stock', signal: 'buy', price: 696.41, change: '+1.4%', costAvg: 508, current: 696, invested: 188, actual: 257, delta: '+6.38', context: 'VOO cotiza en 696.41 cerca de su maximo de 52 semanas (699.15), con un rango diario reciente entre 688.61 y 697.31, senal tecnica de Strong Buy segun promedios moviles. El aporte mensual de $50 debe continuar sin cambios, ya que el S&P 500 sigue en tendencia alcista de fondo pese a la cercania al techo historico.', class: 'asset-voo' },
  { ticker: 'QQQ', label: 'QQQ', icon: 'Q', type: 'stock', signal: 'buy', price: 612.35, change: '+1.8%', costAvg: 533, current: 612, invested: 83, actual: 95, delta: '-11', context: 'QQQ avanzo cerca de 1.76% recientemente impulsado por el rebote en semiconductores y tecnologia, en linea con el momentum de NVDA. Sigue siendo un vehiculo solido para el DCA mensual dado el peso de las megacaps de IA en el indice.', class: 'asset-qqq' },
  { ticker: 'NVDA', label: 'NVIDIA', icon: 'N', type: 'stock', signal: 'buy', price: 206.83, change: '-0.4%', costAvg: 119, current: 206, invested: 132, actual: 229, delta: '-0.01', context: 'NVDA cotiza en 206.83 con maximo de 52 semanas en 236.54, y su capitalizacion se mantiene practicamente plana la ultima semana (-0.35%). El proximo reporte de resultados el 26 de agosto es un catalizador clave a vigilar antes de anadir exposicion adicional.', class: 'asset-nvda' },
  { ticker: 'NU', label: 'Nubank', icon: 'N', type: 'stock', signal: 'hold', price: 14.20, change: '+2.0%', costAvg: 8.18, current: 14.20, invested: 8, actual: 14, delta: '+0.11', context: '—', class: 'asset-nu' },
  { ticker: 'TSLA', label: 'Tesla', icon: 'T', type: 'stock', signal: 'hold', price: 312.50, change: '-1.5%', costAvg: 302, current: 312, invested: 38, actual: 40, delta: '-0.07', context: '—', class: 'asset-tsla' },
  { ticker: 'BTC', label: 'Bitcoin', icon: '₿', type: 'crypto', signal: 'buy', price: 63736.05, change: '+0.7%', costAvg: 76370, current: 63736, invested: 1242, actual: 1037, delta: '-8.36', context: 'BTC subio cerca de 2% este martes en la manana y se mantiene estable respecto a hace una semana, con dominancia de mercado en 56.4% lo que refuerza su rol defensivo dentro del portafolio cripto. El fear index en zona de miedo (27) historicamente ha sido un buen punto de entrada para DCA en BTC, por lo que continuar el aporte mensual de $50 tiene sentido.', class: 'asset-btc' },
  { ticker: 'ETH', label: 'Ethereum', icon: 'Ξ', type: 'crypto', signal: 'hold', price: 1868.43, change: '-3.2%', costAvg: 2532, current: 1868, invested: 439, actual: 324, delta: '-1.14', context: '—', class: 'asset-eth' },
  { ticker: 'SOL', label: 'Solana', icon: '◎', type: 'crypto', signal: 'hold', price: 73.32, change: '-2.4%', costAvg: 173, current: 73.32, invested: 726, actual: 306, delta: '-4.94', context: '—', class: 'asset-sol' },
  { ticker: 'TAO', label: 'Bittensor', icon: 'τ', type: 'crypto', signal: 'hold', price: 190.52, change: '-4.5%', costAvg: 350, current: 190, invested: 258, actual: 140, delta: '-1.09', context: '—', class: 'asset-tao' },
  { ticker: 'UNI', label: 'Uniswap', icon: 'U', type: 'crypto', signal: 'hold', price: 3.86, change: '-5.0%', costAvg: 9.19, current: 3.86, invested: 281, actual: 118, delta: '+3.37', context: '—', class: 'asset-uni' },
  { ticker: 'BNB', label: 'BNB', icon: 'B', type: 'crypto', signal: 'hold', price: 592.23, change: '+1.5%', costAvg: 673, current: 592, invested: 72, actual: 63, delta: '+3.10', context: '—', class: 'asset-bnb' },
  { ticker: 'SUI', label: 'SUI', icon: 'S', type: 'crypto', signal: 'hold', price: 1.85, change: '-6.0%', costAvg: 3.69, current: 1.85, invested: 224, actual: 112, delta: '+67', context: '—', class: 'asset-sui' },
  { ticker: 'SEI', label: 'SEI', icon: 's', type: 'crypto', signal: 'hold', price: 0.19, change: '-7.0%', costAvg: 0.2916, current: 0.1900, invested: 136, actual: 88, delta: '+0.00', context: '—', class: 'asset-sei' },
  { ticker: 'ENA', label: 'Ethena', icon: 'E', type: 'crypto', signal: 'hold', price: 0.28, change: '-8.0%', costAvg: 0.2802, current: 0.2800, invested: 69, actual: 69, delta: '-9.98', context: '—', class: 'asset-ena' },
  { ticker: 'AVAX', label: 'Avalanche', icon: 'A', type: 'crypto', signal: 'hold', price: 6.87, change: '-9.0%', costAvg: 18.93, current: 6.87, invested: 45, actual: 16, delta: '+1.48', context: '—', class: 'asset-avax' },
  { ticker: 'GIGA', label: 'GIGA', icon: 'G', type: 'crypto', signal: 'hold', price: 0.0023, change: '-10.0%', costAvg: 0.0639, current: 0.0023, invested: 55, actual: 2, delta: '+0.24', context: '—', class: 'asset-giga' },
  { ticker: 'TRUMP', label: 'TRUMP', icon: 'T', type: 'crypto', signal: 'hold', price: 1.48, change: '-15.0%', costAvg: 36.07, current: 1.48, invested: 41, actual: 1, delta: '-0.10', context: '—', class: 'asset-trump' },
  { ticker: 'SPX6900', label: 'SPX6900', icon: 'S', type: 'crypto', signal: 'hold', price: 0.35, change: '-6.0%', costAvg: 1.15, current: 0.3500, invested: 43, actual: 13, delta: '+0.37', context: '—', class: 'asset-spx6900' }
];

window.EXISTING_ASSETS = {
  "btc": { type: "crypto", label: "Bitcoin", qty: 0.016271, costAvg: 76370.002869, fundamento: "" },
  "eth": { type: "crypto", label: "Ethereum", qty: 0.1736, costAvg: 2532.66, fundamento: "" },
  "sol": { type: "crypto", label: "Solana", qty: 4.179, costAvg: 173.74, fundamento: "" },
  "tao": { type: "crypto", label: "Bittensor", qty: 0.7369, costAvg: 350.93, fundamento: "" },
  "uni": { type: "crypto", label: "Uniswap", qty: 30.68, costAvg: 9.191, fundamento: "" },
  "bnb": { type: "crypto", label: "BNB", qty: 0.1075, costAvg: 673, fundamento: "" },
  "sui": { type: "crypto", label: "SUI", qty: 60.86, costAvg: 3.688, fundamento: "" },
  "sei": { type: "crypto", label: "SEI", qty: 466.62, costAvg: 0.2916, fundamento: "" },
  "ena": { type: "crypto", label: "Ethena", qty: 249.59, costAvg: 0.2802, fundamento: "" },
  "avax": { type: "crypto", label: "Avalanche", qty: 2.428, costAvg: 18.93, fundamento: "" },
  "giga": { type: "crypto", label: "GIGA", qty: 873.2, costAvg: 0.06385, fundamento: "" },
  "trump": { type: "crypto", label: "TRUMP", qty: 1.151, costAvg: 36.07, fundamento: "" },
  "spx6900": { type: "crypto", label: "SPX6900", qty: 37.87, costAvg: 1.149, fundamento: "" },
  "voo": { type: "stock", label: "VOO", qty: 0.36947, costAvg: 508.99, fundamento: "" },
  "qqq": { type: "stock", label: "QQQ", qty: 0.15618, costAvg: 533.7, fundamento: "" },
  "nvda": { type: "stock", label: "NVIDIA", qty: 1.10855, costAvg: 119.11, fundamento: "" },
  "nu": { type: "stock", label: "Nubank", qty: 0, costAvg: 8.18, fundamento: "" },
  "tsla": { type: "stock", label: "Tesla", qty: 0, costAvg: 302.24, fundamento: "" }
};

// Margen de seguridad (solo acciones/ETFs con flujo de caja, no cripto).
const VALUATIONS = {
  // voo: { lynch: 0, consenso: 0, propio: 0 },
  // nvda: { lynch: 0, consenso: 0, propio: 0 },
};
window.VALUATIONS = VALUATIONS;

const ASSET_COLORS = {
  btc:'#f7931a',eth:'#627eea',sol:'#9945ff',tao:'#38bdf8',uni:'#ff007a',bnb:'#f3ba2f',
  sui:'#6fbcf0',sei:'#e84142',ena:'#00d4ff',avax:'#e84142',giga:'#00d4ff',trump:'#8250ff',
  spx6900:'#00d4a0',voo:'#00d4a0',qqq:'#4d8fff',nvda:'#76b900',nu:'#8250ff',tsla:'#e31937'
};
window.ASSET_COLORS = ASSET_COLORS;
