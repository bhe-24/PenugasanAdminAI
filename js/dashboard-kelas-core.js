import { auth, db } from '/js/firebase-config.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js';
import {
    collection, doc, getDoc, getDocs, setDoc, query, where
} from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js';

const cfg = window.DK_CONFIG || {
    tier: 'free',
    tierLabel: 'Member Free',
    homeUrl: '/mem-free/index.html',
    defaultClassUrl: '/dashboard/index.html'
};

let state = {
    uid: '',
    user: null,
    enrolledClass: null,
    regData: null,
    semester: 1,
    ips: 0,
    targetIps: 3.0,
    targetNote: '',
    metrics: null,
    allTableRows: [],
    showAllRows: false,
    aiLoading: false
};

function escapeHtml(str) {
    if (!str && str !== 0) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function getGradeMeta(scoreNum) {
    if (scoreNum === null || scoreNum === undefined || scoreNum === '' || Number.isNaN(Number(scoreNum))) {
        return { letter: '-', bobot: null, cls: 'grade-none' };
    }
    const n = Number(scoreNum);
    if (n >= 85) return { letter: 'A', bobot: 4.0, cls: 'grade-A' };
    if (n >= 75) return { letter: 'B', bobot: 3.0, cls: 'grade-B' };
    if (n >= 60) return { letter: 'C', bobot: 2.0, cls: 'grade-C' };
    if (n >= 50) return { letter: 'D', bobot: 1.0, cls: 'grade-D' };
    return { letter: 'E', bobot: 0.0, cls: 'grade-E' };
}

function formatDateShort(val) {
    if (!val) return '-';
    try {
        const d = typeof val.toDate === 'function' ? val.toDate() : new Date(val);
        if (Number.isNaN(d.getTime())) return String(val).slice(0, 12);
        return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
    } catch (_) {
        return '-';
    }
}

function matchSemester(itemSem, userSem) {
    if (!itemSem && itemSem !== 0) return true;
    const raw = String(itemSem).trim();
    if (!raw || raw.toLowerCase() === 'all' || raw.toLowerCase() === 'semua') return true;
    const targetNum = Number(userSem) || 1;
    const extracted = parseInt(raw.replace(/\D+/g, ''), 10);
    if (!Number.isNaN(extracted)) return extracted === targetNum;
    return raw === String(targetNum);
}

function setHeaderBadge(text, bg, color) {
    const el = document.getElementById('dkHeaderStatusBadge');
    if (!el) return;
    el.textContent = text;
    el.style.background = bg;
    el.style.color = color;
}

function refreshIcons() {
    if (window.lucide) {
        try { window.lucide.createIcons(); } catch (_) {}
    }
}

function renderCardShell(mode) {
    const card = document.getElementById('idCardContainer');
    if (!card) return;

    card.classList.remove('is-empty', 'is-pending');
    const u = state.user || {};
    const nama = u.name || u.displayName || 'Siswa Cendekia';

    const photoWrapper = document.getElementById('idCardPhotoWrapper');
    if (photoWrapper) {
        const photoUrl = (u.photo || u.photoURL || '').trim();
        if (photoUrl) {
            photoWrapper.innerHTML = `<img src="${escapeHtml(photoUrl)}" alt="${escapeHtml(nama)}" onerror="this.onerror=null; this.parentNode.innerHTML='<span class=\\'id-photo-initial\\'>${escapeHtml(nama[0].toUpperCase())}</span>';">`;
        } else {
            photoWrapper.innerHTML = `<span class="id-photo-initial">${escapeHtml((nama[0] || 'S').toUpperCase())}</span>`;
        }
    }

    document.getElementById('idCardName').textContent = nama;

    const statusEl = document.getElementById('idCardStatusText');
    const yearEl = document.getElementById('idCardYear');
    const unregEl = document.getElementById('dkUnregisteredSection');
    const pendEl = document.getElementById('dkPendingSection');
    const enrolledEl = document.getElementById('dkEnrolledSection');

    if (unregEl) unregEl.style.display = 'none';
    if (pendEl) pendEl.style.display = 'none';
    if (enrolledEl) enrolledEl.style.display = 'none';

    if (mode === 'empty') {
        card.classList.add('is-empty');
        document.getElementById('idCardReg').textContent = '— (Kartu Kosong)';
        document.getElementById('idCardClass').textContent = 'Belum Terdaftar di Kelas Resmi';
        document.getElementById('idCardSemester').textContent = 'Belum Terdaftar';
        if (statusEl) {
            statusEl.innerHTML = '<span style="color:#fcd34d;">BELUM TERDAFTAR</span>';
        }
        if (yearEl) yearEl.textContent = 'KARTU KOSONG';
        setHeaderBadge('Belum Terdaftar', '#fef3c7', '#b45309');

        if (unregEl) {
            unregEl.style.display = 'block';
            prefillRegistrationForm();
            const rejBox = document.getElementById('dkRejectNotice');
            if (rejBox) {
                if (state.regData?.status === 'rejected') {
                    rejBox.style.display = 'block';
                    rejBox.innerHTML = `<strong>Pengajuan sebelumnya ditolak:</strong> ${escapeHtml(state.regData.rejectReason || 'Silakan perbaiki data dan daftar ulang.')}`;
                } else {
                    rejBox.style.display = 'none';
                }
            }
        }
    } else if (mode === 'pending') {
        card.classList.add('is-pending');
        const reqSem = state.regData?.requestedSemester || 1;
        document.getElementById('idCardReg').textContent = 'MENUNGGU VERIFIKASI';
        document.getElementById('idCardClass').textContent = 'Menunggu Penempatan Admin';
        document.getElementById('idCardSemester').textContent = `Ajuan Sem ${reqSem}`;
        if (statusEl) {
            statusEl.innerHTML = '<span style="color:#fde68a;">MENUNGGU VERIFIKASI</span>';
        }
        if (yearEl) yearEl.textContent = 'DIPROSES';
        setHeaderBadge('Menunggu Verifikasi', '#dbeafe', '#1d4ed8');

        if (pendEl) {
            pendEl.style.display = 'block';
            const sumEl = document.getElementById('dkPendingSummary');
            if (sumEl && state.regData) {
                sumEl.innerHTML = `
                    <div><b>Nama:</b> ${escapeHtml(state.regData.name || nama)}</div>
                    <div><b>Pilihan Awal:</b> Semester ${escapeHtml(state.regData.requestedSemester || 1)} &bull; <b>Instansi:</b> ${escapeHtml(state.regData.instansi || '-')}</div>
                    <div><b>Waktu Pengajuan:</b> ${escapeHtml(formatDateShort(state.regData.createdAt))}</div>
                `;
            }
        }
    } else {
        const cls = state.enrolledClass;
        const sem = state.semester;
        const nis = u.nis || (state.uid ? `CA-${state.uid.slice(0, 6).toUpperCase()}` : 'CA-AKTIF');
        const clsName = cls?.name || cls?.nama || u.className || 'Kelas Reguler';

        document.getElementById('idCardReg').textContent = nis;
        document.getElementById('idCardClass').textContent = clsName;
        document.getElementById('idCardSemester').textContent = `Semester ${sem}`;
        if (statusEl) {
            statusEl.innerHTML = '<span style="color:#86efac;">AKTIF TERVERIFIKASI</span>';
        }
        if (yearEl) yearEl.textContent = '2026 / AKTIF';
        setHeaderBadge(`Aktif • Sem ${sem}`, '#dcfce7', '#15803d');

        // Active status banner + official room link
        const activeSub = document.getElementById('dkActiveBannerSub');
        if (activeSub) activeSub.textContent = `${clsName} • Semester ${sem}`;

        const badgeSemLink = document.getElementById('badgeSemLink');
        if (badgeSemLink) badgeSemLink.textContent = `Semester ${sem}`;

        const officialTitle = document.getElementById('officialClassTitle');
        const officialDesc = document.getElementById('officialClassDesc');
        const btnGo = document.getElementById('btnGoToOfficialDashboard');
        if (sem >= 3) {
            if (officialTitle) officialTitle.textContent = 'Ruang Studio Inkubasi Naskah';
            if (officialDesc) officialDesc.textContent = `${clsName} • Inkubasi & kurasi buku resmi`;
            if (btnGo) btnGo.href = '/dashboard/inkubasi.html';
        } else {
            if (officialTitle) officialTitle.textContent = 'Ruang Kelas Bimbingan';
            if (officialDesc) officialDesc.textContent = `${clsName} • Silabus, tugas, & presensi resmi`;
            if (btnGo) btnGo.href = '/dashboard/index.html';
        }

        if (enrolledEl) enrolledEl.style.display = 'block';
    }

    refreshIcons();
}

function prefillRegistrationForm() {
    const u = state.user || {};
    const r = state.regData || {};
    const setVal = (id, v) => {
        const el = document.getElementById(id);
        if (el && !el.value) el.value = v || '';
    };
    setVal('regName', r.name || u.name || u.displayName || '');
    setVal('regEmail', r.email || u.email || '');
    setVal('regWhatsapp', r.whatsapp || u.whatsapp || u.noHp || u.phone || '');
    setVal('regInstansi', r.instansi || u.instansi || '');
    setVal('regAlasan', r.reason || r.alasan || u.alasan || '');
    const semSel = document.getElementById('regSemester');
    if (semSel && (r.requestedSemester || u.semester)) {
        const val = String(r.requestedSemester || u.semester);
        if (['1', '2', '3'].includes(val)) semSel.value = val;
    }
}

async function handleRegistrationSubmit(e) {
    e.preventDefault();
    if (!state.uid) {
        alert('Silakan login terlebih dahulu sebelum mendaftar kelas.');
        window.location.href = '/login.html';
        return;
    }

    const name = document.getElementById('regName').value.trim();
    const email = document.getElementById('regEmail').value.trim();
    const whatsapp = document.getElementById('regWhatsapp').value.trim();
    const instansi = document.getElementById('regInstansi').value.trim();
    const requestedSemester = Number(document.getElementById('regSemester').value) || 1;
    const reason = document.getElementById('regAlasan').value.trim();

    if (!name || !whatsapp || !instansi || !reason) {
        alert('Mohon lengkapi semua kolom formulir pendaftaran kelas.');
        return;
    }

    const submitBtn = document.getElementById('btnSubmitClassReg');
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Mengirim Pendaftaran...';
    }

    try {
        const nowIso = new Date().toISOString();
        const regPayload = {
            uid: state.uid,
            name,
            email: email || state.user?.email || '',
            whatsapp,
            instansi,
            requestedSemester,
            reason,
            package: state.user?.package || cfg.tier || 'free',
            status: 'pending_verification',
            createdAt: nowIso
        };

        await setDoc(doc(db, 'class_registrations', state.uid), regPayload, { merge: true });
        await setDoc(doc(db, 'users', state.uid), {
            name,
            whatsapp,
            instansi,
            alasan: reason,
            classRegStatus: 'pending_verification'
        }, { merge: true });

        state.regData = regPayload;
        state.user = { ...(state.user || {}), name, whatsapp, instansi, classRegStatus: 'pending_verification' };
        if (window.CendekiaApp?.saveUser) window.CendekiaApp.saveUser(state.user);

        renderCardShell('pending');
    } catch (err) {
        console.error('Gagal kirim pendaftaran kelas:', err);
        alert('Gagal mengirim formulir pendaftaran: ' + err.message);
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = 'Kirim Pendaftaran Kelas';
        }
    }
}

