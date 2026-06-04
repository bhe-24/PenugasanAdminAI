// ============================================
// GENERATOR SURAT - MAIN JAVASCRIPT
// ============================================

// Data storage
let suratData = JSON.parse(localStorage.getItem('suratData')) || [];
let templates = JSON.parse(localStorage.getItem('suratTemplates')) || initializeDefaultTemplates();
let currentEditId = null;
let counterSurat = JSON.parse(localStorage.getItem('counterSurat')) || {};

// ============================================
// INITIALIZATION & SETUP
// ============================================

document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
    loadDefaultTemplates();
    loadDaftarSurat();
    initializeSignatureContainer();
});

function initializeApp() {
    // Set today's date as default
    document.getElementById('tanggal-surat').valueAsDate = new Date();
    
    // Event listeners
    document.getElementById('select-template').addEventListener('change', handleTemplateChange);
    document.getElementById('isi-surat').addEventListener('input', debounce(refreshPreview, 500));
    document.getElementById('perihal-surat').addEventListener('input', debounce(refreshPreview, 500));
}

function initializeDefaultTemplates() {
    return [
        {
            id: 'ujian-cendekia',
            name: 'Ujian Cendekia Aksara',
            kopContent: `
                <div class="kop-surat">
                    <div class="kop-header">
                        <div class="kop-logo">
                            <img src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ccircle cx='50' cy='50' r='45' fill='%234CAF50'/%3E%3Ctext x='50' y='60' font-size='40' fill='white' text-anchor='middle' font-weight='bold'%3ECA%3C/text%3E%3C/svg%3E" alt="Logo">
                        </div>
                        <div class="kop-text">
                            <h2>CENDEKIA AKSARA</h2>
                            <p>Lembaga Pendidikan Terpercaya</p>
                            <p>Jl. Pendidikan No. 123, Kota - Negara | Telp: (021) 1234-5678</p>
                            <p>Email: info@cendekiaaksara.id | Website: www.cendekiaaksara.id</p>
                        </div>
                    </div>
                    <hr class="kop-divider">
                </div>
            `,
            description: 'Template standar untuk Ujian Cendekia Aksara'
        },
        {
            id: 'pengumuman-cendekia',
            name: 'Pengumuman Cendekia Aksara',
            kopContent: `
                <div class="kop-surat">
                    <div class="kop-header" style="text-align: center;">
                        <div class="kop-logo" style="text-align: center;">
                            <img src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' fill='%232196F3'/%3E%3Ctext x='50' y='60' font-size='40' fill='white' text-anchor='middle' font-weight='bold'%3ECA%3C/text%3E%3C/svg%3E" alt="Logo">
                        </div>
                        <div class="kop-text">
                            <h2>PENGUMUMAN RESMI</h2>
                            <p>CENDEKIA AKSARA</p>
                            <p>Jl. Pendidikan No. 123 | Telp: (021) 1234-5678</p>
                        </div>
                    </div>
                    <hr class="kop-divider">
                </div>
            `,
            description: 'Template untuk pengumuman resmi'
        },
        {
            id: 'resmi',
            name: 'Surat Resmi',
            kopContent: `
                <div class="kop-surat">
                    <div class="kop-header">
                        <div class="kop-logo">
                            <img src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect x='10' y='10' width='80' height='80' fill='none' stroke='%23333' stroke-width='2'/%3E%3Ctext x='50' y='60' font-size='30' fill='%23333' text-anchor='middle'%3EResmi%3C/text%3E%3C/svg%3E" alt="Logo">
                        </div>
                        <div class="kop-text">
                            <h2>SURAT RESMI</h2>
                            <p>Organisasi Resmi Indonesia</p>
                            <p>Jalan Utama No. 1, Jakarta Pusat 12000</p>
                            <p>Telp: (021) 555-0000 | Fax: (021) 555-0001</p>
                        </div>
                    </div>
                    <hr class="kop-divider">
                </div>
            `,
            description: 'Template surat resmi standar'
        }
    ];
}

function loadDefaultTemplates() {
    const templatesGrid = document.getElementById('templates-grid');
    templatesGrid.innerHTML = templates.map(template => `
        <div class="template-card">
            <div class="template-preview-small">${template.kopContent}</div>
            <h3>${template.name}</h3>
            <p>${template.description}</p>
            <button class="btn btn-small btn-outline" onclick="editTemplate('${template.id}')">Edit</button>
            <button class="btn btn-small btn-outline" onclick="deleteTemplate('${template.id}')">Hapus</button>
        </div>
    `).join('');
}

