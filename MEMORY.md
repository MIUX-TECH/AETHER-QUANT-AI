# 🏛️ AETHER-QUANT-AI (BTC ACCUMULATOR HEDGE FUND) — CANONICAL MASTER MEMORY

> **PANDUAN UTAMA KEBENARAN ARSITEKTUR & KONTEKS ROLLBACK PERMANEN**  
> Disimpan secara permanen untuk mencegah penyimpangan strategi, perubahan arah sepihak, atau amnesia konteks pada seluruh sesi masa depan.

---

## 🎯 1. IDENTITAS & TUJUAN INTI SISTEM (*MISSION STATEMENT*)

* **Bot ID Asli:** `btc_accumulator_hedge_fund_v1`
* **Strategi Inti Asli:** `tp_modal_trailing_v1`
* **Tujuan Utama (*Primary Goal*):**  
  **"MAXIMIZE BTC HOLDINGS WITH CONTROLLED RISK"** — Menghasilkan dan mengakumulasi Bitcoin fisik ke dalam *BTC Treasury Vault*, bukan sekadar menumpuk saldo USDT.
* **Arsip Sumber Historis Lokal:**  
  📁 `/sdcard/00_ORGANISASI/02_Project/AI_Trading/binance-ai-trader/`  
  *(Memuat arsip lengkap: `BINANCE-AI-from claude.zip`, `miux-ai-trader-final-patched-hotfix-3.zip`, `ptero-v3-buildC-live-demo-orders.zip`, `binance-ai-trader-v2.6-*.zip`)*.

---

## 🏛️ 2. INVARIAN MATEMATIS, STRATEGI & RISIKO (*UNALTERABLE RULES*)

### A. Alokasi Portofolio & Akumulasi BTC (*The Hedge Fund Model*)
1. **Target Alokasi Modal:**
   * **BTC Core / Vault:** 60% (Rentang dinamis: 50%–80%).
   * **Trading Capital (Spot Altcoin + Futures):** 40% (Rentang dinamis: 20%–50%).
   * **Cadangan Kas (*Cash Reserve*):** 5% minimum (naik ke 20%–40% saat mode *risk-off* / *capital preservation*).
2. **Kebijakan Profit (*Profit Policy*):**
   * **70% dari profit yang terealisasi (*Realized PnL*)** dari setiap trade spot altcoin / futures **wajib dibelikan BTC fisik secara otomatis** untuk mengisi *BTC Vault*.
   * **30% sisa profit** disimpan di modal kerja untuk *compounding growth*.
3. **Dual-Role BTC & Aturan TP Khusus BTC:**
   * **Role 1: BTC Taktikal Trading (Spot Swing / Futures Short / Scalp):**
     * Mengikuti aturan TP standar: TP1 40% di *Break-Even + Fee (0.3%)*, 60% runner trailing stop adaptif (1.2%–3.5%).
   * **Role 2: BTC Treasury Vault (Tabungan Macro / DCA Akumulasi):**
     * **Tidak ada TP harian / mikro.** Vault sengaja ditahan penuh (*HODL*) untuk akumulasi jangka panjang.
     * **Hanya di-TP pada Kondisi Puncak Makro Ekstrem (*Macro Cycle Peak*):**
       * **Extreme Greed (F&G $\ge 85$ / Rezim Euphoria):** Light TP $\rightarrow$ Jual **`10%`** isi Vault ke USDT.
       * **Parabolic Runaway (Jauh melenceng di atas EMA Macro):** Medium TP $\rightarrow$ Jual **`25%`** isi Vault ke USDT.
       * **Cycle Peak Zone (Puncak Siklus 4 Tahunan):** Heavy TP $\rightarrow$ Jual **`50%`** isi Vault ke USDT.
     * **Aturan Pembelian Kembali (*Rebuy / Buyback Matrix*):**
       * Hasil penjualan kas USDT di atas disimpan khusus untuk menyerok ulang (*Ladder DCA / Buyback*) saat terjadi **Crash $\ge 50\%$**, kondisi **Extreme Fear (F&G < 20)**, atau menyentuh **Macro Support**.

---

### B. Manajemen Posisi & TP Adaptif (`tp_modal_trailing_v1`)
1. **TP1 (Amankan Modal Cepat):**
   * Tutup **40% posisi** segera saat harga mencapai level **Break-Even + Fee Buffer (0.3%)**.
   * Geser Stop-Loss (*SL*) sisa posisi ke titik impas (*Breakeven*).
2. **Runner (Maksimalkan Profit Mengikuti Trend):**
   * **60% sisa porsi posisi** dibiarkan berjalan menggunakan **Adaptive Trailing Stop** yang menyesuaikan jenis rezim pasar:
     * **Trending Market:** Trailing Stop **`2.5%`** (longgarkan agar runner tidak kena goyangan kecil).
     * **Ranging / Sideways:** Trailing Stop **`1.2%`** (ketatkan untuk amankan profit sebelum reversal).
     * **High Volatility:** Trailing Stop **`3.5%`** (toleransi noise tinggi).

---

