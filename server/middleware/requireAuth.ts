import { Request, Response, NextFunction } from 'express';
import { adminAuth, adminDb } from '../firebaseAdmin.js';

export interface AuthenticatedRequest extends Request {
  user?: {
    uid: string;
    email?: string;
    orgId: string;
  };
}

/**
 * Consumer Google accounts get a private workspace keyed on their UID. A shared
 * org_default would expose every user's uploaded attendee PII to every other user,
 * because sign-in is open to any Google account. Corporate and institutional
 * domains still share a workspace per domain, which is the intended collaboration
 * unit. An explicit orgId on the user's profile document overrides both.
 */
export function deriveOrgId(uid: string, email?: string): string {
  const domain = email?.split('@')[1];
  if (!domain || domain === 'gmail.com' || domain === 'googlemail.com') {
    return `org_user_${uid}`;
  }
  return `org_${domain.replace(/[^a-zA-Z0-9]/g, '_')}`;
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
        let orgId = deriveOrgId(decoded.uid, decoded.email);

        // An explicit orgId on the profile doc wins, so users can be assigned to a
        // shared team workspace deliberately. Written only by the Admin SDK.
        try {
          const userDoc = await adminDb.collection('users').doc(decoded.uid).get();
          if (userDoc.exists && userDoc.data()?.orgId) {
            orgId = userDoc.data()!.orgId;
          }
        } catch (dbErr: any) {
          console.warn(
            '[requireAuth] Could not read user profile doc, using derived org:',
            dbErr.message
          );
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

