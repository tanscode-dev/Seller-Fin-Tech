/* ===== Robot Shopee (Robot 3) =====
   Robot di GitHub mengambil Laporan Penghasilan (Sudah Dilepas) dan mutasi Saldo Penjual
   tiap toko Shopee lewat satu sub akun, lalu menitipkan filenya di sini. File TIDAK masuk
   sendiri: tombol Impor membuka layar impor yang biasa dengan toko sudah terisi, jadi
   isinya tetap bisa diperiksa sebelum masuk buku. */
const RS_USAHA = "fdd98c7e-d5a6-4ffa-b482-6d0d32f1bf49";   // usaha yang sub akun Shopee-nya terpasang
const RS = { run:null, file:[], peta:[], dimuat:0, t:null, sibuk:false };
const rsTampil = () => !!(AKUN && AKUN.usahaId === RS_USAHA && SB);
const rsWaktu = iso => {
  if (!iso) return "—";
  const p = Object.fromEntries(new Intl.DateTimeFormat("id-ID", { timeZone:"Asia/Jakarta", day:"2-digit", month:"2-digit",
    year:"numeric", hour:"2-digit", minute:"2-digit", hourCycle:"h23" }).formatToParts(new Date(iso)).map(x => [x.type, x.value]));
  return `${p.day}/${p.month}/${p.year} ${p.hour}.${p.minute} WIB`;
};
const RS_STATUS = {
  ANTRE:["Menunggu GitHub", ""], BERJALAN:["Sedang berjalan", ""], MENUNGGU_OTP:["Butuh kode OTP", "bad"],
  BERHASIL:["Berhasil", "ok"], SEBAGIAN:["Sebagian berhasil", "bad"], GAGAL:["Gagal", "bad"],
};
const rsTokoSeller = nama => ((RS.peta.find(p => p.nama_shopee === nama) || {}).toko_seller || "");
const rsHariIni = () => new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
const rsMundur = (tgl, n) => new Date(new Date(tgl + "T00:00:00Z").getTime() - n * 864e5).toISOString().slice(0, 10);

async function rsMuat(paksa){
  if (!rsTampil() || !document.getElementById("rs-kartu")) return;
  if (!paksa && Date.now() - RS.dimuat < 20000){ rsGambar(); return; }
  try {
    const [r, f, p] = await Promise.all([
      SB.from("shopee_robot_run").select("id,status,jenis,mode,dari_tgl,sampai_tgl,oleh,dibuat,mulai,selesai,hasil,langkah,otp_minta,otp_pesan,log_url")
        .eq("company_id", AKUN.usahaId).order("dibuat", { ascending:false }).limit(1),
      SB.from("shopee_robot_file").select("id,nama_shopee,jenis,dari_tgl,sampai_tgl,path,nama_file,status,dibuat")
        .eq("company_id", AKUN.usahaId).eq("status", "baru").order("dibuat", { ascending:false }).limit(200),
      SB.from("shopee_toko_peta").select("nama_shopee,toko_seller,aktif").eq("company_id", AKUN.usahaId).order("nama_shopee"),
    ]);
    if (r.error){ const el = document.getElementById("rs-kartu"); if (el) el.remove(); return; }
    RS.run = (r.data || [])[0] || null; RS.file = f.data || []; RS.peta = p.data || []; RS.dimuat = Date.now();
  } catch(e){ return; }
  rsGambar();
  clearTimeout(RS.t);
  if (RS.run && ["ANTRE","BERJALAN","MENUNGGU_OTP"].includes(RS.run.status)) RS.t = setTimeout(() => rsMuat(true), 5000);
}