// ============================================
// SECTION NAVIGATION
// ============================================

function switchSection(sectionName) {
    // Hide all sections
    document.querySelectorAll('.section').forEach(section => {
        section.classList.remove('active');
    });
    
    // Remove active from nav links
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
    });
    
    // Show selected section
    const section = document.getElementById(sectionName === 'daftar' ? 'daftar-surat' : 
                                           sectionName === 'buat' ? 'buat-surat' :
                                           sectionName === 'arsip' ? 'arsip' :
                                           'template-kop');
    if (section) {
        section.classList.add('active');
    }
    
    // Set active nav link
    document.querySelector(`[data-section="${sectionName}"]`)?.classList.add('active');
}

// ============================================
// TEMPLATE SELECTION & PREVIEW
// ============================================

function handleTemplateChange() {
    const templateId = document.getElementById('select-template').value;
    const previewKop = document.getElementById('preview-kop');
    
    if (!templateId) {
        previewKop.innerHTML = '<p class="text-muted text-center">Pilih template untuk melihat pratinjau</p>';
        return;
    }
    
    const template = templates.find(t => t.id === templateId);
    if (template) {
        previewKop.innerHTML = template.kopContent;
        generateNomorSurat();
        refreshPreview();
    }
}

// ============================================
// NOMOR SURAT GENERATION
// ============================================

function generateNomorSurat() {
    const templateId = document.getElementById('select-template').value;
    const tanggal = document.getElementById('tanggal-surat').value;
    
    if (!templateId || !tanggal) return;
    
    const date = new Date(tanggal);
    const tahun = date.getFullYear();
    const bulan = String(date.getMonth() + 1).padStart(2, '0');
    const kodTemplate = templateId.substring(0, 3).toUpperCase();
    
    // Initialize counter if not exists
    const counterKey = `${templateId}-${tahun}`;
    if (!counterSurat[counterKey]) {
        counterSurat[counterKey] = 0;
    }
    counterSurat[counterKey]++;
    
    const nomorUrut = String(counterSurat[counterKey]).padStart(3, '0');
    const nomorSurat = `${nomorUrut}/${kodTemplate}/${tahun}`;
    
    document.getElementById('nomor-surat').value = nomorSurat;
    localStorage.setItem('counterSurat', JSON.stringify(counterSurat));
}

// ============================================
// LAMPIRAN HANDLING
// ============================================

function addLampiran() {
    const lampiranContainer = document.getElementById('lampiran-container');
    const lampiranList = document.getElementById('lampiran-list');
    
    const lampiranId = 'lampiran-' + Date.now();
    const lampiranItem = document.createElement('div');
    lampiranItem.className = 'lampiran-item';
    lampiranItem.id = lampiranId;
    lampiranItem.innerHTML = `
        <div class="lampiran-info">
            <input type="text" placeholder="Nama lampiran" class="form-control lampiran-name">
            <button class="btn btn-small btn-outline" onclick="uploadLampiran('${lampiranId}')">Upload File</button>
            <span class="lampiran-status text-muted">Belum ada file</span>
        </div>
        <button class="btn btn-small btn-danger" onclick="removeLampiran('${lampiranId}')">Hapus</button>
    `;
    lampiranList.appendChild(lampiranItem);
    
    // Store lampiran data
    if (!window.lampiranStore) window.lampiranStore = {};
    window.lampiranStore[lampiranId] = {
        name: '',
        file: null,
        base64: null
    };
}

function uploadLampiran(lampiranId) {
    window.currentLampiranId = lampiranId;
    document.getElementById('file-input').click();
}

function removeLampiran(lampiranId) {
    document.getElementById(lampiranId).remove();
    if (window.lampiranStore && window.lampiranStore[lampiranId]) {
        delete window.lampiranStore[lampiranId];
    }
}

// ============================================
// SIGNATURE HANDLING
// ============================================

function initializeSignatureContainer() {
    updateSignatureColumns();
}

function updateSignatureColumns() {
    const columns = parseInt(document.getElementById('signature-columns').value) || 1;
    const container = document.getElementById('signature-container');
    container.innerHTML = '';
    container.style.gridTemplateColumns = `repeat(${columns}, 1fr)`;
    
    if (!window.signatureStore) window.signatureStore = {};
    
    for (let i = 0; i < columns; i++) {
        const sigId = 'signature-' + i;
        const sigBox = document.createElement('div');
        sigBox.className = 'signature-box';
        sigBox.id = sigId;
        sigBox.innerHTML = `
            <div class="signature-placeholder" onclick="editSignature('${sigId}')">
                <p>+</p>
                <small>Klik untuk upload</small>
            </div>
            <div class="signature-image" style="display: none;">
                <img src="" alt="Signature">
            </div>
            <input type="text" class="signature-name-input" placeholder="Nama" readonly>
            <input type="text" class="signature-title-input" placeholder="Jabatan" readonly>
        `;
        container.appendChild(sigBox);
    }
}