function buildStructuredNotifications(data) {
    const items = [];
    const {
        pendingAssignments,
        gradedRows,
        activeQuizzes,
        activeExams,
        attendancePct,
        presentCount,
        totalSessions,
        ips,
        targetIps,
        wordCount,
        materials
    } = data;

    // 1. Admin uploaded new / pending assignments
    if (pendingAssignments.length > 0) {
        const newest = pendingAssignments[0];
        items.push({
            tone: 'alert',
            tag: `${pendingAssignments.length} Baru`,
            tagBg: '#fef3c7',
            tagColor: '#b45309',
            title: `Tugas baru tersedia: ${newest.judul || 'Tugas Kelas'}`,
            desc: `${newest.mapel || 'Materi Kelas'}${newest.deadline ? ` • Tenggat ${formatDateShort(newest.deadline)}` : ' • Segera kerjakan di ruang tugas.'}`,
            href: '/tugas/index.html'
        });
    } else {
        items.push({
            tone: 'success',
            tag: 'Tuntas',
            tagBg: '#dcfce7',
            tagColor: '#15803d',
            title: 'Seluruh tugas kelas saat ini sudah dikumpulkan',
            desc: 'Pantau terus pembaruan tugas baru dari pengajar di ruang tugas resmi.',
            href: '/tugas/index.html'
        });
    }

    // 2. Graded assignments / score released notice
    if (gradedRows.length > 0) {
        const latestGraded = gradedRows[0];
        items.push({
            tone: 'success',
            tag: `Nilai ${latestGraded.score}`,
            tagBg: '#dbeafe',
            tagColor: '#1d4ed8',
            title: `Hasil penilaian keluar: ${latestGraded.title}`,
            desc: `Predikat huruf ${latestGraded.letter} tercatat di rincian hasil pembelajaran Anda.`,
            href: '#dkSectionGrades'
        });
    } else {
        items.push({
            tone: 'normal',
            tag: 'Penilaian',
            tagBg: '#f1f5f9',
            tagColor: '#475569',
            title: 'Menunggu publikasi nilai tugas dari mentor',
            desc: 'Nilai yang sudah dikoreksi admin akan tampil otomatis di tabel bawah.',
            href: '#dkSectionGrades'
        });
    }

    // 3. Quiz or Exam info
    if (activeExams.length > 0 || activeQuizzes.length > 0) {
        const targetEval = activeExams[0] || activeQuizzes[0];
        const isExam = activeExams.length > 0;
        items.push({
            tone: 'danger',
            tag: isExam ? 'Ujian' : 'Kuis',
            tagBg: '#fee2e2',
            tagColor: '#b91c1c',
            title: `${isExam ? 'Jadwal ujian aktif' : 'Kuis tersedia'}: ${targetEval.judul || targetEval.title || 'Evaluasi'}`,
            desc: 'Kerjakan sebelum batas waktu untuk menambah bobot poin IPS semester.',
            href: isExam ? '/ujian/index.html' : '/kuis/index.html'
        });
    } else {
        items.push({
            tone: 'normal',
            tag: 'Evaluasi',
            tagBg: '#f1f5f9',
            tagColor: '#475569',
            title: 'Belum ada ujian mendesak pada semester ini',
            desc: 'Gunakan waktu untuk memperdalam latihan soal dan bacaan materi.',
            href: '/kuis/index.html'
        });
    }

    // 4. Attendance info
    items.push({
        tone: attendancePct >= 80 ? 'success' : 'alert',
        tag: `${attendancePct}% Hadir`,
        tagBg: attendancePct >= 80 ? '#dcfce7' : '#fef3c7',
        tagColor: attendancePct >= 80 ? '#15803d' : '#b45309',
        title: `Rekap kehadiran bimbingan: ${presentCount}/${totalSessions} sesi`,
        desc: attendancePct >= 80
            ? 'Kehadiran Anda memenuhi syarat keaktifan minimal kelas reguler.'
            : 'Usahakan presensi minimal 80% di setiap sesi kelas resmi.',
        href: state.semester >= 3 ? '/dashboard/inkubasi.html' : '/dashboard/index.html'
    });

    // 5. Target / Studio / Reading materials info
    if (state.semester >= 3) {
        items.push({
            tone: 'normal',
            tag: `${Number(wordCount || 0).toLocaleString('id-ID')} Kata`,
            tagBg: '#ede9fe',
            tagColor: '#6d28d9',
            title: 'Sinkronisasi progres Studio Menulis Semester 3',
            desc: `Target IPS Anda ${targetIps.toFixed(2)} (Saat ini ${ips.toFixed(2)}). Lanjutkan setoran naskah.`,
            href: '/dashboard/inkubasi.html'
        });
    } else if (materials.length > 0) {
        items.push({
            tone: 'normal',
            tag: 'Materi',
            tagBg: '#e0f2fe',
            tagColor: '#0369a1',
            title: `Bahan ajar tersedia: ${materials[0].title || materials[0].judul}`,
            desc: `Buka modul untuk bantu kejar target IPS ${targetIps.toFixed(2)} semester ini.`,
            href: `${cfg.homeUrl.replace('/index.html', '/belajar.html')}`
        });
    } else {
        items.push({
            tone: ips >= targetIps ? 'success' : 'alert',
            tag: `Target ${targetIps.toFixed(2)}`,
            tagBg: ips >= targetIps ? '#dcfce7' : '#fef3c7',
            tagColor: ips >= targetIps ? '#15803d' : '#b45309',
            title: ips >= targetIps ? 'Capaian IPS sudah memenuhi target!' : `Selisih ${(targetIps - ips).toFixed(2)} menuju target IPS`,
            desc: 'Cek grafik & rekomendasi AI di bawah untuk langkah paling efektif.',
            href: '#dkSectionTarget'
        });
    }

    return items.slice(0, 5);
}

