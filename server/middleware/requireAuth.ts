import { Request, Response, NextFunction } from 'express';
import { adminAuth, adminDb } from '../firebaseAdmin.js';

export interface AuthenticatedRequest extends Request {
  user?: {
    uid: string;
    email?: string;
    orgId: string;
  };
}

export async function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const idToken = authHeader.split('Bearer ')[1].trim();

    if (idToken && idToken !== 'null' && idToken !== 'undefined') {
      try {
        const decoded = await adminAuth.verifyIdToken(idToken);
        let orgId = 'org_default';

        // 1. Check if user document has custom orgId configured
        try {
          const userDoc = await adminDb.collection('users').doc(decoded.uid).get();
          if (userDoc.exists && userDoc.data()?.orgId) {
            orgId = userDoc.data()!.orgId;
          } else if (decoded.email) {
            // Derive org from corporate / educational email domain
            const domain = decoded.email.split('@')[1];
            if (domain && domain !== 'gmail.com' && domain !== 'googlemail.com') {
              orgId = `org_${domain.replace(/[^a-zA-Z0-9]/g, '_')}`;
            }
          }
        } catch (_dbErr) {
          // Fall back to domain or default
          if (decoded.email) {
            const domain = decoded.email.split('@')[1];
            if (domain && domain !== 'gmail.com') {
              orgId = `org_${domain.replace(/[^a-zA-Z0-9]/g, '_')}`;
            }
          }
        }

        req.user = {
          uid: decoded.uid,
          email: decoded.email,
          orgId,
        };
        return next();
      } catch (err: any) {
        console.warn('[requireAuth] Token verification failed:', err.message);
      }
    }
  }

  // Graceful fallback for local preview / standalone testing without live OAuth session
  if (process.env.NODE_ENV !== 'production' || process.env.ALLOW_ANON_DEMO === 'true') {
    req.user = {
      uid: 'demo_user_preview',
      email: 'demo@eventdatahub.internal',
      orgId: 'org_default',
    };
    return next();
  }

  res.status(401).json({
    error: 'Yêu cầu xác thực không hợp lệ. Vui lòng đăng nhập qua Google để tiếp tục.',
  });
}