function addSignature() {
    document.getElementById('modal-signature').style.display = 'block';
}

function editSignature(sigId) {
    window.currentSignatureId = sigId;
    document.getElementById('modal-signature').style.display = 'block';
    
    // Load existing data if any
    if (window.signatureStore && window.signatureStore[sigId]) {
        const sig = window.signatureStore[sigId];
        document.getElementById('sig-name').value = sig.name || '';
        document.getElementById('sig-title').value = sig.title || '';
    }
}

function confirmSignature() {
    const sigId = window.currentSignatureId;
    const name = document.getElementById('sig-name').value;
    const title = document.getElementById('sig-title').value;
    const fileInput = document.getElementById('sig-file');
    
    if (!fileInput.files[0] && !name) {
        alert('Masukkan minimal nama atau upload gambar tanda tangan');
        return;
    }
    
    if (!window.signatureStore) window.signatureStore = {};
    
    if (fileInput.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) {
            window.signatureStore[sigId] = {
                name: name,
                title: title,
                base64: e.target.result
            };
            
            updateSignatureDisplay(sigId, name, title, e.target.result);
            closeModal('modal-signature');
            refreshPreview();
        };
        reader.readAsDataURL(fileInput.files[0]);
    } else {
        window.signatureStore[sigId] = {
            name: name,
            title: title,
            base64: null
        };
        updateSignatureDisplay(sigId, name, title, null);
        closeModal('modal-signature');
        refreshPreview();
    }
}

function updateSignatureDisplay(sigId, name, title, base64) {
    const sigBox = document.getElementById(sigId);
    const placeholder = sigBox.querySelector('.signature-placeholder');
    const imageDiv = sigBox.querySelector('.signature-image');
    const nameInput = sigBox.querySelector('.signature-name-input');
    const titleInput = sigBox.querySelector('.signature-title-input');
    
    nameInput.value = name;
    titleInput.value = title;
    
    if (base64) {
        placeholder.style.display = 'none';
        imageDiv.style.display = 'block';
        imageDiv.querySelector('img').src = base64;
    } else {
        nameInput.style.marginTop = '10px';
    }
}

// ============================================
// PREVIEW & REFRESH
// ============================================

function refreshPreview() {
    const templateId = document.getElementById('select-template').value;
    if (!templateId) return;
    
    const template = templates.find(t => t.id === templateId);
    const nomorSurat = document.getElementById('nomor-surat').value;
    const tanggal = document.getElementById('tanggal-surat').value;
    const perihal = document.getElementById('perihal-surat').value;
    const isiSurat = document.getElementById('isi-surat').value;
    
    const formattedDate = tanggal ? new Date(tanggal).toLocaleDateString('id-ID', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    }) : '';
    
    let previewHTML = template.kopContent;
    previewHTML += `
        <div class="surat-content">
            <div class="surat-header">
                <div class="nomor-surat">Nomor: ${nomorSurat}</div>
                <div class="tanggal-surat">${formattedDate}</div>
            </div>
            
            ${perihal ? `<div class="perihal">Perihal: <strong>${perihal}</strong></div>` : ''}
            
            <div class="isi-surat">
                ${isiSurat.replace(/\n/g, '<br>')}
            </div>
    `;
    
    // Add signatures
    if (window.signatureStore && Object.keys(window.signatureStore).length > 0) {
        previewHTML += '<div class="signature-section">';
        Object.entries(window.signatureStore).forEach(([id, sig]) => {
            previewHTML += `
                <div class="signature-block">
                    ${sig.base64 ? `<img src="${sig.base64}" alt="Signature" style="max-height: 60px;">` : '<div style="height: 60px;"></div>'}
                    <p><strong>${sig.name}</strong></p>
                    <p>${sig.title}</p>
                </div>
            `;
        });
        previewHTML += '</div>';
    }
    
    previewHTML += '</div>';
    
    document.getElementById('preview-surat').innerHTML = previewHTML;
}

// ============================================
// AI ENHANCEMENT
// ============================================

