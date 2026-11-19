import { initializeApp, getApps } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  signOut,
  User as FirebaseUser
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDocFromServer,
  onSnapshot,
  collection,
  query,
  where,
  getDocs,
  setDoc,
  updateDoc
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

export const SCOPES = [
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
  'openid'
];

const effectiveFirebaseConfig = {
  ...firebaseConfig,
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || firebaseConfig.apiKey,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || firebaseConfig.authDomain,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || firebaseConfig.projectId,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || firebaseConfig.storageBucket,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || firebaseConfig.messagingSenderId,
  appId: import.meta.env.VITE_FIREBASE_APP_ID || firebaseConfig.appId,
  firestoreDatabaseId: import.meta.env.VITE_FIREBASE_DATABASE_ID || firebaseConfig.firestoreDatabaseId
};

export const activeFirebaseProjectId = effectiveFirebaseConfig.projectId;

const app = getApps().length === 0 ? initializeApp(effectiveFirebaseConfig) : getApps()[0];
export const auth = getAuth(app);
export const db = getFirestore(app, effectiveFirebaseConfig.firestoreDatabaseId);

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

async function testFirestoreConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
testFirestoreConnection();

const provider = new GoogleAuthProvider();
SCOPES.forEach((scope) => provider.addScope(scope));
provider.setCustomParameters({
  prompt: 'select_account'
});

// In-memory token caching (never persisted in localStorage/sessionStorage)
let isSigningIn = false;
let isLoggingOut = false;
let cachedIdToken: string | null = null;
let cachedAccessToken: string | null = null;

const ADMIN_EMAIL = 'bobysagar761855@gmail.com';

export async function ensureAdminRoleInFirestore(firebaseUser: FirebaseUser): Promise<void> {
  if (!firebaseUser?.email || firebaseUser.email.toLowerCase() !== ADMIN_EMAIL || !firebaseUser.emailVerified) {
    return;
  }

  const usersColPath = 'users';
  try {
    const q = query(collection(db, usersColPath), where('email', '==', ADMIN_EMAIL));
    const snap = await getDocs(q);
    for (const userDoc of snap.docs) {
      if (userDoc.data()?.role !== 'admin') {
        try {
          await updateDoc(doc(db, usersColPath, userDoc.id), { role: 'admin' });
        } catch (err) {
          handleFirestoreError(err, OperationType.UPDATE, `${usersColPath}/${userDoc.id}`);
        }
      }
    }

    const ownDocId = `usr-${firebaseUser.uid}`;
    try {
      await setDoc(
        doc(db, usersColPath, ownDocId),
        {
          id: ownDocId,
          google_id: firebaseUser.uid,
          email: ADMIN_EMAIL,
          role: 'admin'
        },
        { merge: true }
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `${usersColPath}/${ownDocId}`);
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, usersColPath);
  }
}

export const initGoogleAuth = (
  onAuthSuccess?: (firebaseUser: FirebaseUser, idToken: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
    if (isLoggingOut) return;
    if (firebaseUser) {
      try {
        const idToken = await firebaseUser.getIdToken();
        cachedIdToken = idToken;
        ensureAdminRoleInFirestore(firebaseUser).catch((e) =>
          console.warn('[Firestore] Admin role sync warning:', e)
        );
        if (onAuthSuccess && !isSigningIn && !isLoggingOut) {
          onAuthSuccess(firebaseUser, idToken);
        }
      } catch {
        cachedIdToken = null;
        cachedAccessToken = null;
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      cachedIdToken = null;
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

export const signInWithGoogle = async (): Promise<{
  firebaseUser: FirebaseUser;
  idToken: string;
  accessToken: string | null;
}> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    const idToken = await result.user.getIdToken(true);

    cachedIdToken = idToken;
    cachedAccessToken = credential?.accessToken || null;

    ensureAdminRoleInFirestore(result.user).catch((e) =>
      console.warn('[Firestore] Admin role sync warning:', e)
    );

    return {
      firebaseUser: result.user,
      idToken,
      accessToken: cachedAccessToken
    };
  } finally {
    isSigningIn = false;
  }
};

export const getCachedIdToken = async (): Promise<string | null> => {
  if (auth.currentUser) {
    cachedIdToken = await auth.currentUser.getIdToken();
    return cachedIdToken;
  }
  return cachedIdToken;
};

export const subscribeToUserWallet = (
  userId: string,
  onBalanceUpdate: (newBalance: number) => void
): (() => void) => {
  let unsubscribeDoc: (() => void) | null = null;
  let disposed = false;

  const attachListener = (firebaseUser: FirebaseUser | null) => {
    if (unsubscribeDoc) {
      unsubscribeDoc();
      unsubscribeDoc = null;
    }
    if (disposed || !firebaseUser) return;

    const isOwner =
      firebaseUser.uid === userId || `usr-${firebaseUser.uid}` === userId;
    if (!isOwner) return;

    const docPath = `users/${userId}`;
    unsubscribeDoc = onSnapshot(
      doc(db, 'users', userId),
      (snapshot) => {
        if (!snapshot.exists()) return;
        const data = snapshot.data();
        const rawBalance =
          typeof data?.wallet_balance === 'number'
            ? data.wallet_balance
            : typeof data?.balance === 'number'
              ? data.balance
              : null;

        if (rawBalance !== null && !Number.isNaN(rawBalance)) {
          onBalanceUpdate(Number(rawBalance.toFixed(2)));
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, docPath);
      }
    );
  };

  if (auth.currentUser) {
    attachListener(auth.currentUser);
  }

  const unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser) => {
    attachListener(firebaseUser);
  });

  return () => {
    disposed = true;
    unsubscribeAuth();
    if (unsubscribeDoc) {
      unsubscribeDoc();
      unsubscribeDoc = null;
    }
  };
};

export const googleLogout = async (): Promise<void> => {
  isLoggingOut = true;
  cachedIdToken = null;
  cachedAccessToken = null;
  try {
    await signOut(auth);
  } finally {
    isLoggingOut = false;
  }
};
