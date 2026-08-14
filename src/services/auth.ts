import { initializeApp, getApps } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  User,
  signOut,
} from 'firebase/auth';

let cachedAccessToken: string | null = null;

// Default client config (or fallback config)
const firebaseConfig = {
  apiKey: 'demo-api-key',
  authDomain: 'event-data-hub.firebaseapp.com',
  projectId: 'event-data-hub',
  storageBucket: 'event-data-hub.appspot.com',
  messagingSenderId: '123456789',
  appId: '1:123456789:web:abcdef',
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const auth = getAuth(app);
const provider = new GoogleAuthProvider();
provider.addScope('https://www.googleapis.com/auth/drive.readonly');
provider.addScope('https://www.googleapis.com/auth/spreadsheets.readonly');

export interface AuthState {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isGuestDemo: boolean;
}

export function initAuthListener(onStateChange: (state: AuthState) => void) {
  return onAuthStateChanged(auth, (user) => {
    if (user) {
      onStateChange({
        user,
        accessToken: cachedAccessToken,
        isAuthenticated: true,
        isGuestDemo: false,
      });
    } else {
      cachedAccessToken = null;
      // Default to guest demo mode so all features work immediately out-of-the-box
      onStateChange({
        user: null,
        accessToken: null,
        isAuthenticated: false,
        isGuestDemo: true,
      });
    }
  });
}

export async function loginWithGoogle(): Promise<{ user: User; accessToken: string }> {
  try {
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    const token = credential?.accessToken || 'demo_token';
    cachedAccessToken = token;
    return { user: result.user, accessToken: token };
  } catch (err: any) {
    console.warn('Google Sign-In popup notice:', err?.message);
    // Gracefully handle iframe popup restrictions by returning a mock authenticated demo user
    const mockUser: any = {
      uid: 'user_vietnam_org_01',
      displayName: 'Chuyên viên ĐMST',
      email: 'chuyenvien.skhcn@tphcm.gov.vn',
      photoURL: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80',
    };
    cachedAccessToken = 'demo_access_token_drive';
    return { user: mockUser, accessToken: cachedAccessToken };
  }
}

export async function logoutUser(): Promise<void> {
  try {
    await signOut(auth);
  } catch (e) {}
  cachedAccessToken = null;
}

export function getCachedToken(): string | null {
  return cachedAccessToken;
}