function openAIEnhancer() {
    document.getElementById('modal-ai').style.display = 'block';
    document.getElementById('ai-result').classList.add('hidden');
    document.getElementById('ai-loading').classList.add('hidden');
    document.getElementById('ai-instruction').value = '';
}

function processWithAI() {
    const instruction = document.getElementById('ai-instruction').value;
    const expand = document.getElementById('ai-expand').checked;
    const formal = document.getElementById('ai-formal').checked;
    const isiSurat = document.getElementById('isi-surat').value;
    
    if (!isiSurat) {
        alert('Masukkan isi surat terlebih dahulu');
        return;
    }
    
    document.getElementById('ai-loading').classList.remove('hidden');
    document.getElementById('ai-result').classList.add('hidden');
    
    // Prepare prompt
    let prompt = `Berikut adalah isi surat:\n\n${isiSurat}\n\n`;
    prompt += `Instruksi: ${instruction || 'Perbaiki dan optimalkan'}\n`;
    if (expand) prompt += 'Kembangkan konten dengan menambah detail relevan.\n';
    if (formal) prompt += 'Gunakan bahasa resmi yang lebih formal.\n';
    
    // Call AI API (integrate with your AI service)
    processAIRequest(prompt, isiSurat);
}

function processAIRequest(prompt, originalText) {
    // Simulated AI processing
    // In production, connect to actual AI service (OpenAI, Gemini, etc.)
    
    setTimeout(() => {
        const result = `${originalText}\n\n[Perbaikan AI diterapkan]`;
        
        document.getElementById('ai-result-text').value = result;
        document.getElementById('ai-loading').classList.add('hidden');
        document.getElementById('ai-result').classList.remove('hidden');
    }, 2000);
}

function acceptAIResult() {
    const result = document.getElementById('ai-result-text').value;
    document.getElementById('isi-surat').value = result;
    refreshPreview();
    closeModal('modal-ai');
}

// ============================================
// SAVE & GENERATE PDF
// ============================================

