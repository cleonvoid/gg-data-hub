import {
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  User,
  signOut,
} from 'firebase/auth';
import { auth, googleAuthProvider, testFirestoreConnection } from './firebase';

let cachedAccessToken: string | null = null;

// Run initial connection test
testFirestoreConnection().catch((e) => console.log('Firebase connection initialized:', e));

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
      onStateChange({
        user: null,
        accessToken: null,
        isAuthenticated: false,
        isGuestDemo: true,
      });
    }
  });
}

export async function loginWithGoogle(): Promise<{ user: User; accessToken: string; idToken: string }> {
  try {
    const result = await signInWithPopup(auth, googleAuthProvider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    const accessToken = credential?.accessToken || '';
    const idToken = await result.user.getIdToken();
    cachedAccessToken = accessToken;
    return { user: result.user, accessToken, idToken };
  } catch (err: any) {
    console.error('Google Sign-In Error:', err);
    throw err;
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