function renderFiveInfoList(items) {
    const container = document.getElementById('dkInfoList');
    if (!container) return;

    container.innerHTML = items.map((it, idx) => {
        const toneCls = it.tone === 'alert' ? 'is-alert' : (it.tone === 'success' ? 'is-success' : (it.tone === 'danger' ? 'is-danger' : ''));
        return `
            <a href="${escapeHtml(it.href || '#')}" class="dk-info-item">
                <span class="dk-info-num ${toneCls}">${idx + 1}</span>
                <div class="dk-info-content">
                    <div class="dk-info-top">
                        <span class="dk-info-title">${escapeHtml(it.title)}</span>
                        <span class="dk-info-pill" style="background:${it.tagBg}; color:${it.tagColor};">${escapeHtml(it.tag)}</span>
                    </div>
                    <div class="dk-info-desc">${escapeHtml(it.desc)}</div>
                </div>
            </a>
        `;
    }).join('');
}

function renderProgressSection(m) {
    const container = document.getElementById('dkProgressGrid');
    if (!container) return;

    const taskPct = m.totalAssignments > 0 ? Math.round((m.submittedCount / m.totalAssignments) * 100) : (m.submittedCount > 0 ? 100 : 0);
    const quizLabel = m.quizCount > 0 ? `${m.quizCount} selesai` : '0 selesai';
    const fourthTitle = state.semester >= 3 ? 'Naskah Studio' : 'Rata-Rata Nilai';
    const fourthVal = state.semester >= 3
        ? `${Number(m.wordCount || 0).toLocaleString('id-ID')} kata`
        : (m.avgScore > 0 ? `${m.avgScore.toFixed(1)} / 100` : 'Belum ada');
    const fourthPct = state.semester >= 3
        ? Math.min(100, Math.round((Number(m.wordCount || 0) / 15000) * 100))
        : Math.min(100, Math.round(m.avgScore));

    container.innerHTML = `
        <div class="dk-prog-tile">
            <div class="dk-prog-label"><span>Tugas Kelas</span><span>${taskPct}%</span></div>
            <div class="dk-prog-val">${m.submittedCount} / ${m.totalAssignments}</div>
            <div class="dk-bar-track"><div class="dk-bar-fill" style="width:${taskPct}%; background:#2563eb;"></div></div>
        </div>
        <div class="dk-prog-tile">
            <div class="dk-prog-label"><span>Presensi</span><span>${m.attendancePct}%</span></div>
            <div class="dk-prog-val">${m.presentCount} / ${m.totalSessions} sesi</div>
            <div class="dk-bar-track"><div class="dk-bar-fill" style="width:${m.attendancePct}%; background:#16a34a;"></div></div>
        </div>
        <div class="dk-prog-tile">
            <div class="dk-prog-label"><span>Kuis &amp; Ujian</span><span>${m.quizAvg > 0 ? `Avg ${m.quizAvg}` : '-'}</span></div>
            <div class="dk-prog-val">${quizLabel}</div>
            <div class="dk-bar-track"><div class="dk-bar-fill" style="width:${Math.min(100, m.quizAvg || (m.quizCount ? 60 : 0))}%; background:#d97706;"></div></div>
        </div>
        <div class="dk-prog-tile">
            <div class="dk-prog-label"><span>${fourthTitle}</span><span>IPS ${state.ips.toFixed(2)}</span></div>
            <div class="dk-prog-val">${fourthVal}</div>
            <div class="dk-bar-track"><div class="dk-bar-fill" style="width:${fourthPct}%; background:#7c3aed;"></div></div>
        </div>
    `;
}

