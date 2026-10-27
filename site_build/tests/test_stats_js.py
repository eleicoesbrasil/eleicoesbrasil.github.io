"""Valida site_build/modelos/global_stats.js (window.__stats) contra scipy/mpmath, rodando o JS em Chromium (Playwright).

Uso: uv run --with scipy --with numpy --with playwright --with mpmath python site_build/tests/test_stats_js.py
Critério: erro relativo < 1e-6 em p (e em log10p quando p < 1e-250). Sai com código 1 em caso de falha.
"""
import glob, json, math, os, sys
import numpy as np
from scipy import stats
from playwright.sync_api import sync_playwright

HERE = os.path.dirname(os.path.abspath(__file__))
JS = os.path.join(HERE, '..', 'modelos', 'global_stats.js')
TOL = 1e-6
fails = []


def rel(a, b):
    return abs(a - b) / max(abs(b), 1e-300)


def check(name, got, ref, tol=TOL):
    ok = (got == got) and rel(got, ref) < tol if ref != 0 else abs(got) < tol
    if not ok:
        fails.append(f'{name}: js={got!r} ref={ref!r}')
    return ok


def log10p_ref_t(t, df):
    """log10 do p bicaudal da t via mpmath (suporta p ~ 1e-2000)."""
    import mpmath as mp
    mp.mp.dps = 60
    t = mp.mpf(t); df = mp.mpf(df)
    x = df / (df + t * t)
    return float(_lbeta_inc(mp, x, df / 2, mp.mpf(1) / 2) / mp.log(10))


def _f21(mp, A, C, x):
    """2F1(A,1;C;x) por soma direta da serie (0<x<1)."""
    term = mp.mpf(1); tot = mp.mpf(1); k = 0
    while True:
        term *= (A + k) / (C + k) * x; tot += term; k += 1
        if abs(term) < abs(tot) * mp.mpf(10) ** (-40) or k > 200000:
            return tot


def _lbeta_inc(mp, x, a, b):
    """ln I_x(a,b) = ln[x^a (1-x)^b / (a B(a,b)) * 2F1(a+b,1;a+1;x)] (x pequeno => serie converge)."""
    lb = mp.loggamma(a) + mp.loggamma(b) - mp.loggamma(a + b)
    return a * mp.log(x) + b * mp.log(1 - x) - lb - mp.log(a) + mp.log(_f21(mp, a + b, a + 1, x))


