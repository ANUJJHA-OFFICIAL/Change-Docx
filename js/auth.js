import { 
    auth, 
    db, 
    googleProvider,
    analytics
} from './firebase-config.js';
import { 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword, 
    signInWithPopup, 
    sendEmailVerification, 
    sendPasswordResetEmail, 
    onAuthStateChanged, 
    signOut,
    updateProfile
} from "firebase/auth";
import { 
    doc, 
    setDoc, 
    getDoc 
} from "firebase/firestore";
import { logEvent } from "firebase/analytics";

// DOM Elements
const panels = document.querySelectorAll('.panel');
const landingPanel = document.getElementById('landing-panel');
const loginPanel = document.getElementById('login-panel');
const registerPanel = document.getElementById('register-panel');
const verifyPanel = document.getElementById('verify-panel');
const forgotPasswordPanel = document.getElementById('forgot-password-panel');

const showRegisterBtn = document.getElementById('show-register');
const showLoginBtn = document.getElementById('show-login');
const switchToRegister = document.getElementById('switch-to-register');
const switchToLogin = document.getElementById('switch-to-login');
const forgotPasswordLink = document.getElementById('forgot-password-link');
const backToLogin = document.getElementById('back-to-login');
const signOutVerify = document.getElementById('sign-out-verify');

const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const forgotPasswordForm = document.getElementById('forgot-password-form');

const googleBtns = document.querySelectorAll('.btn-google');
const resendVerificationBtn = document.getElementById('resend-verification');
const checkVerificationBtn = document.getElementById('check-verification');

const themeToggle = document.getElementById('theme-toggle');
const sunIcon = document.getElementById('sun-icon');
const moonIcon = document.getElementById('moon-icon');

const toastContainer = document.getElementById('toast-container');

// Iframe Detection
const isInIframe = window.self !== window.top;
if (isInIframe) {
    console.warn("Change Docx is running in an iframe. Some authentication features may be restricted by your browser's security settings.");
    const iframeWarning = document.getElementById('iframe-warning');
    if (iframeWarning) iframeWarning.classList.remove('hidden');
}

// State
let currentUser = null;
let isProcessing = false;
let isRedirecting = false;

// Helper: Show Panel
function showPanel(panelId) {
    panels.forEach(p => p.classList.remove('active'));
    document.getElementById(panelId).classList.add('active');
}