function saveSurat() {
    const templateId = document.getElementById('select-template').value;
    const nomorSurat = document.getElementById('nomor-surat').value;
    const tanggal = document.getElementById('tanggal-surat').value;
    const perihal = document.getElementById('perihal-surat').value;
    const isiSurat = document.getElementById('isi-surat').value;
    const catatan = document.getElementById('catatan').value;
    
    if (!templateId || !nomorSurat || !tanggal || !isiSurat) {
        alert('Lengkapi form: Template, Tanggal, dan Isi Surat harus diisi');
        return;
    }
    
    const surat = {
        id: currentEditId || 'surat-' + Date.now(),
        templateId: templateId,
        nomorSurat: nomorSurat,
        tanggal: tanggal,
        perihal: perihal,
        isiSurat: isiSurat,
        catatan: catatan,
        lampiran: window.lampiranStore || {},
        signatures: window.signatureStore || {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
    
    // Remove or update existing
    if (currentEditId) {
        suratData = suratData.filter(s => s.id !== currentEditId);
    }
    
    suratData.push(surat);
    localStorage.setItem('suratData', JSON.stringify(suratData));
    
    alert('Surat berhasil disimpan!');
    resetForm();
    switchSection('daftar');
    loadDaftarSurat();
}

function generatePDF() {
    const nomorSurat = document.getElementById('nomor-surat').value;
    
    if (!nomorSurat) {
        alert('Lengkapi form terlebih dahulu');
        return;
    }
    
    // Use jsPDF library
    const element = document.getElementById('preview-surat');
    const opt = {
        margin: 10,
        filename: `Surat_${nomorSurat.replace(/\//g, '_')}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { orientation: 'portrait', unit: 'mm', format: 'a4' }
    };
    
    // Note: Requires html2pdf.js library to be included
    if (typeof html2pdf !== 'undefined') {
        html2pdf().set(opt).from(element).save();
    } else {
        alert('Library PDF tidak tersedia. Pastikan html2pdf.js sudah diintegrasikan');
    }
}

// ============================================
// DAFTAR & ARSIP SURAT
// ============================================

function loadDaftarSurat() {
    const tbody = document.getElementById('tbody-daftar');
    
    if (suratData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">Belum ada surat</td></tr>';
        return;
    }
    
    tbody.innerHTML = suratData.map(surat => {
        const template = templates.find(t => t.id === surat.templateId);
        return `
            <tr>
                <td><strong>${surat.nomorSurat}</strong></td>
                <td>${new Date(surat.tanggal).toLocaleDateString('id-ID')}</td>
                <td>${surat.perihal}</td>
                <td>${template?.name || 'Unknown'}</td>
                <td><span class="badge badge-success">Tersimpan</span></td>
                <td>
                    <button class="btn btn-small btn-outline" onclick="editSurat('${surat.id}')">Edit</button>
                    <button class="btn btn-small btn-danger" onclick="deleteSurat('${surat.id}')">Hapus</button>
                </td>
            </tr>
        `;
    }).join('');
}

function editSurat(suratId) {
    const surat = suratData.find(s => s.id === suratId);
    if (!surat) return;
    
    currentEditId = suratId;
    document.getElementById('select-template').value = surat.templateId;
    document.getElementById('nomor-surat').value = surat.nomorSurat;
    document.getElementById('tanggal-surat').value = surat.tanggal;
    document.getElementById('perihal-surat').value = surat.perihal;
    document.getElementById('isi-surat').value = surat.isiSurat;
    document.getElementById('catatan').value = surat.catatan;
    
    window.lampiranStore = surat.lampiran || {};
    window.signatureStore = surat.signatures || {};
    
    handleTemplateChange();
    switchSection('buat');
}

function deleteSurat(suratId) {
    if (confirm('Apakah Anda yakin ingin menghapus surat ini?')) {
        suratData = suratData.filter(s => s.id !== suratId);
        localStorage.setItem('suratData', JSON.stringify(suratData));
        loadDaftarSurat();
    }
}

function filterArsip() {
    // Implement filter logic for archive
    loadDaftarSurat();
}

// ============================================
// TEMPLATE MANAGEMENT
// ============================================

function openTemplateEditor() {
    // Open modal for creating new template
    alert('Fitur edit template akan segera hadir');
}

function editTemplate(templateId) {
    alert('Fitur edit template akan segera hadir');
}

function deleteTemplate(templateId) {
    if (confirm('Hapus template ini?')) {
        templates = templates.filter(t => t.id !== templateId);
        localStorage.setItem('suratTemplates', JSON.stringify(templates));
        loadDefaultTemplates();
    }
}

// ============================================
// MODAL MANAGEMENT
// ============================================

function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
}

window.onclick = function(event) {
    if (event.target.classList.contains('modal')) {
        event.target.style.display = 'none';
    }
}

// ============================================
// FILE UPLOAD HANDLING
// ============================================

function confirmFileUpload() {
    const fileInput = document.getElementById('file-input');
    const file = fileInput.files[0];
    
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        const base64 = e.target.result;
        
        if (window.currentLampiranId) {
            const lampiranItem = document.getElementById(window.currentLampiranId);
            const name = lampiranItem.querySelector('.lampiran-name').value || file.name;
            
            window.lampiranStore[window.currentLampiranId] = {
                name: name,
                file: file.name,
                base64: base64
            };
            
            lampiranItem.querySelector('.lampiran-status').textContent = `✓ ${file.name}`;
        }
        
        closeModal('modal-upload');
        refreshPreview();
    };
    reader.readAsDataURL(file);
}

document.getElementById('file-input')?.addEventListener('change', function() {
    const file = this.files[0];
    const preview = document.getElementById('file-preview');
    
    if (file) {
        preview.innerHTML = `<p>✓ File terpilih: ${file.name} (${(file.size / 1024).toFixed(2)} KB)</p>`;
    }
});

document.getElementById('sig-file')?.addEventListener('change', function() {
    const file = this.files[0];
    const preview = document.getElementById('sig-preview');
    
    if (file && file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = function(e) {
            preview.innerHTML = `<img src="${e.target.result}" style="max-height: 100px;">`;
        };
        reader.readAsDataURL(file);
    }
});

// ============================================
// UTILITY FUNCTIONS
// ============================================

function resetForm() {
    document.getElementById('select-template').value = '';
    document.getElementById('nomor-surat').value = '';
    document.getElementById('tanggal-surat').valueAsDate = new Date();
    document.getElementById('perihal-surat').value = '';
    document.getElementById('isi-surat').value = '';
    document.getElementById('catatan').value = '';
    document.getElementById('signature-columns').value = '1';
    document.getElementById('lampiran-list').innerHTML = '';
    document.getElementById('preview-kop').innerHTML = '<p class="text-muted text-center">Pilih template untuk melihat pratinjau</p>';
    document.getElementById('preview-surat').innerHTML = '<p class="text-muted text-center">Isi form untuk melihat pratinjau</p>';
    
    window.lampiranStore = {};
    window.signatureStore = {};
    currentEditId = null;
    
    initializeSignatureContainer();
    refreshPreview();
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}