function rsGambar(){
  const el = document.getElementById("rs-kartu");
  if (!el) return;
  const key = page === "mutasi" ? "mutasi" : "income";
  const R = RS.run;
  const st = R ? (RS_STATUS[R.status] || [R.status, ""]) : null;
  const jalan = R && ["ANTRE","BERJALAN","MENUNGGU_OTP"].includes(R.status);
  const belumPeta = RS.peta.filter(p => p.aktif && !p.toko_seller);
  const fileIni = RS.file.filter(f => f.jenis === key);
  const fileLain = RS.file.filter(f => f.jenis !== key).length;
  const toko = daftarToko();
  const dariDef = rsMundur(rsHariIni(), 14), sampaiDef = rsMundur(rsHariIni(), 1);
  el.innerHTML = `
    <div class="hd"><h2>Robot Shopee</h2>
      ${st ? `<span class="chip ${st[1]}"><span class="dot"></span>${esc(st[0])}</span>` : `<span class="note">Belum pernah dijalankan</span>`}
      <span class="note">Otomatis tiap Senin (14 hari terakhir) &amp; tanggal 3 (bulan lalu penuh)</span></div>
    <div class="bd">
      ${R ? `<div class="status" style="margin-bottom:10px">Terakhir: ${esc(R.mode === "eksplor" ? "uji login" : (R.jenis === "MANUAL" ? "manual" : R.jenis.toLowerCase()))}
        · periode ${esc(fmtD(R.dari_tgl))}–${esc(fmtD(R.sampai_tgl))} · ${esc(rsWaktu(R.mulai || R.dibuat))}${R.oleh ? " · " + esc(R.oleh) : ""}
        ${jalan && R.langkah ? `<br>Langkah: ${esc(R.langkah)}` : ""}
        ${!jalan && R.hasil ? `<br>${esc(R.hasil)}` : ""}</div>` : ""}
      ${R && R.status === "MENUNGGU_OTP" ? `<div class="warnbox" style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
        <span style="flex:1;min-width:240px"><strong>Shopee meminta kode OTP.</strong> ${esc(R.otp_pesan || "")}</span>
        <input id="rs-otp" inputmode="numeric" autocomplete="one-time-code" placeholder="Kode OTP" style="width:130px">
        <button type="button" class="btn primary" id="rs-otp-kirim">Kirim kode</button></div>` : ""}
      ${belumPeta.length ? `<div class="hint"><strong>${belumPeta.length} toko Shopee baru ditemukan.</strong>
        Pilih nama tokonya di buku ini supaya datanya masuk ke toko &amp; badan usaha yang benar. File toko ini ditahan sampai dipilih.
        ${belumPeta.map(p => `<div style="display:flex;gap:8px;align-items:center;margin-top:8px;flex-wrap:wrap">
          <span style="min-width:180px"><strong>${esc(p.nama_shopee)}</strong></span>
          <input list="rs-daftar-toko" data-rs-peta="${esc(p.nama_shopee)}" placeholder="Nama toko di Seller" value="${esc(toko.find(t => t.toLowerCase() === p.nama_shopee.toLowerCase()) || "")}" style="min-width:200px">
          <button type="button" class="btn" data-rs-simpan="${esc(p.nama_shopee)}">Simpan</button>
          <button type="button" class="btn ghost" data-rs-abaikan="${esc(p.nama_shopee)}" title="Toko ini tidak diambil robot">Abaikan toko</button></div>`).join("")}
        <datalist id="rs-daftar-toko">${toko.map(t => `<option value="${esc(t)}">`).join("")}</datalist></div>` : ""}
      ${fileIni.length ? `<div class="tablewrap" style="margin:10px 0"><table><thead><tr><th>Toko</th><th>Periode</th><th>Diambil</th><th></th></tr></thead><tbody>
        ${fileIni.map(f => { const ts = rsTokoSeller(f.nama_shopee); return `<tr>
          <td><strong>${esc(ts || f.nama_shopee)}</strong>${ts && ts !== f.nama_shopee ? `<div class="status">Shopee: ${esc(f.nama_shopee)}</div>` : ""}</td>
          <td>${esc(fmtD(f.dari_tgl))} – ${esc(fmtD(f.sampai_tgl))}</td><td class="status">${esc(rsWaktu(f.dibuat))}</td>
          <td style="text-align:right;white-space:nowrap">${ts ? `<button type="button" class="btn primary" data-rs-impor="${esc(f.id)}">Impor</button>` : `<span class="status">pilih tokonya dulu</span>`}
            <button type="button" class="btn ghost" data-rs-lewati="${esc(f.id)}" title="Tandai tidak perlu diimpor">Lewati</button></td></tr>`; }).join("")}
        </tbody></table></div>`
        : `<div class="status" style="margin:6px 0 10px">Tidak ada file ${key === "mutasi" ? "mutasi saldo" : "penghasilan"} baru dari robot.</div>`}
      ${fileLain ? `<div class="status" style="margin-bottom:10px">${fileLain} file ${key === "mutasi" ? "penghasilan" : "mutasi saldo"} menunggu di halaman ${key === "mutasi" ? "Penghasilan Marketplace" : "Mutasi Saldo"}.</div>` : ""}
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
        <label class="status">Periode <input type="date" id="rs-dari" value="${dariDef}"> – <input type="date" id="rs-sampai" value="${sampaiDef}"></label>
        <button type="button" class="btn primary" id="rs-jalan"${jalan ? " disabled" : ""}>Ambil sekarang</button>
        <button type="button" class="btn ghost" id="rs-uji"${jalan ? " disabled" : ""} title="Hanya login & membaca daftar toko, tanpa mengambil data">Uji login</button>
        ${R && R.log_url ? `<a class="btn ghost" href="${esc(R.log_url)}" target="_blank" rel="noopener">Log robot</a>` : ""}
      </div>
    </div>`;
  const $ = s => el.querySelector(s);
  const jalankan = async mode => {
    const d1 = $("#rs-dari").value, d2 = $("#rs-sampai").value;
    if (!d1 || !d2 || d2 < d1){ pesan("Periode belum benar."); return; }
    const { error } = await SB.rpc("shopee_robot_jalankan", { p_company: AKUN.usahaId, p_dari: d1, p_sampai: d2, p_mode: mode });
    if (error){ pesan(error.message, "Robot Shopee"); return; }
    rsMuat(true);
  };
  $("#rs-jalan").onclick = () => jalankan("biasa");
  $("#rs-uji").onclick = () => jalankan("eksplor");
  const otp = $("#rs-otp-kirim");
  if (otp) otp.onclick = async () => {
    const k = ($("#rs-otp").value || "").trim();
    if (!/^\d{4,8}$/.test(k)){ pesan("Kode OTP biasanya 6 angka."); return; }
    const { data, error } = await SB.rpc("shopee_robot_otp", { p_run: R.id, p_kode: k });
    if (error || !data){ pesan((error && error.message) || "Kode tidak terkirim — mungkin robot sudah tidak menunggu.", "Robot Shopee"); return; }
    $("#rs-otp").value = ""; otp.disabled = true; otp.textContent = "Terkirim…";
    rsMuat(true);
  };
  el.querySelectorAll("[data-rs-simpan]").forEach(b => b.onclick = async () => {
    const nama = b.dataset.rsSimpan;
    const v = (el.querySelector(`[data-rs-peta="${CSS.escape(nama)}"]`) || {}).value || "";
    if (!v.trim()){ pesan("Tulis atau pilih nama toko di buku ini."); return; }
    const { error } = await SB.rpc("shopee_toko_atur", { p_company: AKUN.usahaId, p_nama_shopee: nama, p_toko: v.trim(), p_aktif: true });
    if (error){ pesan(error.message, "Robot Shopee"); return; }
    rsMuat(true);
  });
  el.querySelectorAll("[data-rs-abaikan]").forEach(b => b.onclick = async () => {
    if (!await konfirmasi(`Toko Shopee "${b.dataset.rsAbaikan}" tidak akan diambil robot lagi. Bisa diaktifkan kembali kapan saja.`, "Abaikan toko", "Batal")) return;
    const { error } = await SB.rpc("shopee_toko_atur", { p_company: AKUN.usahaId, p_nama_shopee: b.dataset.rsAbaikan, p_toko: null, p_aktif: false });
    if (error){ pesan(error.message, "Robot Shopee"); return; }
    rsMuat(true);
  });
  el.querySelectorAll("[data-rs-lewati]").forEach(b => b.onclick = async () => {
    const { error } = await SB.rpc("shopee_file_tandai", { p_id: b.dataset.rsLewati, p_status: "dilewati" });
    if (error){ pesan(error.message, "Robot Shopee"); return; }
    rsMuat(true);
  });
  el.querySelectorAll("[data-rs-impor]").forEach(b => b.onclick = () => rsImpor(b.dataset.rsImpor, b));
}

