import { auth, db } from '../firebase';
import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  serverTimestamp, 
  onSnapshot 
} from 'firebase/firestore';
import { addDays, isAfter } from 'date-fns';

export type SubscriptionType = 'trial' | 'active' | 'free_referral' | 'lifetime';

export interface UserProfile {
  userId: string;
  email: string | null;
  subscriptionType: SubscriptionType;
  trialStartedAt: any;
  referralCount: number;
  isLifetimeAccess: boolean;
  subscriptionExpiresAt: any;
  createdAt: any;
  updatedAt: any;
}

const TRIAL_DAYS = 7;
const REFERRAL_GOAL_MONTH = 5;
const REFERRAL_GOAL_LIFETIME = 11;
export const SUBSCRIPTION_PRICE = 21;

export const subscriptionService = {
  async getProfile(userId: string): Promise<UserProfile | null> {
    try {
      const docRef = doc(db, 'users', userId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        return docSnap.data() as UserProfile;
      }
      return null;
    } catch (error) {
      console.error("Error fetching profile:", error);
      return null;
    }
  },

  async initializeProfile(userId: string, email: string | null): Promise<UserProfile> {
    const profile: UserProfile = {
      userId,
      email,
      subscriptionType: 'trial',
      trialStartedAt: new Date().toISOString(), // Fallback if serverTimestamp is messy in local state
      referralCount: 0,
      isLifetimeAccess: false,
      subscriptionExpiresAt: addDays(new Date(), TRIAL_DAYS).toISOString(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    try {
      await setDoc(doc(db, 'users', userId), {
        ...profile,
        trialStartedAt: serverTimestamp(),
        subscriptionExpiresAt: addDays(new Date(), TRIAL_DAYS)
      });
    } catch (error) {
      console.error("Error creating profile:", error);
    }
    return profile;
  },

  async addReferral(userId: string): Promise<void> {
    try {
      const docRef = doc(db, 'users', userId);
      const snap = await getDoc(docRef);
      if (!snap.exists()) return;

      const data = snap.data() as UserProfile;
      const newCount = (data.referralCount || 0) + 1;
      
      let update: Partial<UserProfile> = {
        referralCount: newCount,
        updatedAt: serverTimestamp(),
      };

      if (newCount >= REFERRAL_GOAL_LIFETIME) {
        update.subscriptionType = 'lifetime';
        update.isLifetimeAccess = true;
      } else if (newCount >= REFERRAL_GOAL_MONTH) {
        // If they hit 5, give them a month
        const currentExpiry = data.subscriptionExpiresAt ? new Date(data.subscriptionExpiresAt) : new Date();
        update.subscriptionExpiresAt = addDays(currentExpiry, 30).toISOString();
        update.subscriptionType = 'free_referral';
      }

      await updateDoc(docRef, update);
    } catch (error) {
      console.error("Error adding referral:", error);
    }
  },

  async processSubscription(userId: string): Promise<void> {
    try {
      const docRef = doc(db, 'users', userId);
      const currentExpiry = new Date();
      
      await updateDoc(docRef, {
        subscriptionType: 'active',
        subscriptionExpiresAt: addDays(currentExpiry, 30).toISOString(),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error("Error processing subscription:", error);
    }
  },

  isSubscriptionActive(profile: UserProfile | null): boolean {
    if (!profile) return false;
    if (profile.subscriptionType === 'lifetime') return true;
    
    if (!profile.subscriptionExpiresAt) return false;
    
    // Check if expiry date is in the future
    const expiry = profile.subscriptionExpiresAt.toDate ? profile.subscriptionExpiresAt.toDate() : new Date(profile.subscriptionExpiresAt);
    return isAfter(expiry, new Date());
  }
};
