import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, setPersistence, browserLocalPersistence } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getAnalytics, isSupported } from "firebase/analytics";
import firebaseConfig from "../firebase-applet-config.json";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// Initialize Analytics conditionally
let analytics = null;
isSupported().then(supported => {
    if (supported) {
        analytics = getAnalytics(app);
    }
}).catch(err => console.error("Analytics not supported:", err));

// Explicitly set persistence to local to handle iframe issues
// This is critical for maintaining session in sandboxed environments
const initAuth = async () => {
    try {
        await setPersistence(auth, browserLocalPersistence);
    } catch (err) {
        console.error("Firebase Persistence Error:", err);
    }
};
initAuth();

const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

export { auth, db, googleProvider, analytics };
