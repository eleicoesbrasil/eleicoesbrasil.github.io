#!/usr/bin/env python3
"""Varredura sistematica alvo x preditor -> docs/dados/achados.json + achados_varredura.csv.gz

Uso (a partir de github/eleicoesbrasil):
  uv run --with scipy --with numpy --with pandas python site_build/gerar_achados.py

Le docs/dados/ext/municipios.json (contrato CONTRATO_DADOS.md). Funciona com qualquer conjunto
de variaveis numericas: todo preditor novo entra automaticamente. Idempotente (semente fixa).
Associacoes ECOLOGICAS entre municipios; nada aqui e causal.
"""
import json, math, os, sys, datetime
import numpy as np
import pandas as pd
from scipy import stats

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ENT = os.path.join(RAIZ, "docs", "dados", "ext", "municipios.json")
SAI_JSON = os.path.join(RAIZ, "docs", "dados", "achados.json")
SAI_CSV = os.path.join(RAIZ, "docs", "dados", "achados_varredura.csv.gz")
SEED = 20261027
NBOOT = 1000
LN10 = math.log(10)
LIM_TAUT = 0.98          # |r| entre preditores acima disso => mesmo cluster (um representante)
LIM_SIB = 0.90           # no ranking final, nao repetir preditores quase iguais para o mesmo alvo
MAX_ALVO, MAX_PRED, N_ACHADOS = 10, 3, 40

# ---- ALVOS (explicitos). Peso = aptos da mesma eleicao/turno ---------------------------------
# (chave, peso). Margem (t1/t2) e % do adversario sao quase identicos a % Lula (soma ~100) e
# contagens (votos, brancos, nulos) sao dominadas pelo tamanho => ficam de fora dos alvos.
ALVOS = [
    ("res22_t1_plula", "res22_t1_aptos"), ("res22_t2_plula", "res22_t2_aptos"),
    ("res26_t1_plula", "res26_t1_aptos"), ("res26_t2_plula", "res26_t2_aptos"),
    ("res22_t1_abst", "res22_t1_aptos"), ("res22_t2_abst", "res22_t2_aptos"),
    ("res26_t1_abst", "res26_t1_aptos"), ("res26_t2_abst", "res26_t2_aptos"),
    ("res22_d21_lula", "res22_t1_aptos"), ("res26_d21_lula", "res26_t1_aptos"),
    ("res22_d21_abst", "res22_t1_aptos"), ("res26_d21_abst", "res26_t1_aptos"),
    ("res26_d2622_t1_lula", "res26_t1_aptos"), ("res26_d2622_t2_lula", "res26_t2_aptos"),
    ("res26_d2622_t1_abst", "res26_t1_aptos"), ("res26_d2622_t2_abst", "res26_t2_aptos"),
]
ROT = {  # rotulos dos alvos
    "plula": ("% dos votos válidos de Lula", "Lula's % of valid votes"),
    "abst": ("abstenção (%)", "abstention (%)"),
    "d21_lula": ("variação do % de Lula (2º−1º turno, pp)", "change in Lula's % (2nd−1st round, pp)"),
    "d21_abst": ("variação da abstenção (2º−1º turno, pp)", "change in abstention (2nd−1st round, pp)"),
    "d2622_lula": ("variação do % de Lula (2026−2022, pp)", "change in Lula's % (2026−2022, pp)"),
    "d2622_abst": ("variação da abstenção (2026−2022, pp)", "change in abstention (2026−2022, pp)"),
}


def rotulo_alvo(k):
    p = k.split("_")
    ano = "20" + p[0][3:]
    if p[1] in ("t1", "t2") and p[2] in ("plula", "abst"):
        t = "1º turno" if p[1] == "t1" else "2º turno"
        tt = "1st round" if p[1] == "t1" else "2nd round"
        a, b = ROT[p[2]]
        return f"{a[0].upper()+a[1:]} — {t} {ano}", f"{b[0].upper()+b[1:]} — {tt} {ano}"
    if p[1] == "d21":
        a, b = ROT["d21_" + p[2]]
        return f"{a[0].upper()+a[1:]} — {ano}", f"{b[0].upper()+b[1:]} — {ano}"
    if p[1] == "d2622":
        a, b = ROT["d2622_" + p[3]]
        t = "1º turno" if p[2] == "t1" else "2º turno"
        tt = "1st round" if p[2] == "t1" else "2nd round"
        return f"{a[0].upper()+a[1:]} — {t}", f"{b[0].upper()+b[1:]} — {tt}"
    return k, k


# ---- estatisticas ----------------------------------------------------------------------------
def pear(x, y):
    xc = x - x.mean(); yc = y - y.mean()
    d = math.sqrt((xc @ xc) * (yc @ yc))
    return float((xc @ yc) / d) if d > 0 else np.nan