function renderResultsTable() {
    const tbody = document.getElementById('dkResultsBody');
    const toggleBtn = document.getElementById('dkBtnToggleRows');
    const sumEl = document.getElementById('dkResultsSummary');
    if (!tbody) return;

    const rows = state.allTableRows || [];
    if (rows.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; color:#64748b; padding:10px;">Belum ada rincian nilai/tugas yang tercatat.</td></tr>`;
        if (toggleBtn) toggleBtn.style.display = 'none';
    } else {
        const visible = state.showAllRows ? rows : rows.slice(0, 6);
        tbody.innerHTML = visible.map((r) => `
            <tr>
                <td style="font-weight:700; color:#0f172a;">${escapeHtml(r.title)}</td>
                <td style="color:#64748b; font-size:0.62rem;">${escapeHtml(r.detail)}</td>
                <td style="text-align:center; font-weight:800;">${r.score !== '-' ? escapeHtml(r.score) : '-'}</td>
                <td style="text-align:center;"><span class="dk-grade-chip ${r.gradeCls}">${escapeHtml(r.letter)}</span></td>
            </tr>
        `).join('');

        if (toggleBtn) {
            if (rows.length > 6) {
                toggleBtn.style.display = 'inline-block';
                toggleBtn.textContent = state.showAllRows ? 'Ringkas Tabel' : `Lihat Semua (${rows.length})`;
            } else {
                toggleBtn.style.display = 'none';
            }
        }
    }

    if (sumEl && state.metrics) {
        const ipsText = state.ips.toFixed(2);
        const pred = state.ips >= 3.5 ? 'Sangat Baik' : (state.ips >= 2.75 ? 'Baik' : (state.ips >= 2.0 ? 'Cukup' : 'Perlu Ditingkatkan'));
        sumEl.innerHTML = `
            <span><b>Komponen Dinilai:</b> ${state.metrics.gradedCount}</span>
            <span><b>IPS:</b> <strong style="color:#001f3f;">${ipsText}</strong> (${pred})</span>
        `;
    }
}

