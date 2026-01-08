// js/firebase-config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-storage.js";

const firebaseConfig = {  
    apiKey: "AIzaSyDpUWUIzPXIZN6rrNtsIqcL6VfOE2RLVl0", 
    authDomain: "mading-cf676.firebaseapp.com", 
    projectId: "mading-cf676", 
    storageBucket: "mading-cf676.firebasestorage.app", 
    messagingSenderId: "72175203671", 
    appId: "1:72175203671:web:7a0676a55beb64bc96ba12" 
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

// Fungsi Cek Login Global
export function checkAuth(roleRequired = null) {
    return new Promise((resolve) => {
        onAuthStateChanged(auth, async (user) => {
            if (!user) {
                // Jika tidak login, tendang ke halaman depan
                if (window.location.pathname !== '/' && !window.location.pathname.includes('index.html')) {
                    window.location.href = '/';
                }
                resolve(null);
            } else {
                // Ambil data user
                const docSnap = await getDoc(doc(db, 'users', user.uid));
                if (docSnap.exists()) {
                    const userData = { uid: user.uid, ...docSnap.data() };
                    
                    // Cek Role jika diperlukan (misal halaman admin)
                    if (roleRequired && userData.role !== roleRequired) {
                        alert("Akses Ditolak: Anda bukan " + roleRequired);
                        window.location.href = '/dashboard';
                        resolve(null);
                    }
                    resolve(userData);
                }
            }
        });
    });
}