def main():
    src = open(JS).read()
    exe = sorted(glob.glob(os.path.expanduser('~/.cache/ms-playwright/chromium-*/chrome-linux64/chrome')))
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path=exe[-1], args=['--no-sandbox']) if exe else p.chromium.launch(args=['--no-sandbox'])
        pg = b.new_page()
        pg.set_content('<html><body></body></html>')
        pg.add_script_tag(content=src)
        ev = lambda expr, arg=None: pg.evaluate(expr, arg)

        # --- pCorr
        cases = [(0.0035, 488114), (0.01, 488114), (0.2, 488114), (0.9, 5571), (0.5, 5571), (0.05, 5571), (0.02, 5571),
                 (-0.3, 100), (0.1, 30), (0.99, 12), (0.6, 5), (-0.0123, 488114), (0.0, 50), (0.31, 488114)]
        for r, n in cases:
            o = ev('([r,n])=>window.__stats.pCorr(r,n)', [r, n])
            df = n - 2
            t = r * math.sqrt(df / (1 - r * r))
            if 2 * stats.t.sf(abs(t), df) > 1e-250:
                pref = 2 * stats.t.sf(abs(t), df)
                check(f'pCorr p r={r} n={n}', o['p'], pref)
            if r == 0:
                check(f'pCorr r=0 n={n}', o['p'], 1.0)
            elif 2 * stats.t.sf(abs(t), df) > 1e-250:
                check(f'pCorr log10p r={r} n={n}', o['log10p'], math.log10(2 * stats.t.sf(abs(t), df)))
            else:
                check(f'pCorr log10p r={r} n={n}', o['log10p'], log10p_ref_t(t, df))
            if not (abs(o['t'] - t) < 1e-9 * max(1, abs(t))):
                fails.append(f'pCorr t r={r} n={n}: {o["t"]} vs {t}')
        # caso extremo: r=0.9 n=5571 => p ~ 1e-2000
        o = ev('()=>window.__stats.pCorr(0.9,5571)')
        if not (o['log10p'] < -1900):
            fails.append(f'pCorr extremo log10p={o["log10p"]}')
        else:
            check('pCorr r=0.9 n=5571 log10p', o['log10p'], log10p_ref_t(0.9 * math.sqrt(5569 / 0.19), 5569))
        # Spearman: mesma aproximacao t (scipy.stats.spearmanr usa t com n-2 gl)
        x = np.random.default_rng(1).normal(size=200); y = x * 0.2 + np.random.default_rng(2).normal(size=200)
        rho, psp = stats.spearmanr(x, y)
        o = ev('([r,n])=>window.__stats.pCorr(r,n,"spearman")', [rho, 200])
        check('spearman p', o['p'], psp, 1e-5)

        # --- ciCorr
        for r, n, lv in [(0.5, 100, .95), (-0.2, 5571, .95), (0.9, 12, .99), (0.003, 488114, .95), (0.7, 30, .9)]:
            lo, hi = ev('([r,n,l])=>window.__stats.ciCorr(r,n,l)', [r, n, lv])
            z = stats.norm.ppf(1 - (1 - lv) / 2); f = np.arctanh(r); se = 1 / math.sqrt(n - 3)
            rl, rh = math.tanh(f - z * se), math.tanh(f + z * se)
            check(f'ci lo r={r} n={n}', lo, rl, 1e-7) if rl != 0 else None
            check(f'ci hi r={r} n={n}', hi, rh, 1e-7)

        rng = np.random.default_rng(42)
        # --- welch
        for na, nb, da, db in [(30, 40, 0, 0.5), (200, 50, 1, 1.3), (5, 8, 0, 3), (2000, 3000, 0, 0.1), (60, 70, 0, 2.5)]:
            a = rng.normal(da, 1, na); bb = rng.normal(db, 2, nb)
            ref = stats.ttest_ind(a, bb, equal_var=False)
            o = ev('([a,b])=>window.__stats.welch(a,b)', [a.tolist(), bb.tolist()])
            check(f'welch t {na},{nb}', o['t'], ref.statistic, 1e-9)
            check(f'welch df {na},{nb}', o['df'], ref.df, 1e-9)
            if ref.pvalue > 1e-200:
                check(f'welch p {na},{nb}', o['p'], ref.pvalue)
            else:
                check(f'welch log10p {na},{nb}', o['log10p'], log10p_ref_t(ref.statistic, ref.df))
            check(f'welch diff {na},{nb}', o['diff'] if o['diff'] != 0 else 1e-12, a.mean() - bb.mean(), 1e-9)

        # --- anova
        for sizes, shifts in [([30, 40, 50], [0, 0.3, 0.1]), ([200, 300, 250, 100, 150], [0, 0.1, 0.2, 0.5, 0.0]), ([5, 6], [0, 2]),
                              ([1000, 1200, 900, 1100, 1300], [0, 1, 2, 3, 4])]:
            gs = [rng.normal(s, 1, n) for n, s in zip(sizes, shifts)]
            ref = stats.f_oneway(*gs)
            o = ev('(g)=>window.__stats.anova(g)', [g.tolist() for g in gs])
            check(f'anova F {sizes}', o['F'], ref.statistic, 1e-9)
            allv = np.concatenate(gs); sst = ((allv - allv.mean()) ** 2).sum()
            ssb = sum(len(g) * (g.mean() - allv.mean()) ** 2 for g in gs)
            check(f'anova eta2 {sizes}', o['eta2'], ssb / sst, 1e-9)
            if ref.pvalue > 1e-250:
                check(f'anova p {sizes}', o['p'], ref.pvalue)
            else:
                import mpmath as mp
                mp.mp.dps = 60
                d1 = len(gs) - 1; d2 = len(allv) - len(gs); F = mp.mpf(float(ref.statistic))
                x_ = mp.mpf(d2) / (d2 + d1 * F)
                lref = float(_lbeta_inc(mp, x_, mp.mpf(d2) / 2, mp.mpf(d1) / 2) / mp.log(10))
                check(f'anova log10p {sizes}', o['log10p'], lref)

        # --- kruskal (com empates)
        for sizes, shifts in [([30, 40, 50], [0, 0.3, 0.1]), ([200, 300, 250], [0, 0.2, 0.4]), ([8, 9, 7, 6], [0, 1, 0, 1]), ([1500, 1500], [0, 0.5])]:
            gs = [np.round(rng.normal(s, 1, n), 1) for n, s in zip(sizes, shifts)]  # arredondado => empates
            ref = stats.kruskal(*gs)
            o = ev('(g)=>window.__stats.kruskal(g)', [g.tolist() for g in gs])
            check(f'kruskal H {sizes}', o['H'], ref.statistic, 1e-9)
            if ref.pvalue > 1e-250:
                check(f'kruskal p {sizes}', o['p'], ref.pvalue)
            else:
                check(f'kruskal log10p {sizes}', o['log10p'], float(stats.chi2.logsf(ref.statistic, len(gs) - 1)) / math.log(10))

        # --- fdr (Benjamini-Hochberg) e Holm
        for _ in range(5):
            ps = rng.uniform(0, 1, 40) ** 3
            ps[3] = np.nan if False else ps[3]
            ref = stats.false_discovery_control(ps, method='bh')
            got = ev('(p)=>window.__stats.fdr(p)', ps.tolist())
            for i, (g, r_) in enumerate(zip(got, ref)):
                check(f'fdr[{i}]', g, r_, 1e-9)
            lg = ev('(p)=>window.__stats.fdrLog(p.map(Math.log10))', ps.tolist())
            for i, (g, r_) in enumerate(zip(lg, ref)):
                check(f'fdrLog[{i}]', 10 ** g, r_, 1e-9)
            m = len(ps)
            order = np.argsort(ps); hol = np.empty(m); run = 0
            for rank, i in enumerate(order):
                run = max(run, min(1, ps[i] * (m - rank))); hol[i] = run
            got = ev('(p)=>window.__stats.holm(p)', ps.tolist())
            for i, (g, r_) in enumerate(zip(got, hol)):
                check(f'holm[{i}]', g, r_, 1e-9)
        # fmtP
        fm = ev('()=>[window.__stats.fmtP({log10p:-500},"pt"),window.__stats.fmtP(Math.log10(0.0123),"pt"),window.__stats.fmtP(Math.log10(0.0123),"en"),'
                'window.__stats.fmtP(Math.log10(3.2e-45),"pt"),window.__stats.fmtP(Math.log10(3.2e-45),"en"),window.__stats.fmtP({log10p:-2000.4},"en")]')
        exp = ['p < 1e-300', 'p = 0,0123', 'p = 0.0123', 'p ≈ 3,2×10⁻⁴⁵', 'p ≈ 3.2×10⁻⁴⁵', 'p < 1e-300']
        if fm != exp:
            fails.append(f'fmtP: {fm} != {exp}')
        b.close()
    if fails:
        print('FALHAS:'); [print(' ', f) for f in fails]
        sys.exit(1)
    print('OK: global_stats.js confere com scipy (tol %g)' % TOL)


if __name__ == '__main__':
    main()