function renderTargetChart(m) {
    const chartEl = document.getElementById('dkTargetChartBox');
    if (!chartEl) return;

    const target = Math.max(0.5, Math.min(4.0, Number(state.targetIps) || 3.0));
    const current = Math.max(0, Math.min(4.0, Number(state.ips) || 0));
    const ratio = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;
    const targetPosPct = Math.min(98, Math.round((target / 4.0) * 100));
    const actualWidthPct = Math.min(100, Math.round((current / 4.0) * 100));

    const barColor = current >= target ? '#16a34a' : (ratio >= 75 ? '#2563eb' : '#d97706');
    const taskPct = m.totalAssignments > 0 ? Math.round((m.submittedCount / m.totalAssignments) * 100) : 0;
    const scorePct = Math.min(100, Math.round(m.avgScore || 0));

    let sparkHtml = '';
    if (Array.isArray(m.historyPoints) && m.historyPoints.length >= 2) {
        const pts = m.historyPoints.slice(-6);
        const w = 280;
        const h = 44;
        const step = w / Math.max(1, pts.length - 1);
        const polyPts = pts.map((p, i) => {
            const x = Math.round(i * step);
            const y = Math.round(h - ((Math.min(4, Math.max(0, Number(p.ips) || 0)) / 4) * (h - 8)) - 4);
            return `${x},${y}`;
        }).join(' ');
        const targetY = Math.round(h - ((target / 4) * (h - 8)) - 4);
        sparkHtml = `
            <div style="margin-top:8px; padding-top:7px; border-top:1px dashed #cbd5e1;">
                <div style="font-size:0.6rem; font-weight:700; color:#64748b; margin-bottom:4px; display:flex; justify-content:space-between;">
                    <span>Tren Riwayat IPS</span>
                    <span style="color:#dc2626;">Garis Merah: Target ${target.toFixed(2)}</span>
                </div>
                <svg viewBox="0 0 ${w} ${h}" style="width:100%; height:44px; display:block; overflow:visible;">
                    <line x1="0" y1="${targetY}" x2="${w}" y2="${targetY}" stroke="#dc2626" stroke-width="1.2" stroke-dasharray="3 3" />
                    <polyline fill="none" stroke="#003366" stroke-width="2" points="${polyPts}" />
                </svg>
            </div>
        `;
    }

    chartEl.innerHTML = `
        <div class="dk-meter-row">
            <div class="dk-meter-labels">
                <span>Kesesuaian Target IPS: <b>${current.toFixed(2)}</b> / ${target.toFixed(2)}</span>
                <span style="color:${barColor};">${ratio}% tercapai</span>
            </div>
            <div class="dk-target-bar-wrap">
                <div class="dk-target-bar-actual" style="width:${actualWidthPct}%; background:${barColor};"></div>
                <div class="dk-target-marker" style="left:${targetPosPct}%;" title="Target ${target.toFixed(2)}"></div>
            </div>
            <div style="display:flex; justify-content:space-between; font-size:0.56rem; color:#64748b; margin-top:3px;">
                <span>0.00</span>
                <span style="color:#dc2626; font-weight:700;">Garis Target: ${target.toFixed(2)}</span>
                <span>4.00</span>
            </div>
        </div>

        <div style="display:grid; grid-template-columns:repeat(3,1fr); gap:6px; margin-top:6px;">
            <div style="background:white; border:1px solid #e2e8f0; border-radius:7px; padding:5px 6px;">
                <div style="font-size:0.58rem; color:#64748b; font-weight:700;">Tugas</div>
                <div style="font-size:0.72rem; font-weight:800; color:#001f3f;">${taskPct}%</div>
                <div class="dk-bar-track"><div class="dk-bar-fill" style="width:${taskPct}%; background:#2563eb;"></div></div>
            </div>
            <div style="background:white; border:1px solid #e2e8f0; border-radius:7px; padding:5px 6px;">
                <div style="font-size:0.58rem; color:#64748b; font-weight:700;">Kehadiran</div>
                <div style="font-size:0.72rem; font-weight:800; color:#001f3f;">${m.attendancePct}%</div>
                <div class="dk-bar-track"><div class="dk-bar-fill" style="width:${m.attendancePct}%; background:#16a34a;"></div></div>
            </div>
            <div style="background:white; border:1px solid #e2e8f0; border-radius:7px; padding:5px 6px;">
                <div style="font-size:0.58rem; color:#64748b; font-weight:700;">Rata Skor</div>
                <div style="font-size:0.72rem; font-weight:800; color:#001f3f;">${scorePct}</div>
                <div class="dk-bar-track"><div class="dk-bar-fill" style="width:${scorePct}%; background:#7c3aed;"></div></div>
            </div>
        </div>
        ${sparkHtml}
    `;
}

function syncTargetChipsUI() {
    const val = Number(state.targetIps) || 3.0;
    const inp = document.getElementById('dkTargetInput');
    if (inp) inp.value = val.toFixed(2);
    const noteInp = document.getElementById('dkTargetNoteInput');
    if (noteInp && state.targetNote) noteInp.value = state.targetNote;

    document.querySelectorAll('.dk-chip-btn').forEach((btn) => {
        const chipVal = Number(btn.dataset.target);
        btn.classList.toggle('active', Math.abs(chipVal - val) < 0.06);
    });
}

function renderAiResultBox(data) {
    const box = document.getElementById('dkAiOutput');
    if (!box) return;

    const recs = Array.isArray(data?.recommendations) ? data.recommendations : [];
    box.innerHTML = `
        <div style="font-size:0.7rem; color:#1e293b; font-weight:600; line-height:1.4; margin-bottom:4px;">
            ${escapeHtml(data.summaryAnalysis || '')}
        </div>
        <div style="font-size:0.63rem; color:#1d4ed8; font-weight:700; margin-bottom:4px;">
            ${escapeHtml(data.gapInfo || '')}
        </div>
        ${recs.map((rec) => {
            const p = String(rec.priority || '').toLowerCase();
            const cls = p.includes('tinggi') ? 'prio-high' : (p.includes('opt') || p.includes('pertahan') ? 'prio-opt' : 'prio-med');
            return `
                <div class="dk-ai-rec-item ${cls}">
                    <div style="display:flex; justify-content:space-between; align-items:center; gap:6px; margin-bottom:2px;">
                        <strong style="font-size:0.69rem; color:#0f172a;">${escapeHtml(rec.title)}</strong>
                        <span style="font-size:0.56rem; font-weight:800; color:#475569; background:#f1f5f9; padding:1px 6px; border-radius:999px; white-space:nowrap;">${escapeHtml(rec.category || rec.priority)}</span>
                    </div>
                    <div style="font-size:0.64rem; color:#475569; line-height:1.35;">${escapeHtml(rec.actionDetail)}</div>
                </div>
            `;
        }).join('')}
    `;
}

