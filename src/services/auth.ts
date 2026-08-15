import {
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  User,
  signOut,
} from 'firebase/auth';
import { auth, googleAuthProvider, testFirestoreConnection } from './firebase';

let cachedAccessToken: string | null = null;

// Run initial connection test and log diagnostic state
testFirestoreConnection()
  .then((res) => console.log('[Firebase] Connection check state:', res.state))
  .catch((e) => console.error('[Firebase] Firestore connection check failed:', e));

export interface AuthState {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isGuestDemo: boolean;
}

export class FirebaseAuthError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = 'FirebaseAuthError';
    this.code = code;
  }
}

export function getVietnameseAuthErrorMessage(code: string): string {
  switch (code) {
    case 'auth/popup-blocked':
      return 'Trình duyệt đã chặn cửa sổ đăng nhập. Vui lòng cho phép popup và thử lại.';
    case 'auth/unauthorized-domain':
      return 'Tên miền này chưa được cấp phép trong Firebase Console.';
    case 'auth/popup-closed-by-user':
      return 'Bạn đã đóng cửa sổ đăng nhập trước khi hoàn tất.';
    case 'auth/network-request-failed':
      return 'Không thể kết nối tới máy chủ xác thực. Kiểm tra kết nối mạng.';
    default:
      return `Đăng nhập không thành công (${code}).`;
  }
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
    const code = err?.code || 'auth/unknown';
    const message = getVietnameseAuthErrorMessage(code);
    console.error('[Auth] Google Sign-In Error:', code, err?.message || err);
    throw new FirebaseAuthError(code, message);
  }
}

export async function logoutUser(): Promise<void> {
  try {
    await signOut(auth);
  } catch (e: any) {
    console.warn('[Auth] Logout warning:', e?.message || e);
  }
  cachedAccessToken = null;
}

export function getCachedToken(): string | null {
  return cachedAccessToken;
}