async function rsImpor(id, tombol){
  const f = RS.file.find(x => x.id === id);
  if (!f) return;
  const toko = rsTokoSeller(f.nama_shopee);
  if (!toko){ pesan("Pilih dulu nama toko di buku ini untuk " + f.nama_shopee + "."); return; }
  const label = tombol.textContent; tombol.disabled = true; tombol.textContent = "Mengunduh…";
  try {
    const { data, error } = await SB.storage.from("shopee-inbox").download(f.path);
    if (error || !data) throw new Error((error && error.message) || "file tidak ditemukan");
    let nama = (f.nama_file || f.path.split("/").pop());
    if (!/\.(xlsx|xls|csv)$/i.test(nama)) nama += ".xlsx";
    const berkas = new File([data], nama, { type: data.type || "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    openImport(f.jenis);
    IMP.toko = toko; IMP.plat = "shopee"; IMP.robotFile = f.id;
    await readFiles([berkas]);
  } catch(e){
    pesan("File robot tidak bisa dibuka: " + (e.message || e), "Robot Shopee");
  } finally { tombol.disabled = false; tombol.textContent = label; }
}
async function rsTandai(id, status){
  const { error } = await SB.rpc("shopee_file_tandai", { p_id: id, p_status: status });
  if (!error){ RS.dimuat = 0; rsMuat(true); }
}