async function runTargetAiAnalysis(forceRefresh = false) {
    const box = document.getElementById('dkAiOutput');
    const btn = document.getElementById('dkBtnRunAi');
    if (!state.metrics || state.aiLoading) return;

    const cacheKey = `dk_ai_target_${state.uid}_${Number(state.targetIps).toFixed(2)}`;
    if (!forceRefresh) {
        try {
            const cached = JSON.parse(localStorage.getItem(cacheKey) || 'null');
            if (cached && Date.now() - cached.savedAt < 6 * 60 * 60 * 1000) {
                renderAiResultBox(cached.data);
                return;
            }
        } catch (_) {}
    }

    state.aiLoading = true;
    if (btn) btn.disabled = true;
    if (box) {
        box.innerHTML = `<div style="font-size:0.68rem; color:#1d4ed8; font-weight:700; padding:6px 0;">Menyusun rekomendasi tugas &amp; materi untuk target IPS ${Number(state.targetIps).toFixed(2)}...</div>`;
    }

    try {
        const res = await fetch('/api/central', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'analyze-student-target',
                studentName: state.user?.name || 'Siswa',
                semester: state.semester,
                className: state.enrolledClass?.name || 'Kelas Reguler',
                ips: state.ips,
                targetIps: state.targetIps,
                scores: state.metrics.scoreMap,
                attendancePct: state.metrics.attendancePct,
                submittedCount: state.metrics.submittedCount,
                totalAssignments: state.metrics.totalAssignments,
                unsubmittedTasks: state.metrics.pendingAssignments.slice(0, 6).map((t) => ({
                    judul: t.judul || t.title,
                    mapel: t.mapel || '',
                    deadline: t.deadline || ''
                })),
                availableMaterials: state.metrics.materials.slice(0, 6).map((m) => ({
                    title: m.title || m.judul || 'Modul Literasi'
                })),
                wordCount: state.metrics.wordCount,
                quizAvg: state.metrics.quizAvg
            })
        });
        const json = await res.json();
        renderAiResultBox(json);
        try {
            localStorage.setItem(cacheKey, JSON.stringify({ savedAt: Date.now(), data: json }));
        } catch (_) {}
    } catch (err) {
        console.warn('AI target advisor error:', err);
        if (box) {
            box.innerHTML = `<div style="font-size:0.68rem; color:#b91c1c;">Gagal memuat analisis AI saat ini. Coba tekan tombol perbarui sebentar lagi.</div>`;
        }
    } finally {
        state.aiLoading = false;
        if (btn) btn.disabled = false;
    }
}

async function saveStudentTarget() {
    const inp = document.getElementById('dkTargetInput');
    const noteInp = document.getElementById('dkTargetNoteInput');
    const btn = document.getElementById('dkBtnSaveTarget');

    const parsed = Number(inp?.value);
    if (Number.isNaN(parsed) || parsed < 0.5 || parsed > 4.0) {
        alert('Masukkan target IPS antara 0.50 hingga 4.00.');
        return;
    }

    state.targetIps = Number(parsed.toFixed(2));
    state.targetNote = (noteInp?.value || '').trim();
    syncTargetChipsUI();
    if (state.metrics) renderTargetChart(state.metrics);

    if (btn) {
        btn.disabled = true;
        btn.textContent = 'Menyimpan...';
    }

    try {
        localStorage.setItem(`dk_target_ips_${state.uid}`, String(state.targetIps));
        if (state.uid) {
            await setDoc(doc(db, 'users', state.uid), {
                targetIps: state.targetIps,
                targetNote: state.targetNote,
                targetUpdatedAt: new Date().toISOString()
            }, { merge: true });
        }
        await runTargetAiAnalysis(true);
    } catch (err) {
        console.error('Gagal menyimpan target IPS:', err);
        alert('Target diperbarui di tampilan lokal, namun gagal sinkron ke server: ' + err.message);
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.textContent = 'Simpan & Analisis';
        }
    }
}

