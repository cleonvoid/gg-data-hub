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
            // Note on org_default: Consumer Gmail addresses (gmail.com, googlemail.com)
            // intentionally share org_default workspace for demo simplicity.
            // Corporate / institutional emails are partitioned by domain name.
            const domain = decoded.email.split('@')[1];
            if (domain && domain !== 'gmail.com' && domain !== 'googlemail.com') {
              orgId = `org_${domain.replace(/[^a-zA-Z0-9]/g, '_')}`;
            }
          }
        } catch (dbErr: any) {
          console.warn('[requireAuth] Failed to load user profile doc, using domain derivation:', dbErr.message);
          if (decoded.email) {
            const domain = decoded.email.split('@')[1];
            if (domain && domain !== 'gmail.com' && domain !== 'googlemail.com') {
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
        // A token that fails verification is a hard 401. The demo escape hatch below is
        // only for requests carrying NO token at all, and only when explicitly enabled.
        console.warn('[requireAuth] Token verification failed:', err.message);
        res.status(401).json({ error: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.' });
        return;
      }
    }
  }

  // No token present. The demo escape hatch is opt-in only: an unset or malformed
  // value must never grant access, because this service is deployed with
  // --allow-unauthenticated and org scoping keys entirely off req.user.orgId.
  if (process.env.ALLOW_ANON_DEMO === 'true') {
    // Logged on every request, not once — it must be impossible to leave this on by accident.
    console.warn(
      '[requireAuth] ALLOW_ANON_DEMO=true — request served WITHOUT authentication as org_default.'
    );
    req.user = {
      uid: 'demo_user_preview',
      email: 'demo@eventdatahub.internal',
      orgId: 'org_default',
    };
    return next();
  }

  res.status(401).json({
    error: 'Yêu cầu xác thực. Vui lòng đăng nhập qua Google để tiếp tục.',
  });
}