// Helper: Show Toast
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<span>${message}</span>`;
    toastContainer.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = 'fadeOut 0.3s ease forwards';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// Theme Management
function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeIcons(savedTheme);
}

function updateThemeIcons(theme) {
    if (theme === 'dark') {
        sunIcon.classList.remove('hidden');
        moonIcon.classList.add('hidden');
    } else {
        sunIcon.classList.add('hidden');
        moonIcon.classList.remove('hidden');
    }
}

themeToggle.addEventListener('click', () => {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    updateThemeIcons(newTheme);
});

// Auth State Observer
onAuthStateChanged(auth, async (user) => {
    currentUser = user;
    
    // If we are currently processing a sign-in or already redirecting, 
    // let the sign-in handler manage the redirect to avoid race conditions 
    // which can lead to "INTERNAL ASSERTION FAILED" errors.
    if (isProcessing || isRedirecting) return;

    if (user) {
        if (user.emailVerified || user.providerData.some(p => p.providerId === 'google.com')) {
            // Redirect to main app
            isRedirecting = true;
            window.location.href = '/index.html';
        } else {
            // Show verification panel
            document.getElementById('user-email-display').textContent = user.email;
            showPanel('verify-panel');
        }
    } else {
        // Show landing if not logged in
        if (!loginPanel.classList.contains('active') && 
            !registerPanel.classList.contains('active') && 
            !forgotPasswordPanel.classList.contains('active')) {
            showPanel('landing-panel');
        }
    }
});

// Event Listeners: Panel Switching
showRegisterBtn.addEventListener('click', () => showPanel('register-panel'));
showLoginBtn.addEventListener('click', () => showPanel('login-panel'));
switchToRegister.addEventListener('click', (e) => { e.preventDefault(); showPanel('register-panel'); });
switchToLogin.addEventListener('click', (e) => { e.preventDefault(); showPanel('login-panel'); });
forgotPasswordLink.addEventListener('click', (e) => { e.preventDefault(); showPanel('forgot-password-panel'); });
backToLogin.addEventListener('click', (e) => { e.preventDefault(); showPanel('login-panel'); });
signOutVerify.addEventListener('click', (e) => { e.preventDefault(); signOut(auth); });

// Form Validation: Password Strength
const registerPassword = document.getElementById('register-password');
const strengthBar = document.getElementById('strength-bar');
const strengthText = document.getElementById('strength-text');

registerPassword.addEventListener('input', () => {
    const val = registerPassword.value;
    let strength = 0;
    if (val.length >= 8) strength += 25;
    if (/[A-Z]/.test(val)) strength += 25;
    if (/[0-9]/.test(val)) strength += 25;
    if (/[^A-Za-z0-9]/.test(val)) strength += 25;

    strengthBar.style.width = strength + '%';
    if (strength <= 25) {
        strengthBar.style.backgroundColor = '#e2001a';
        strengthText.textContent = 'Weak password';
    } else if (strength <= 75) {
        strengthBar.style.backgroundColor = '#ffc107';
        strengthText.textContent = 'Medium password';
    } else {
        strengthBar.style.backgroundColor = '#28a745';
        strengthText.textContent = 'Strong password';
    }
});

// Toggle Password Visibility (Register)
document.getElementById('toggle-password').addEventListener('click', function() {
    const type = registerPassword.getAttribute('type') === 'password' ? 'text' : 'password';
    registerPassword.setAttribute('type', type);
    this.textContent = type === 'password' ? 'Show' : 'Hide';
});

// Toggle Password Visibility (Login)
document.getElementById('toggle-login-password').addEventListener('click', function() {
    const loginPassword = document.getElementById('login-password');
    const type = loginPassword.getAttribute('type') === 'password' ? 'text' : 'password';
    loginPassword.setAttribute('type', type);
    this.textContent = type === 'password' ? 'Show' : 'Hide';
});

// Auth Actions: Register
registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (isProcessing) return;
    
    const submitBtn = document.getElementById('register-submit');
    const originalText = submitBtn.textContent;
    
    const name = document.getElementById('register-name').value;
    const email = document.getElementById('register-email').value;
    const password = registerPassword.value;
    const confirmPassword = document.getElementById('register-confirm-password').value;

    // Clear previous errors
    document.querySelectorAll('.error-msg').forEach(el => el.textContent = '');

    if (password !== confirmPassword) {
        document.getElementById('register-confirm-password-error').textContent = 'Passwords do not match';
        return;
    }

    if (password.length < 8) {
        document.getElementById('register-password-error').textContent = 'Password must be at least 8 characters';
        return;
    }

    try {
        isProcessing = true;
        submitBtn.disabled = true;
        submitBtn.textContent = 'Creating Account...';
        
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        
        // Log sign up event
        if (analytics) {
            logEvent(analytics, 'sign_up', { method: 'email' });
        }
        
        // Update profile with name
        await updateProfile(user, { displayName: name });
        
        // Save user to Firestore
        await setDoc(doc(db, "users", user.uid), {
            uid: user.uid,
            displayName: name,
            email: email,
            createdAt: new Date().toISOString()
        });

        // Send verification email
        await sendEmailVerification(user);
        showToast('Account created! Please verify your email.', 'success');
        showPanel('verify-panel');
        document.getElementById('user-email-display').textContent = email;
    } catch (error) {
        console.error('Register Error:', error);
        if (error.code === 'auth/email-already-in-use') {
            document.getElementById('register-email-error').textContent = 'Email already in use';
        } else if (error.code === 'auth/invalid-email') {
            document.getElementById('register-email-error').textContent = 'Invalid email address';
        } else if (error.code === 'auth/weak-password') {
            document.getElementById('register-password-error').textContent = 'Password is too weak';
        } else {
            showToast(error.message, 'error');
        }
    } finally {
        isProcessing = false;
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
    }
});

// Auth Actions: Login
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (isProcessing) return;

    const submitBtn = document.getElementById('login-submit');
    const originalText = submitBtn.textContent;
    
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    const rememberMe = document.getElementById('remember-me').checked;

    // Clear previous errors
    document.querySelectorAll('.error-msg').forEach(el => el.textContent = '');

    try {
        isProcessing = true;
        submitBtn.disabled = true;
        submitBtn.textContent = 'Signing In...';
        
        // Firebase persistence is already set to local in firebase-config.js
        // but we could explicitly set it here based on rememberMe if we wanted.
        // For now, we'll stick with local as it's better for iframes.
        
        await signInWithEmailAndPassword(auth, email, password);
        
        // Log login event
        if (analytics) {
            logEvent(analytics, 'login', { method: 'email' });
        }
        
        showToast('Signed in successfully!', 'success');
        isRedirecting = true;
        window.location.href = '/index.html';
    } catch (error) {
        console.error('Login Error:', error);
        if (error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password' || error.code === 'auth/user-not-found') {
            document.getElementById('login-password-error').textContent = 'Invalid email or password';
        } else if (error.code === 'auth/invalid-email') {
            document.getElementById('login-email-error').textContent = 'Invalid email address';
        } else {
            showToast(error.message, 'error');
        }
    } finally {
        isProcessing = false;
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
    }
});

// Auth Actions: Google
googleBtns.forEach(btn => {
    btn.addEventListener('click', async () => {
        if (isProcessing) return;

        try {
            isProcessing = true;
            const result = await signInWithPopup(auth, googleProvider);
            const user = result.user;
            
            // Log login event
            if (analytics) {
                logEvent(analytics, 'login', { method: 'google' });
            }
            
            // Save user to Firestore if new
            const userDoc = await getDoc(doc(db, "users", user.uid));
            if (!userDoc.exists()) {
                await setDoc(doc(db, "users", user.uid), {
                    uid: user.uid,
                    displayName: user.displayName,
                    email: user.email,
                    photoURL: user.photoURL,
                    createdAt: new Date().toISOString()
                });
            }
            
            showToast('Signed in with Google!', 'success');
            isRedirecting = true;
            window.location.href = '/index.html';
        } catch (error) {
            console.error('Google Auth Error:', error);
            
            // Handle specific Firebase Auth errors with more context
            const errorCode = error.code;
            const errorMessage = error.message;

            if (errorCode === 'auth/unauthorized-domain') {
                showToast('This domain is not authorized. Please add it to Authorized Domains in Firebase Console.', 'error');
            } else if (errorCode === 'auth/network-request-failed') {
                if (isInIframe) {
                    showToast('Network error: This often happens in iframes when third-party cookies are blocked. Please open the app in a New Tab to sign in.', 'error');
                } else {
                    showToast('Network error. Please check your internet connection and try again.', 'error');
                }
            } else if (errorCode === 'auth/popup-closed-by-user') {
                showToast('Sign-in popup was closed before completion.', 'info');
            } else if (errorMessage.includes('INTERNAL ASSERTION FAILED')) {
                showToast('A temporary authentication error occurred. This is often an environment-related issue. Please refresh and try again.', 'error');
            } else if (errorCode === 'auth/operation-not-allowed') {
                showToast('Google sign-in is not enabled in the Firebase Console.', 'error');
            } else {
                showToast(errorMessage || 'An unexpected error occurred during Google sign-in.', 'error');
            }
        } finally {
            isProcessing = false;
        }
    });
});

// Auth Actions: Forgot Password
forgotPasswordForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('forgot-email').value;
    try {
        await sendPasswordResetEmail(auth, email);
        showToast('Reset link sent to your email!', 'success');
        showPanel('login-panel');
    } catch (error) {
        showToast(error.message, 'error');
    }
});

// Verification Actions
resendVerificationBtn.addEventListener('click', async () => {
    if (currentUser) {
        try {
            await sendEmailVerification(currentUser);
            showToast('Verification email resent!', 'success');
        } catch (error) {
            showToast(error.message, 'error');
        }
    }
});

checkVerificationBtn.addEventListener('click', async () => {
    if (currentUser) {
        await currentUser.reload();
        if (currentUser.emailVerified) {
            showToast('Email verified!', 'success');
            window.location.href = '/index.html';
        } else {
            showToast('Email not verified yet. Please check your inbox.', 'info');
        }
    }
});

// Initialize
initTheme();
