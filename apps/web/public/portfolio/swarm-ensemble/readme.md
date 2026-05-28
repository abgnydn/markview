# swarm-ensemble

Comparing aggregation strategies for distributed evolutionary optimization, tested on cryptocurrency portfolio trading.

Multiple nodes independently evolve trading strategies using a WebGPU-accelerated genetic algorithm. This project studies how to combine their outputs. Six aggregation methods, framed as "political system" metaphors, are compared:

| Strategy | Method |
|---|---|
| Dictatorship | Use the single best-performing node |
| Republic | Weighted average of top-K nodes |
| Democracy | Equal-weight average of all nodes |
| Oligarchy | Consensus among a fixed elite subset |
| Anarchy | Random node selection each period |
| Communism | Shared genome pool, no node autonomy |

These are compared against standard financial baselines: Equal Weight, Momentum, Risk Parity, and Mean-Variance optimization.

## Key result

Republic (top-K weighted average) consistently outperformed the other aggregation strategies.

## Important caveats

- "Alpha" throughout this project means performance relative to a buy-and-hold BTC benchmark, not absolute returns. A strategy can show positive alpha while losing money in absolute terms -- it just lost less than BTC did.
- This is a research comparison of aggregation methods. It is not a profitable trading system.
- Paper trading only. No real money is involved.

## Data

16 cryptocurrency assets, 2000 hourly candles sourced from Binance.

## Repository structure

```
src/          Evolution engine + crypto-specific application layer
trading/      Paper trading scripts and data fetchers
demos/        Browser UIs
research/     Aggregation comparison and validation scripts
benchmarks/   Financial baseline implementations
data/         Historical crypto price data
```

## Running

**Browser demo:** Open `demos/index.html` in Chrome (WebGPU required).

**Paper trading:** `python trading/swarm_v41_live.py`

## License

See [LICENSE](LICENSE).