async function loadEnrolledAcademicData() {
    const uid = state.uid;
    const sem = state.semester;
    const classId = state.enrolledClass?.id || '';
    const u = state.user || {};

    const queries = await Promise.allSettled([
        getDocs(collection(db, 'assignments')),
        getDocs(query(collection(db, 'submissions'), where('studentUid', '==', uid))),
        classId ? getDocs(query(collection(db, 'dailyAttendance'), where('classId', '==', classId))) : Promise.resolve({ docs: [] }),
        getDocs(collection(db, 'quizzes')),
        getDocs(collection(db, 'exams')),
        getDocs(query(collection(db, 'quiz_results'), where('studentId', '==', uid))),
        getDocs(collection(db, 'mem_free_materials')),
        getDocs(collection(db, 'users', uid, 'ipsHistory')),
        sem >= 3 ? getDoc(doc(db, 'pitching_projects', uid)) : Promise.resolve(null)
    ]);

    const valAt = (idx) => (queries[idx].status === 'fulfilled' ? queries[idx].value : null);

    const allAssign = (valAt(0)?.docs || []).map((d) => ({ id: d.id, ...d.data() }));
    const semAssign = allAssign.filter((a) => matchSemester(a.semester, sem));

    const mySubmissions = (valAt(1)?.docs || []).map((d) => ({ id: d.id, ...d.data() }));
    const subByAssign = {};
    mySubmissions.forEach((s) => {
        if (s.assignmentId) subByAssign[s.assignmentId] = s;
    });

    const pendingAssignments = semAssign.filter((a) => !subByAssign[a.id]);
    const submittedCount = semAssign.filter((a) => !!subByAssign[a.id]).length;

    // Attendance
    const attDocs = (valAt(2)?.docs || []).map((d) => ({ id: d.id, ...d.data() }));
    let totalSessions = attDocs.length;
    let presentCount = 0;
    attDocs.forEach((docItem) => {
        const st = docItem.presensi?.[uid];
        if (st && String(st).toLowerCase().includes('hadir')) presentCount++;
    });
    const attendancePct = totalSessions > 0 ? Math.round((presentCount / totalSessions) * 100) : 0;

    // Quizzes & Exams
    const allQuizzes = (valAt(3)?.docs || []).map((d) => ({ id: d.id, ...d.data() })).filter((q) => matchSemester(q.semester, sem));
    const allExams = (valAt(4)?.docs || []).map((d) => ({ id: d.id, ...d.data() })).filter((ex) => matchSemester(ex.semester, sem));
    const myQuizResults = (valAt(5)?.docs || []).map((d) => ({ id: d.id, ...d.data() }));

    const doneQuizIds = new Set(myQuizResults.map((r) => r.quizId));
    const activeQuizzes = allQuizzes.filter((q) => !doneQuizIds.has(q.id));
    const activeExams = allExams.filter((ex) => !doneQuizIds.has(ex.id));

    const quizScores = myQuizResults.map((r) => Number(r.score)).filter((n) => !Number.isNaN(n));
    const quizAvg = quizScores.length > 0 ? Math.round(quizScores.reduce((a, b) => a + b, 0) / quizScores.length) : 0;

    // Reading materials
    const materials = (valAt(6)?.docs || []).map((d) => ({ id: d.id, ...d.data() }));

    // IPS History
    const historyPoints = (valAt(7)?.docs || [])
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => String(a.date || a.id).localeCompare(String(b.date || b.id)));

    // Sem 3 word count
    const wordCount = Number(u.word_count || 0);

    // Build table rows from real graded components & submissions
    const tableRows = [];
    const scoreMap = {};

    // Submissions with/without scores
    semAssign.forEach((a) => {
        const sub = subByAssign[a.id];
        if (sub) {
            const hasScore = sub.nilai !== undefined && sub.nilai !== null && sub.nilai !== '';
            const gm = getGradeMeta(hasScore ? sub.nilai : null);
            if (hasScore) scoreMap[a.judul || a.id] = Number(sub.nilai);
            tableRows.push({
                title: a.judul || a.title || 'Tugas Kelas',
                detail: hasScore ? (a.mapel || 'Dinilai') : 'Terkumpul',
                score: hasScore ? Number(sub.nilai) : '-',
                letter: gm.letter,
                bobot: gm.bobot,
                gradeCls: gm.cls,
                isGraded: hasScore
            });
        } else {
            tableRows.push({
                title: a.judul || a.title || 'Tugas Kelas',
                detail: 'Belum Kumpul',
                score: '-',
                letter: '-',
                bobot: null,
                gradeCls: 'grade-none',
                isGraded: false
            });
        }
    });

    // Standard KHS components from users/{uid}
    const stdKeys = [
        ['nilai_t1', 'Tugas 1'], ['nilai_t2', 'Tugas 2'], ['nilai_t3', 'Tugas 3'],
        ['nilai_t4', 'Tugas 4'], ['nilai_t5', 'Tugas 5'], ['nilai_t6', 'Tugas 6'],
        ['nilai_t7', 'Tugas 7'], ['nilai_t8', 'Tugas 8'],
        ['nilai_uts', 'Ujian Tengah Semester'], ['nilai_uas', 'Ujian Akhir Semester'],
        ['nilai_naskah', 'Evaluasi Naskah'], ['nilai_extra1', 'Keaktifan'], ['nilai_extra2', 'Kehadiran']
    ];
    stdKeys.forEach(([key, label]) => {
        const rawVal = u[key];
        if (rawVal !== undefined && rawVal !== null && rawVal !== '' && !Number.isNaN(Number(rawVal))) {
            const num = Number(rawVal);
            const gm = getGradeMeta(num);
            scoreMap[key] = num;
            tableRows.push({
                title: label,
                detail: 'Rekap KHS',
                score: num,
                letter: gm.letter,
                bobot: gm.bobot,
                gradeCls: gm.cls,
                isGraded: true
            });
        }
    });

    // Quiz results
    myQuizResults.forEach((qr) => {
        if (qr.score !== undefined && qr.score !== null && !Number.isNaN(Number(qr.score))) {
            const num = Number(qr.score);
            const gm = getGradeMeta(num);
            tableRows.push({
                title: qr.quizTitle || qr.title || 'Kuis / Ujian',
                detail: 'Evaluasi Online',
                score: num,
                letter: gm.letter,
                bobot: gm.bobot,
                gradeCls: gm.cls,
                isGraded: true
            });
        }
    });

    const gradedRows = tableRows.filter((r) => r.isGraded);
    const avgScore = gradedRows.length > 0
        ? gradedRows.reduce((acc, r) => acc + Number(r.score), 0) / gradedRows.length
        : 0;

    let computedIps = Number(u.ips || 0);
    if (!computedIps && gradedRows.length > 0) {
        const sumBobot = gradedRows.reduce((acc, r) => acc + (r.bobot ?? 0), 0);
        computedIps = sumBobot / gradedRows.length;
    }
    state.ips = Math.max(0, Math.min(4.0, Number(computedIps) || 0));

    const savedTarget = Number(u.targetIps || localStorage.getItem(`dk_target_ips_${uid}`) || 3.0);
    state.targetIps = Math.max(0.5, Math.min(4.0, savedTarget || 3.0));
    state.targetNote = u.targetNote || '';

    state.allTableRows = tableRows;
    state.metrics = {
        pendingAssignments,
        gradedRows,
        activeQuizzes,
        activeExams,
        submittedCount,
        totalAssignments: semAssign.length,
        presentCount,
        totalSessions,
        attendancePct,
        quizCount: myQuizResults.length,
        quizAvg,
        avgScore,
        gradedCount: gradedRows.length,
        wordCount,
        materials,
        historyPoints,
        scoreMap
    };

    renderFiveInfoList(buildStructuredNotifications({
        pendingAssignments,
        gradedRows,
        activeQuizzes,
        activeExams,
        attendancePct,
        presentCount,
        totalSessions,
        ips: state.ips,
        targetIps: state.targetIps,
        wordCount,
        materials
    }));
    renderProgressSection(state.metrics);
    renderResultsTable();
    renderTargetChart(state.metrics);
    syncTargetChipsUI();
    runTargetAiAnalysis(false);
}

