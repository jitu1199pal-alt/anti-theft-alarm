import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// In AI Studio, the config is injected into the environment or available via a file.
// We'll try to import it, but fall back to empty to avoid crash if not provisioned yet.
// @ts-ignore
const configs = import.meta.glob('./firebase-applet-config.json', { eager: true });
const firebaseConfig = (configs['./firebase-applet-config.json'] as any)?.default || {
  apiKey: "placeholder",
  authDomain: "placeholder",
  projectId: "placeholder",
  storageBucket: "placeholder",
  messagingSenderId: "placeholder",
  appId: "placeholder",
  firestoreDatabaseId: "(default)"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, (firebaseConfig as any).firestoreDatabaseId || "(default)");
export const auth = getAuth(app);