def wpear(x, y, w):
    w = w / w.sum()
    mx, my = w @ x, w @ y
    cxy = w @ ((x - mx) * (y - my)); vx = w @ ((x - mx) ** 2); vy = w @ ((y - my) ** 2)
    return float(cxy / math.sqrt(vx * vy)) if vx > 0 and vy > 0 else np.nan


def logp_r(r, n):
    """log10 do p bicaudal (t, n-2 gl) de uma correlacao, estavel para p minusculo."""
    if not np.isfinite(r) or n < 4:
        return np.nan
    r = max(min(r, 1 - 1e-15), -1 + 1e-15)
    t = abs(r) * math.sqrt((n - 2) / (1 - r * r))
    return float((math.log(2) + stats.t.logsf(t, n - 2)) / LN10)


def ci_fisher(r, n, nivel=0.95):
    if not np.isfinite(r) or n < 4:
        return (np.nan, np.nan)
    r = max(min(r, 1 - 1e-12), -1 + 1e-12)
    z = math.atanh(r); se = 1 / math.sqrt(n - 3); q = stats.norm.ppf(0.5 + nivel / 2)
    return (math.tanh(z - q * se), math.tanh(z + q * se))


def cluster_p(x, y, g):
    """Regressao simples y~x com erro-padrao robusto a clusters CR1; t com G-1 gl. -> (beta, log10p)"""
    n = len(x); xc = x - x.mean(); sxx = xc @ xc
    if sxx <= 0:
        return np.nan, np.nan
    b = (xc @ (y - y.mean())) / sxx
    u = (y - y.mean()) - b * xc
    G = len(np.unique(g))
    if G < 3:
        return b, np.nan
    s = np.bincount(g, weights=xc * u)
    V = (s @ s) / sxx ** 2 * G / (G - 1) * (n - 1) / (n - 2)
    if V <= 0:
        return b, np.nan
    t = abs(b) / math.sqrt(V)
    return float(b), float((math.log(2) + stats.t.logsf(t, G - 1)) / LN10)


def centrar(v, g, ng):
    m = np.bincount(g, weights=v, minlength=ng) / np.maximum(np.bincount(g, minlength=ng), 1)
    return v - m[g]


def bh_log(lp):
    """Benjamini-Hochberg em log10; retorna log10 q (<=0)."""
    lp = np.asarray(lp, float); m = len(lp); out = np.full(m, np.nan)
    ok = np.isfinite(lp); idx = np.where(ok)[0]
    if len(idx) == 0:
        return out
    mm = len(idx)
    o = idx[np.argsort(lp[idx])]
    rank = np.arange(1, mm + 1)
    lq = lp[o] + np.log10(mm / rank)
    lq = np.minimum.accumulate(lq[::-1])[::-1]
    out[o] = np.minimum(lq, 0.0)
    return out


def quintis(x, y, g, ng, rng_idx):
    """Quintis do preditor (ranks medios). Retorna dict + dif com IC bootstrap por cluster de UF."""
    n = len(x)
    rk = stats.rankdata(x, method="average")
    q = np.minimum(((rk - 0.5) / n * 5).astype(int), 4)
    cnt = np.bincount(q, minlength=5)
    if (cnt == 0).any():
        return None
    mx = [float(np.median(x[q == i])) for i in range(5)]
    my = [float(y[q == i].mean()) for i in range(5)]
    # bootstrap: reamostra UFs (clusters) com reposicao; quintis fixos da amostra completa
    S = np.zeros((ng, 2)); N = np.zeros((ng, 2))
    for j, qq in enumerate((0, 4)):
        mk = q == qq
        S[:, j] = np.bincount(g[mk], weights=y[mk], minlength=ng)
        N[:, j] = np.bincount(g[mk], minlength=ng)
    ufs = np.where(np.bincount(g, minlength=ng) > 0)[0]
    cts = rng_idx.multinomial(len(ufs), np.ones(len(ufs)) / len(ufs), size=NBOOT).astype(float)
    ss = cts @ S[ufs]; nn = cts @ N[ufs]
    with np.errstate(invalid="ignore", divide="ignore"):
        d = ss[:, 1] / nn[:, 1] - ss[:, 0] / nn[:, 0]
    d = d[np.isfinite(d)]
    ic = (float(np.percentile(d, 2.5)), float(np.percentile(d, 97.5))) if len(d) > 100 else (np.nan, np.nan)
    return dict(q=q, med=mx, alvo=my, n=[int(c) for c in cnt], dif=my[4] - my[0], ic=ic)