async function resolveStudentEnrollment(firebaseUser) {
    const localUser = window.CendekiaApp?.getUser ? window.CendekiaApp.getUser() : {};
    const uid = firebaseUser?.uid || localUser?.uid || localUser?.id || '';
    state.uid = uid;
    state.user = { ...localUser, ...(firebaseUser ? { uid: firebaseUser.uid, email: firebaseUser.email, photoURL: firebaseUser.photoURL } : {}) };

    if (!uid) {
        state.enrolledClass = null;
        state.regData = null;
        renderCardShell('empty');
        return;
    }

    try {
        const [userSnap, regSnap, classesSnap] = await Promise.all([
            getDoc(doc(db, 'users', uid)),
            getDoc(doc(db, 'class_registrations', uid)),
            getDocs(collection(db, 'classes'))
        ]);

        if (userSnap.exists()) {
            state.user = { ...state.user, uid, ...userSnap.data() };
            if (window.CendekiaApp?.saveUser) window.CendekiaApp.saveUser(state.user);
        }

        state.regData = regSnap.exists() ? regSnap.data() : null;

        let matchedClass = null;
        classesSnap.forEach((docSnap) => {
            const c = docSnap.data();
            if (Array.isArray(c.students) && c.students.includes(uid)) {
                matchedClass = { id: docSnap.id, ...c };
            }
        });

        // Fallback if admin assigned classId directly on users/{uid} while verified
        if (!matchedClass && state.user?.classId && state.user?.classRegStatus === 'verified') {
            matchedClass = {
                id: state.user.classId,
                name: state.user.className || 'Kelas Reguler',
                semester: Number(state.user.semester || 1)
            };
        }

        state.enrolledClass = matchedClass;

        if (matchedClass) {
            state.semester = Number(matchedClass.semester || state.user?.semester || 1);
            renderCardShell('enrolled');
            await loadEnrolledAcademicData();
        } else if (state.regData?.status === 'pending_verification' || state.user?.classRegStatus === 'pending_verification') {
            renderCardShell('pending');
        } else {
            renderCardShell('empty');
        }
    } catch (err) {
        console.warn('Gagal memeriksa keikutsertaan kelas resmi:', err);
        renderCardShell('empty');
    }
}

function bindEvents() {
    const btnToggleForm = document.getElementById('btnToggleRegForm');
    const formWrapper = document.getElementById('dkRegFormWrapper');
    if (btnToggleForm && formWrapper) {
        btnToggleForm.addEventListener('click', () => {
            const open = formWrapper.style.display === 'block';
            formWrapper.style.display = open ? 'none' : 'block';
            btnToggleForm.innerHTML = open
                ? 'Daftarkan Diri ke Kelas Resmi'
                : 'Tutup Formulir Pendaftaran';
            if (!open) formWrapper.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        });
    }

    const form = document.getElementById('inlineClassRegForm');
    if (form) form.addEventListener('submit', handleRegistrationSubmit);

    const btnRefreshPending = document.getElementById('btnRefreshRegStatus');
    if (btnRefreshPending) {
        btnRefreshPending.addEventListener('click', () => {
            resolveStudentEnrollment(auth.currentUser);
        });
    }

    const btnToggleRows = document.getElementById('dkBtnToggleRows');
    if (btnToggleRows) {
        btnToggleRows.addEventListener('click', () => {
            state.showAllRows = !state.showAllRows;
            renderResultsTable();
        });
    }

    document.querySelectorAll('.dk-chip-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
            state.targetIps = Number(btn.dataset.target) || 3.0;
            syncTargetChipsUI();
            if (state.metrics) renderTargetChart(state.metrics);
        });
    });

    const btnSaveTarget = document.getElementById('dkBtnSaveTarget');
    if (btnSaveTarget) btnSaveTarget.addEventListener('click', saveStudentTarget);

    const btnRunAi = document.getElementById('dkBtnRunAi');
    if (btnRunAi) btnRunAi.addEventListener('click', () => runTargetAiAnalysis(true));
}

document.addEventListener('DOMContentLoaded', () => {
    if (window.CendekiaApp?.renderBottomNav) {
        window.CendekiaApp.renderBottomNav('kelas');
    }
    bindEvents();
    refreshIcons();

    let resolvedOnce = false;
    onAuthStateChanged(auth, (firebaseUser) => {
        resolvedOnce = true;
        resolveStudentEnrollment(firebaseUser);
    });

    // Jika auth lambat/kosong saat fallback lokal
    setTimeout(() => {
        if (!resolvedOnce) {
            resolveStudentEnrollment(auth.currentUser);
        }
    }, 1800);
});
