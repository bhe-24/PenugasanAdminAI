import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-storage.js";

// --- KONFIGURASI FIREBASE ---
// Pastikan API KEY ini sama dengan yang ada di index.html kamu
const firebaseConfig = {
    apiKey: "AIzaSyDpUWUIzPXIZN6rrNtsIqcL6VfOE2RLVl0", 
    authDomain: "mading-cf676.firebaseapp.com", 
    projectId: "mading-cf676", 
    storageBucket: "mading-cf676.firebasestorage.app", 
    messagingSenderId: "72175203671", 
    appId: "1:72175203671:web:7a0676a55beb64bc96ba12"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// --- FUNGSI CEK HAK AKSES (GATEKEEPER) ---
async function checkAuth(roleRequired) {
    return new Promise((resolve) => {
        onAuthStateChanged(auth, async (user) => {
            // 1. Jika User Tidak Login
            if (!user) {
                // Simpan URL tujuan biar nanti bisa balik lagi (opsional)
                sessionStorage.setItem('redirect_after_login', window.location.href);
                
                // Arahkan ke halaman login utama (keluar dari folder)
                // Kita cek kedalaman folder biar path-nya benar
                const path = window.location.pathname;
                const isDeep = path.split('/').length > 2; 
                window.location.href = isDeep ? '../index.html' : 'index.html';
                
                resolve(null);
                return;
            }

            try {
                // 2. Ambil Data User dari Database
                const docSnap = await getDoc(doc(db, "users", user.uid));
                
                if (docSnap.exists()) {
                    const userData = docSnap.data();
                    const userRole = userData.role; // 'admin', 'pengajar', atau 'siswa'

                    // --- LOGIKA "KUNCI MASTER" (PERBAIKAN UTAMA) ---
                    
                    // KASUS A: Halaman Admin (roleRequired = 'admin')
                    if (roleRequired === 'admin') {
                        // Admin DAN Pengajar boleh masuk
                        if (userRole === 'admin' || userRole === 'pengajar') {
                            resolve({ uid: user.uid, ...userData });
                        } else {
                            alert("Akses Ditolak! Halaman ini khusus Pengajar/Admin.");
                            window.location.href = '../siswa/index.html';
                            resolve(null);
                        }
                    } 
                    // KASUS B: Halaman Siswa (roleRequired = 'siswa')
                    else if (roleRequired === 'siswa') {
                        // Siswa boleh masuk. 
                        // TAPI Admin/Pengajar JUGA BOLEH (untuk memantau/mencoba fitur)
                        if (userRole === 'siswa' || userRole === 'admin' || userRole === 'pengajar') {
                            resolve({ uid: user.uid, ...userData });
                        } else {
                            // Harusnya tidak mungkin sampai sini, tapi jaga-jaga
                            alert("Anda tidak memiliki akses.");
                            window.location.href = '../index.html';
                            resolve(null);
                        }
                    }
                    // KASUS C: Tidak butuh role khusus (Umum)
                    else {
                        resolve({ uid: user.uid, ...userData });
                    }

                } else {
                    // User di Auth ada, tapi di Database 'users' tidak ada
                    console.error("Data user hilang di database!");
                    await signOut(auth);
                    window.location.href = '../index.html';
                    resolve(null);
                }
            } catch (e) {
                console.error("Error Check Auth:", e);
                // Jangan langsung logout, siapa tahu cuma masalah koneksi
                alert("Gagal memuat data pengguna. Periksa koneksi internet.");
                resolve(null);
            }
        });
    });
}

// --- FUNGSI LOGOUT ---
async function logout() {
    if(confirm("Yakin ingin keluar?")) {
        await signOut(auth);
        window.location.href = '../index.html';
    }
}

// Export agar bisa dipakai di semua halaman
export { auth, db, storage, checkAuth, logout };