def par(x, y, w, g, ng, reg, regs, rng):
    """Todas as estatisticas de um par (arrays ja sem NaN)."""
    n = len(x); r = pear(x, y)
    o = dict(n=n, pearson=r)
    if not np.isfinite(r):
        return None
    lo, hi = ci_fisher(r, n); o.update(ci_lo=lo, ci_hi=hi)
    o["spearman"] = pear(stats.rankdata(x), stats.rankdata(y))
    o["r_ponderado"] = wpear(x, y, w)
    xc, yc = centrar(x, g, ng), centrar(y, g, ng)
    o["r_dentro_uf"] = pear(xc, yc) if xc.std() > 1e-12 and yc.std() > 1e-12 else np.nan
    o["p_log10"] = logp_r(r, n)
    b, lpc = cluster_p(x, y, g); o["beta"] = b; o["p_cluster_log10"] = lpc
    # outliers: remove 1% mais extremos (max |z| em x ou y)
    zx = np.abs((x - x.mean()) / x.std()); zy = np.abs((y - y.mean()) / y.std())
    sc = np.maximum(zx, zy); k = max(1, int(math.ceil(0.01 * n)))
    keep = np.argsort(sc)[: n - k]
    o["r_sem_extremos"] = pear(x[keep], y[keep])
    for rg in regs:
        m = reg == rg
        o["r_" + rg] = pear(x[m], y[m]) if m.sum() >= 15 and x[m].std() > 0 and y[m].std() > 0 else np.nan
    qd = quintis(x, y, g, ng, rng)
    if qd:
        o.update(q1=qd["alvo"][0], q5=qd["alvo"][4], dif_pp=qd["dif"], dif_lo=qd["ic"][0], dif_hi=qd["ic"][1],
                 _qd=qd)
    o["sd_y"] = float(y.std())
    return o


def loo_uf(x, y, g):
    rs = []
    for u in np.unique(g):
        m = g != u
        rs.append(pear(x[m], y[m]))
    return min(rs), max(rs)


# ---- formatacao ------------------------------------------------------------------------------
def fnum(v, d=1, lang="pt", sinal=False):
    s = f"{v:+.{d}f}" if sinal else f"{v:.{d}f}"
    s = s.replace("-", "−")
    return s.replace(".", ",") if lang == "pt" else s


def fp(lp, lang):
    if lp is None or not np.isfinite(lp):
        return "p n/d"
    if lp < -300:
        return "p < 1e-300"
    if lp > -2:
        v = 10 ** lp
        return ("p = " + fnum(v, 3, lang))
    e = math.floor(lp); m = 10 ** (lp - e)
    sup = str(e).replace("-", "⁻").translate(str.maketrans("0123456789", "⁰¹²³⁴⁵⁶⁷⁸⁹"))
    return f"p ≈ {fnum(m,1,lang)}×10{sup}"


def lim(v):
    return None if v is None or not np.isfinite(v) else float(v)