### C. 8 Pilar Skoring Kuantitatif Berbobot (100% Total)
Sinyal masuk (*entry*) ditentukan oleh evaluasi 8 pilar kuantitatif di `engine/analysis/scoring.py`:
1. **Trend Strength (20%)**: EMA Alignment (EMA 9, 21, 50, 200) + SuperTrend.
2. **Momentum (18%)**: RSI 14 (Multi-timeframe 5m, 15m, 1h, 4h) + MACD Histogram & Signal Cross.
3. **Market Structure (15%)**: Higher High / Lower Low, Break of Structure (BOS), Support/Resistance.
4. **Volume Flow (12%)**: On-Balance Volume (OBV), Volume Spike Ratio vs SMA20, Taker Buy/Sell Pressure.
5. **HTF Alignment (15%)**: Konfirmasi keselarasan timeframe tinggi (4H & 1D Trend).
6. **Volatility & Noise (8%)**: Average True Range (ATR) & Bollinger Bands Width (BBW).
7. **Market Sentiment (7%)**: Fear & Greed Index + Agregasi Berita Kripto.
8. **Risk Condition (5%)**: Rasio Risk-to-Reward (R:R $\ge 1:2$) dan jarak likuidasi futures.

* **Threshold Aksi:**
  * $\ge 82\% \rightarrow$ `STRONG_BUY`
  * $\ge 68\% \rightarrow$ `BUY`
  * $\le 22\% \rightarrow$ `SHORT`
  * Lainnya $\rightarrow$ `WAIT / HOLD / REDUCE`

---

### D. Parameter Perlindungan Risiko & Failsafe (*Strict Risk Guard*)
* **Batas Risiko Maks per Trade:** **`2.0%`** dari total ekuitas (dihitung berbasis volatilitas ATR).
* **Batas Maksimum Eksposur per Koin:** **`25.0%`** dari portofolio.
* **Batas Kerugian Harian (*Daily Stop-Loss*):** **`5.0%`**.
* **Batas Maksimum Drawdown:** **`15.0%`** dari puncak ekuitas (*Peak Equity*).
  * Drawdown $\ge 10\% \rightarrow$ Mode **`Risk-Off`** aktif (pangkas ukuran posisi 50%).
  * Drawdown $\ge 12\% \rightarrow$ Mode **`Capital Preservation`** aktif (hentikan futures, pangkas spot ke 50%).
  * *Wajib Auto-Reset kembali ke normal saat ekuitas pulih*.
* **Failsafe Kerugian Beruntun (*Loss Streak*):** **`3x Trade Rugi Berturut-turut`** $\rightarrow$ **Jeda mesin otomatis (*Cooldown*) selama 60 Menit**.

---

### E. Lapisan Keputusan AI (*AI Reasoning Layer*)
* Model: Qwen 27B / Qwen Local (`http://37.114.34.30:3573`) via Groq / Ollama.
* Peran: **Hakim / Validator Akhir**, bukan pembuat sinyal independen.
* Alur: Saat rule-based kuantitatif mendeteksi skor $\ge 68\%$, ringkasan data dikirim ke AI. AI mengeluarkan verdict: `APPROVE`, `REJECT`, atau `WAIT`.
* **Prinsip Utama AI:** *Default to WAIT/SKIP* jika kondisi tidak pasti (*Defensive posture*).

---

## 🌐 3. ARSITEKTUR INFRASTRUKTUR SAAT INI

* **Frontend:** Vercel Edge CDN (`https://aether-quant-ai.vercel.app/`) — Ringan, cepat, melayani static React UI ke user.
* **Backend:** Render Singapore (`https://aether-quant-api-sg.onrender.com/`) — Murni Python FastAPI, scheduler 60 detik, koneksi latensi rendah ke Binance Asia.
* **Keamanan:**
  * Master Token Guard (`ADMIN_SECRET_KEY`) melindungi mutasi trading, mode switch, dan setting.
  * Credential Masking (`H73P••••••••uNEV`) mencegah kebocoran API key di response JSON publik.
  * Strict CORS Allowlist membatasi domain asal ke Vercel & Render resmi.

---

## 🗺️ 4. ROADMAP PENYELARASAN (*ROLLBACK / ALIGNMENT GAPS*)

Empat tugas teknis untuk menyelaraskan kode dengan Cetak Biru Asli:
1. **[AI WIRING]**: Sambungkan `GroqAIClient` di `engine/ai/groq_client.py` ke dalam `_try_spot_entry()` dan `_try_futures_entry()` di `engine/trader.py`.
2. **[BTC ACCUMULATOR]**: Tambahkan fungsi otomatis pembelian BTC Spot dari 70% realized profit di `_close_position()`.
3. **[TP1 & RUNNER]**: Terapkan logika TP1 40% (BE+fee buffer 0.3%) dan 60% runner trailing stop adaptif per 3 rezim pasar.
4. **[RISK FLAG RECOVERY]**: Tambahkan logika reset otomatis untuk `risk_off_active` dan `capital_preservation_mode` ketika ekuitas portofolio pulih.
