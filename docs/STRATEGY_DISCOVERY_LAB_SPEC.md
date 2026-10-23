# Strategy Discovery & Validation Lab

Updated: 2026-10-23

## Goal

Build a research workflow that can propose novel combinations of known, measurable market features, define a reproducible strategy, test it, explain it, and promote it only after it passes pre-registered validation gates. It must be able to conclude "no validated strategy found." It must never describe a backtest as proof of future profitability.

This is a design specification, not a claim that autonomous discovery is already implemented. The current GitHub Pages app is a client-side chart and provisional rule scanner. A genuine research engine needs additional code, adequate historical data, compute, persistent experiment records, and a dashboard connected to those records.

## What "learn a new strategy" can mean

The system can:
- combine features from an approved library (structure breaks, confirmed swings, sweeps, FVGs, order-block candidates, volatility, session/time features, trend filters, momentum and risk controls);
- propose rule combinations and bounded parameter ranges;
- generate plain-language hypotheses before testing;
- compile a candidate into a deterministic, versioned rule specification;
- evaluate it with historical simulation, robustness checks and forward paper trading;
- compare it with simple baselines and reject it if evidence is weak;
- record every experiment, including failed and abandoned candidates, to reduce selection bias;
- explain which rules fired, what variable values were present, what data was used, and why a candidate passed or failed.

The system cannot guarantee it will discover a profitable strategy, invent information unsupported by data, or prove future profitability from past prices. "New to this system" is a safer claim than "never seen before anywhere."

## Proposed lifecycle and promotion gates

1. **Hypothesis**: state the market rationale, expected mechanism, instruments, timeframes, entry, exit, invalidation and risk controls.
2. **Formal specification**: convert the hypothesis into versioned machine-readable rules; all variables have definitions, units, defaults, allowable ranges and causal availability times.
3. **Data audit**: validate timestamps, duplicates, missing bars, OHLC geometry, source, symbol mapping, spread/fees and known feed limitations. Keep train/test periods strictly chronological.
4. **Implementation tests**: unit tests, edge cases, deterministic replay and explicit tests that future bars cannot influence earlier decisions.
5. **In-sample research**: explore only a predeclared search space. Record the total number of trials and parameter combinations, not just winners.
6. **Walk-forward validation**: tune on an earlier window and test on the next unseen window, rolling forward. Never retune on a locked final test set.
7. **Out-of-sample holdout**: evaluate a frozen strategy on untouched data. Where suitable, add purged/embargoed validation or probability-of-backtest-overfitting / deflated-Sharpe analysis.
8. **Robustness**: stress costs and slippage, vary parameters modestly, test different volatility/trend regimes, both supported instruments, and multiple timeframes. Check concentration of profits in one period or a few trades.
9. **Paper forward test**: log time-stamped predictions and simulated fills in real time without brokerage execution. Do not modify the frozen strategy mid-test.
10. **Promotion review**: mark as RESEARCH, REJECTED, WAITING FOR MORE DATA, PAPER TEST, or VALIDATED FOR PAPER USE only. Human approval is required before changing the live signal engine. No automatic brokerage orders.

## Validation metrics to report

Always show sample size and date coverage alongside:
- net return after estimated costs, expectancy per trade in R, win rate, average win/loss, profit factor;
- maximum drawdown, duration underwater, worst day/week/month, losing streak and tail-loss distribution;
- Sharpe/Sortino only with the return frequency and annualisation assumptions stated;
- exposure, turnover, trade frequency, spread/slippage sensitivity, missing-data rate;
- in-sample vs each walk-forward fold vs untouched out-of-sample results;
- number of hypotheses and parameter variants tried, and the multiple-testing/overfitting controls used;
- benchmark comparison and uncertainty intervals where estimable.

Do not set universal "proof" thresholds after seeing the results. Define thresholds before the experiment, based on the intended use and risk. Passing these gates supports evidence of historical robustness; it does not establish future profitability.

## Strategy explanation dashboard requirements

Each candidate page should display:
- strategy name, immutable version/hash, status, created date, author/source and full rule specification;
- plain-language thesis and known failure conditions;
- instrument/timeframe eligibility and required context;
- variable registry: name, definition, units, source, lookback, default/range, when known, and why it exists;
- visual event timeline showing each rule true/false at the decision candle;
- entry/stop/target calculation and R:R calculation, including why a setup was rejected;
- data coverage, feed, timeframe, assumptions, transaction costs and fill model;
- every experiment run, parameters tried, code/data version and complete results, including failures;
- train, walk-forward and out-of-sample metrics separately;
- sensitivity, regime breakdown, benchmark and paper-forward results;
- audit trail of all edits and explicit warning that historical tests do not guarantee future outcomes.

## Anti-overfitting and safety rules

- Do not tune using the final holdout period.
- Log every attempted configuration; never report only the best result.
- Do not use future candle highs/lows before the bar was closed and available.
- Use conservative intrabar assumptions when stop and target can both be hit within one candle.
- Model spread, fees, slippage, latency and gaps where relevant.
- Compare against simple baselines and a no-signal baseline.
- Require minimum sample size and coverage gates; otherwise status remains INSUFFICIENT DATA.
- A 1:3 minimum planned reward/risk is an eligibility rule, not evidence of positive expectancy or win probability.
- Keep discovery/research code separate from the live scanner; never auto-promote a candidate into live alerts.
- No autonomous real-money execution. Human approval and a paper-trading stage are mandatory.

## Reputable sources

1. Bailey, Borwein, López de Prado and Zhu, "The Probability of Backtest Overfitting", Journal of Computational Finance (2017): https://escholarship.org/uc/item/4w1110bb
2. Bailey et al., "Statistical Overfitting and Backtest Performance" (2014/2015): https://sdm.lbl.gov/oapapers/ssrn-id2507040-bailey.pdf
3. Bailey and López de Prado, "How Backtest Overfitting in Finance Leads to False Discoveries", Significance / Oxford Academic (2021): https://academic.oup.com/jrssig/article/18/6/22/7038278
4. U.S. SEC / Investor.gov, "Investor Bulletin: Performance Claims" (back-tested performance is hypothetical): https://www.investor.gov/introduction-investing/general-resources/news-alerts/alerts-bulletins/investor-bulletins-47
5. Springer Nature, "Deep learning in the stock market—a systematic survey of practice, backtesting, and applications" (2022): https://link.springer.com/article/10.1007/s10462-022-10226-0
6. LOWKEY FX, official APA overview (primary source for its public description; insufficient to reproduce all proprietary rules): https://lowkeyfx.com/apa-strategy

## Current implementation status

- Provisional live APA/SMC scanner: exists; not a complete formal APA implementation.
- Unit-tested SMC detector module: exists as a separate research module; not yet connected to the live scanner.
- Automated rule-combination discovery engine: NOT IMPLEMENTED.
- Historical backtest engine with robust costs, walk-forward and untouched holdout: NOT IMPLEMENTED to the standard specified here.
- Experiment database / complete trial registry: NOT IMPLEMENTED.
- Research dashboard connected to live experiment data: NOT IMPLEMENTED.
- Live brokerage execution: intentionally not implemented.

Never describe any of the NOT IMPLEMENTED items as completed.