def main():
    t0 = datetime.datetime.now()
    d = json.load(open(ENT, encoding="utf-8"))
    N = d["n"]
    vars_ = {v["k"]: v for v in d["vars"]}
    df = pd.DataFrame({k: pd.to_numeric(pd.Series(c), errors="coerce") for k, c in d["cols"].items()
                       if vars_.get(k, {}).get("tipo", "num") == "num"})
    ufs = np.array(d["uf"]); reg = np.array(d["reg"])
    uflist = sorted(set(ufs)); ufidx = {u: i for i, u in enumerate(uflist)}
    G = np.array([ufidx[u] for u in ufs]); NG = len(uflist)
    regs = sorted(set(reg))
    rng = np.random.default_rng(SEED)

    alvos = [(a, w) for a, w in ALVOS if a in df and w in df]
    alvo_set = {a for a, _ in alvos}
    # preditores: numericos, nao 'resultado', nem aptos de eleicao (pesos res*)
    pred = [k for k, v in vars_.items() if k in df and v.get("tipo", "num") == "num"
            and v.get("papel") != "resultado" and not k.startswith(("res22_", "res26_"))]
    # preditores constantes dentro da UF (ex. PNADC) => escopo estadual
    estad = []
    for k in pred:
        x = df[k].values; m = np.isfinite(x)
        if m.sum() < 100 or np.nanstd(x) == 0:
            continue
        xc = centrar(np.where(m, x, np.nanmean(x)), G, NG)
        if (xc[m] ** 2).sum() / ((x[m] - x[m].mean()) ** 2).sum() < 1e-6:
            estad.append(k)
    mun = [k for k in pred if k not in estad and df[k].notna().sum() >= 100 and df[k].std() > 0]

    # clusters de preditores (|r|>0.98): representante = maior cobertura, depois razoes (%/per capita)
    C = df[mun].corr(min_periods=100).abs().fillna(0)
    def prio(k):
        u = (vars_[k].get("unidade") or "").lower()
        razao = ("%" in u) or ("hab" in u and "/" in u) or ("por " in u) or ("/" in u)
        return (-int(df[k].notna().sum()), -int(razao), k)
    ordem = sorted(mun, key=prio)
    rep_de = {}
    for k in ordem:
        if k in rep_de:
            continue
        rep_de[k] = k
        for j in ordem:
            if j not in rep_de and C.loc[k, j] > LIM_TAUT:
                rep_de[j] = k
    reps = [k for k in mun if rep_de[k] == k]
    print(f"municipios={N} alvos={len(alvos)} preditores_mun={len(mun)} reps={len(reps)} estaduais={len(estad)}")

    # ---- varredura municipal ----
    linhas = []; qd_guard = {}
    for a, wk in alvos:
        ya = df[a].values; wa = df[wk].values
        for k in mun:
            xa = df[k].values
            m = np.isfinite(xa) & np.isfinite(ya) & np.isfinite(wa) & (wa > 0)
            if m.sum() < 100:
                continue
            o = par(xa[m], ya[m], wa[m], G[m], NG, reg[m], regs, rng)
            if o is None:
                continue
            qd_guard[(a, k)] = o.pop("_qd", None)
            o.update(escopo="municipio", alvo=a, preditor=k, rep=rep_de[k], na_familia=(rep_de[k] == k))
            linhas.append(o)
    V = pd.DataFrame(linhas)
    fam = V["na_familia"].values
    V["q_bh_log10"] = np.nan; V["q_bonf_log10"] = np.nan; V["q_cluster_bh_log10"] = np.nan
    idx = np.where(fam)[0]
    V.loc[V.index[idx], "q_bh_log10"] = bh_log(V["p_log10"].values[idx])
    V.loc[V.index[idx], "q_cluster_bh_log10"] = bh_log(V["p_cluster_log10"].values[idx])
    nfam = len(idx)
    V.loc[V.index[idx], "q_bonf_log10"] = np.minimum(V["p_log10"].values[idx] + math.log10(max(nfam, 1)), 0)

    # ---- varredura estadual (n efetivo = UFs) ----
    est = []
    wuf_cache = {}
    for a, wk in alvos:
        ya = df[a].values; wa = df[wk].values
        ok = np.isfinite(ya) & np.isfinite(wa)
        wuf = np.bincount(G[ok], weights=wa[ok], minlength=NG)
        yuf = np.bincount(G[ok], weights=(wa * ya)[ok], minlength=NG) / np.maximum(wuf, 1)
        for k in estad:
            xa = df[k].values; okx = np.isfinite(xa)
            xuf = np.array([np.nanmean(xa[(G == i) & okx]) if ((G == i) & okx).any() else np.nan for i in range(NG)])
            mk = np.isfinite(xuf) & (wuf > 0)
            if mk.sum() < 10:
                continue
            x, y, w = xuf[mk], yuf[mk], wuf[mk]
            r = pear(x, y); n = int(mk.sum()); lo, hi = ci_fisher(r, n)
            est.append(dict(escopo="uf", alvo=a, preditor=k, rep=k, na_familia=True, n=n, pearson=r, ci_lo=lo, ci_hi=hi,
                            spearman=pear(stats.rankdata(x), stats.rankdata(y)), r_ponderado=wpear(x, y, w),
                            p_log10=logp_r(r, n), sd_y=float(y.std())))
    E = pd.DataFrame(est)
    if len(E):
        E["q_bh_log10"] = bh_log(E["p_log10"].values)
        E["q_bonf_log10"] = np.minimum(E["p_log10"].values + math.log10(len(E)), 0)

    # ---- validacao embutida ----
    print("--- validacao ---")
    vr = np.random.default_rng(7)
    for i in vr.choice(len(V), 3, replace=False):
        row = V.iloc[i]; a, k = row["alvo"], row["preditor"]
        xa, ya = df[k].values, df[a].values; m = np.isfinite(xa) & np.isfinite(ya)
        wk = dict(alvos)[a]; m &= np.isfinite(df[wk].values) & (df[wk].values > 0)
        x, y = xa[m], ya[m]; n = len(x)
        rs, ps = stats.pearsonr(x, y); rho = stats.spearmanr(x, y)[0]
        man = float(np.sum((x - x.mean()) * (y - y.mean())) / math.sqrt(np.sum((x - x.mean()) ** 2) * np.sum((y - y.mean()) ** 2)))
        lg = math.log10(ps) if ps > 0 else -999
        print(f"{a} ~ {k}: n={n} r_scipy={rs:.6f} manual={man:.6f} script={row['pearson']:.6f} | "
              f"rho scipy={rho:.5f} script={row['spearman']:.5f} | log10p scipy={lg:.3f} script={row['p_log10']:.3f}")
        assert abs(rs - row["pearson"]) < 1e-9 and abs(man - rs) < 1e-9 and abs(rho - row["spearman"]) < 1e-9
        qd = qd_guard[(a, k)]
        assert sum(qd["n"]) == n, "soma dos quintis != n"
        assert abs(sum(qd["n"][i] * qd["alvo"][i] for i in range(5)) - y.sum()) < 1e-6 * max(1, abs(y.sum())), "media ponderada quintis"
        print(f"   quintis n={qd['n']} soma={sum(qd['n'])} ok; soma(n*media)=soma(y) ok")
    # cluster-robusto contra implementacao matricial
    row = V.iloc[10]; a, k = row["alvo"], row["preditor"]
    m = np.isfinite(df[k].values) & np.isfinite(df[a].values) & np.isfinite(df[dict(alvos)[a]].values) & (df[dict(alvos)[a]].values > 0)
    X = np.c_[np.ones(m.sum()), df[k].values[m]]; yy = df[a].values[m]; gg = G[m]
    XtXi = np.linalg.inv(X.T @ X); be = XtXi @ X.T @ yy; u = yy - X @ be
    Mt = sum(np.outer(X[gg == c].T @ u[gg == c], X[gg == c].T @ u[gg == c]) for c in np.unique(gg))
    Vc = XtXi @ Mt @ XtXi * len(np.unique(gg)) / (len(np.unique(gg)) - 1) * (len(yy) - 1) / (len(yy) - 2)
    tt = be[1] / math.sqrt(Vc[1, 1]); lpm = (math.log(2) + stats.t.logsf(abs(tt), len(np.unique(gg)) - 1)) / LN10
    print(f"CR1 matricial log10p={lpm:.4f} script={row['p_cluster_log10']:.4f}")
    assert abs(lpm - row["p_cluster_log10"]) < 1e-6

    # ---- selecao dos achados ----
    reg_cols = ["r_" + r for r in regs]
    def componentes(row):
        r = row["pearson"]; ar = abs(r); s = np.sign(r)
        rin = row["r_dentro_uf"]
        dentro = 0.0 if not np.isfinite(rin) or np.sign(rin) != s else min(abs(rin) / ar, 1)
        rr = np.array([row[c] for c in reg_cols], float)
        regok = np.mean([(np.isfinite(v) and np.sign(v) == s and abs(v) >= 0.5 * ar) for v in rr])
        out = min(abs(row["spearman"]) if np.sign(row["spearman"]) == s else 0, abs(row["r_sem_extremos"]) if np.sign(row["r_sem_extremos"]) == s else 0) / ar
        out = min(out, 1)
        cl = min(-row["p_cluster_log10"], 4) / 4 if np.isfinite(row["p_cluster_log10"]) else 0
        ef = min(abs(row["dif_pp"]) / (2.5 * row["sd_y"]), 1) if np.isfinite(row.get("dif_pp", np.nan)) and row["sd_y"] > 0 else 0
        return dentro, regok, out, cl, ef
    F = V[V["na_familia"]].copy()
    F["elig"] = (F["q_cluster_bh_log10"] < math.log10(0.05)) & (F["q_bh_log10"] < math.log10(0.05)) & (F["pearson"].abs() >= 0.3)
    comp = F.apply(componentes, axis=1, result_type="expand")
    F[["c_dentro", "c_reg", "c_out", "c_cl", "c_ef"]] = comp
    F["rob"] = F[["c_dentro", "c_reg", "c_out", "c_cl"]].mean(axis=1)
    F["pontuacao"] = 100 * (0.45 * F["pearson"].abs() + 0.25 * F["c_ef"]) / 0.70 * (0.4 + 0.6 * F["rob"]) / 1.0
    V = V.merge(F[["alvo", "preditor", "pontuacao"]], on=["alvo", "preditor"], how="left")
    cand = F[F["elig"]].sort_values("pontuacao", ascending=False)

    escolhidos = []; por_alvo = {}; por_pred = {}
    for _, row in cand.iterrows():
        if len(escolhidos) >= N_ACHADOS:
            break
        a, k = row["alvo"], row["preditor"]
        if por_alvo.get(a, 0) >= MAX_ALVO or por_pred.get(k, 0) >= MAX_PRED:
            continue
        if any(e["alvo"] == a and C.loc[k, e["preditor"]] > LIM_SIB for e in escolhidos):
            continue
        escolhidos.append(row.to_dict()); por_alvo[a] = por_alvo.get(a, 0) + 1; por_pred[k] = por_pred.get(k, 0) + 1

    ach = []
    for i, row in enumerate(escolhidos, 1):
        a, k = row["alvo"], row["preditor"]
        qd = qd_guard[(a, k)]
        xa, ya = df[k].values, df[a].values; wk = dict(alvos)[a]
        m = np.isfinite(xa) & np.isfinite(ya) & np.isfinite(df[wk].values) & (df[wk].values > 0)
        lmin, lmax = loo_uf(xa[m], ya[m], G[m])
        r = row["pearson"]; s = np.sign(r); ar = abs(r)
        al_pt, al_en = [], []
        rin = row["r_dentro_uf"]
        if not np.isfinite(rin) or np.sign(rin) != s or abs(rin) < 0.4 * ar:
            al_pt.append(f"a relação enfraquece ou some dentro das UFs (r dentro da UF = {fnum(rin,2,'pt')}): parte do padrão é diferença entre estados")
            al_en.append(f"the relationship weakens or vanishes within states (within-state r = {fnum(rin,2,'en')}): part of the pattern is between-state difference")
        if (lmin if s > 0 else -lmax) < 0.6 * ar:
            al_pt.append(f"depende de poucas UFs (r variando de {fnum(lmin,2,'pt')} a {fnum(lmax,2,'pt')} ao excluir uma UF por vez)")
            al_en.append(f"depends on a few states (r ranges {fnum(lmin,2,'en')} to {fnum(lmax,2,'en')} when dropping one state at a time)")
        rr = [row[c] for c in reg_cols]
        nreg = sum(1 for v in rr if np.isfinite(v) and np.sign(v) == s and abs(v) >= 0.5 * ar)
        if nreg < 3:
            al_pt.append(f"instável entre regiões (relação comparável em apenas {nreg} de {len(regs)} regiões)")
            al_en.append(f"unstable across regions (comparable in only {nreg} of {len(regs)} regions)")
        tags = []
        dentro_ok = np.isfinite(rin) and np.sign(rin) == s and abs(rin) >= 0.5 * ar
        if not al_pt and row["rob"] >= 0.7 and dentro_ok:
            tags.append("robusto")
        if dentro_ok:
            tags.append("dentro_uf")
        if al_pt:
            tags.append("alerta")
        vp, ap = vars_[k], vars_[a]
        ap_pt, ap_en = rotulo_alvo(a)
        dif = row["dif_pp"]; un = "pp"
        alto_pt = "maior" if s > 0 else "menor"; alto_en = "higher" if s > 0 else "lower"
        # frase: quintil mais baixo -> mais alto do preditor
        txt_pt = (f"Entre {row['n']:,} municípios".replace(",", ".") + f", onde {vp['pt']} é maior, {ap_pt[0].lower()+ap_pt[1:]} tende a ser {alto_pt}"
                  f" (r = {fnum(r,2,'pt')}, IC95% {fnum(row['ci_lo'],2,'pt')} a {fnum(row['ci_hi'],2,'pt')}). "
                  f"Média no quintil mais baixo do preditor: {fnum(row['q1'],1,'pt')}; no mais alto: {fnum(row['q5'],1,'pt')} "
                  f"(diferença {fnum(dif,1,'pt',True)} pp, IC95% por UF {fnum(row['dif_lo'],1,'pt',True)} a {fnum(row['dif_hi'],1,'pt',True)}). "
                  f"Dentro das UFs, r = {fnum(rin,2,'pt')}; {fp(row['p_cluster_log10'],'pt')} com erro-padrão robusto a UFs. "
                  f"Associação ecológica entre municípios — não implica causalidade nem descreve indivíduos.")
        txt_en = (f"Across {row['n']:,} municipalities, where {vp['en']} is higher, {ap_en[0].lower()+ap_en[1:]} tends to be {alto_en}"
                  f" (r = {fnum(r,2,'en')}, 95% CI {fnum(row['ci_lo'],2,'en')} to {fnum(row['ci_hi'],2,'en')}). "
                  f"Mean in the lowest predictor quintile: {fnum(row['q1'],1,'en')}; in the highest: {fnum(row['q5'],1,'en')} "
                  f"(difference {fnum(dif,1,'en',True)} pp, state-cluster bootstrap 95% CI {fnum(row['dif_lo'],1,'en',True)} to {fnum(row['dif_hi'],1,'en',True)}). "
                  f"Within states, r = {fnum(rin,2,'en')}; {fp(row['p_cluster_log10'],'en')} with state-clustered robust SE. "
                  f"Ecological association between municipalities — not causal and not about individuals.")
        if al_pt:
            txt_pt += " ALERTA: " + "; ".join(al_pt) + "."
            txt_en += " WARNING: " + "; ".join(al_en) + "."
        ach.append(dict(
            id=f"a{i}", alvo=a, preditor=k, n=int(row["n"]), pearson=lim(round(r, 4)),
            ci=[lim(round(row["ci_lo"], 4)), lim(round(row["ci_hi"], 4))], spearman=lim(round(row["spearman"], 4)),
            r_ponderado=lim(round(row["r_ponderado"], 4)), r_dentro_uf=lim(round(rin, 4)),
            r_sem_extremos=lim(round(row["r_sem_extremos"], 4)),
            r_sem_uf=[lim(round(lmin, 4)), lim(round(lmax, 4))],
            p_log10=lim(round(row["p_log10"], 2)), p_cluster_log10=lim(round(row["p_cluster_log10"], 2)),
            q_bh=float(10 ** max(row["q_bh_log10"], -300)), q_bh_log10=lim(round(row["q_bh_log10"], 2)),
            q_bonf_log10=lim(round(row["q_bonf_log10"], 2)), q_cluster_bh_log10=lim(round(row["q_cluster_bh_log10"], 2)),
            efeito_pp=dict(q1=lim(round(row["q1"], 2)), q5=lim(round(row["q5"], 2)), dif=lim(round(dif, 2)),
                           dif_ic=[lim(round(row["dif_lo"], 2)), lim(round(row["dif_hi"], 2))]),
            quintis=dict(preditor=[lim(round(v, 4)) for v in qd["med"]], alvo=[lim(round(v, 3)) for v in qd["alvo"]], n=qd["n"]),
            regioes={rg: lim(round(row["r_" + rg], 3)) for rg in regs},
            pontuacao=lim(round(row["pontuacao"], 2)), tags=tags,
            alerta_pt="; ".join(al_pt), alerta_en="; ".join(al_en), texto_pt=txt_pt, texto_en=txt_en))

    # estaduais (n=UFs): so os mais fortes, claramente separados
    estad_out = []
    if len(E):
        top = E.assign(ab=E["pearson"].abs()).sort_values("ab", ascending=False)
        seen = {}
        for _, row in top.iterrows():
            if seen.get(row["alvo"], 0) >= 2 or len(estad_out) >= 12:
                continue
            seen[row["alvo"]] = seen.get(row["alvo"], 0) + 1
            vp = vars_[row["preditor"]]
            estad_out.append(dict(alvo=row["alvo"], preditor=row["preditor"], n=int(row["n"]), pearson=lim(round(row["pearson"], 3)),
                                  ci=[lim(round(row["ci_lo"], 3)), lim(round(row["ci_hi"], 3))], spearman=lim(round(row["spearman"], 3)),
                                  r_ponderado=lim(round(row["r_ponderado"], 3)), p_log10=lim(round(row["p_log10"], 2)),
                                  q_bh_log10=lim(round(row["q_bh_log10"], 2)),
                                  nota_pt=f"Contexto estadual (n = {int(row['n'])} UFs, não municípios): {vp['pt']} vs. {rotulo_alvo(row['alvo'])[0]}; evidência fraca, só descritiva.",
                                  nota_en=f"State-level context (n = {int(row['n'])} states, not municipalities): {vp['en']} vs. {rotulo_alvo(row['alvo'])[1]}; weak evidence, descriptive only."))

    nq = int((V.loc[V["na_familia"], "q_bh_log10"] < math.log10(0.05)).sum())
    nqc = int((V.loc[V["na_familia"], "q_cluster_bh_log10"] < math.log10(0.05)).sum())
    sem = [dict(k=a, motivo_pt="nenhuma relação passou nos critérios (q<0,05 também com p por clusters de UF, |r|≥0,3)",
                motivo_en="no relationship met the criteria (q<0.05 also with state-clustered p, |r|≥0.3)")
           for a, _ in alvos if por_alvo.get(a, 0) == 0]
    metodo_pt = (
        f"Varredura de {len(alvos)} alvos eleitorais × {len(reps)} preditores municipais (família = {nfam} pares; "
        f"{len(mun)-len(reps)} preditores foram agrupados por |r|>{LIM_TAUT} com um representante por grupo para evitar pares tautológicos; "
        "resultados em votos/contagens, margens e % do adversário ficam fora dos alvos por serem redundantes ou dominados pelo tamanho). "
        "Para cada par: Pearson com IC95% de Fisher, Spearman, correlação ponderada por eleitores aptos, correlação dentro das UFs (centrada por UF), "
        "p ingênuo (teste t), p robusto a clusters de UF (CR1, 26 gl), q de Benjamini–Hochberg e Bonferroni, médias do alvo nos quintis do preditor "
        f"(diferença Q5−Q1 em pp com IC95% por bootstrap em clusters de UF, {NBOOT} reamostragens, semente fixa), r por grande região e robustez a outliers "
        "(r de postos e r após remover o 1% mais extremo). Elegíveis: q<0,05 (BH, ingênuo e por clusters) e |r|≥0,3. "
        "Pontuação = 100·(0,45·|r| + 0,25·min(|dif|/(2,5·DP do alvo),1))/0,70 · (0,4 + 0,6·robustez), onde robustez é a média de: r dentro da UF / r (mesmo sinal), "
        "fração de regiões com relação comparável, min(r de postos, r sem extremos)/r e −log10 p cluster (teto 4)/4. "
        f"Seleção gulosa: até {N_ACHADOS} achados, no máx. {MAX_ALVO} por alvo e {MAX_PRED} por preditor, sem preditores quase iguais (|r|>{LIM_SIB}) para o mesmo alvo. "
        "Variáveis constantes dentro da UF (ex.: PNADC) são analisadas à parte com n = 27 UFs. Correlações ecológicas, não causais; municípios vizinhos não são independentes.")
    metodo_en = (
        f"Sweep of {len(alvos)} electoral targets × {len(reps)} municipal predictors (family = {nfam} pairs; "
        f"{len(mun)-len(reps)} predictors were merged into clusters at |r|>{LIM_TAUT}, keeping one representative, to avoid tautological pairs; "
        "vote counts, margins and opponent % are excluded as targets because they are redundant or size-dominated). "
        "Per pair: Pearson with Fisher 95% CI, Spearman, voter-weighted correlation, within-state correlation (state-centered), naive t-test p, "
        "state-cluster-robust p (CR1, 26 df), Benjamini–Hochberg q and Bonferroni, target means by predictor quintile (Q5−Q1 difference in pp with "
        f"95% state-cluster bootstrap CI, {NBOOT} resamples, fixed seed), per-region r, and outlier robustness (rank r and r after dropping the most extreme 1%). "
        "Eligible: q<0.05 (BH, naive and cluster-based) and |r|≥0.3. "
        "Score = 100·(0.45·|r| + 0.25·min(|diff|/(2.5·target SD),1))/0.70 · (0.4 + 0.6·robustness), robustness being the mean of: within-state r / r (same sign), "
        "share of regions with a comparable relationship, min(rank r, trimmed r)/r and −log10 cluster p (cap 4)/4. "
        f"Greedy selection: up to {N_ACHADOS} findings, max {MAX_ALVO} per target and {MAX_PRED} per predictor, no near-duplicate predictors (|r|>{LIM_SIB}) for the same target. "
        "Variables constant within state (e.g. PNADC) are analysed separately with n = 27 states. Ecological, non-causal correlations; neighbouring municipalities are not independent.")
    out = dict(gerado=t0.strftime("%Y-%m-%d %H:%M"), n_municipios=N, familia=nfam, familia_q05=nq, familia_q05_cluster=nqc,
               n_pares_total=int(len(V)), metodo_pt=metodo_pt, metodo_en=metodo_en,
               alvos=[dict(k=a, pt=rotulo_alvo(a)[0], en=rotulo_alvo(a)[1]) for a, _ in alvos],
               achados=ach, estadual=estad_out, sem_achado=sem)
    os.makedirs(os.path.dirname(SAI_JSON), exist_ok=True)
    json.dump(out, open(SAI_JSON, "w", encoding="utf-8"), ensure_ascii=False, indent=1, allow_nan=False)

    cols = ["escopo", "alvo", "preditor", "rep", "na_familia", "n", "pearson", "ci_lo", "ci_hi", "spearman", "r_ponderado",
            "r_dentro_uf", "p_log10", "p_cluster_log10", "q_bh_log10", "q_bonf_log10", "q_cluster_bh_log10",
            "q1", "q5", "dif_pp", "dif_lo", "dif_hi", "r_sem_extremos"] + reg_cols + ["beta", "pontuacao"]
    T = pd.concat([V, E], ignore_index=True)
    for c in cols:
        if c not in T:
            T[c] = np.nan
    T[cols].round(5).to_csv(SAI_CSV, index=False, compression="gzip")

    print(f"familia={nfam} pares_total={len(V)} q_bh<0.05={nq} q_cluster<0.05={nqc} elegiveis={int(F['elig'].sum())} achados={len(ach)}")
    print("top 10:")
    for a in ach[:10]:
        print(f"  {a['id']} {a['alvo']} ~ {a['preditor']}: r={a['pearson']} dentro_uf={a['r_dentro_uf']} dif_pp={a['efeito_pp']['dif']} score={a['pontuacao']} {a['tags']}")
    print("por alvo:", por_alvo)
    print(f"tempo {(datetime.datetime.now()-t0).total_seconds():.0f}s")


if __name__ == "__main__":
    main()
