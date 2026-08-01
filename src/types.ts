export interface Player {
  id: string;
  name: string;
  color: string;
  cash: number;
  muscle: number;
  isBot?: boolean;
}

export interface District {
  id: string; // "0" to "99"
  name: string;
  ownerId: string; // Empty if unclaimed
  color: string; // Hex color
}

export interface ActivityLog {
  id: string;
  text: string;
  timestamp: number;
  color: string;
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: string;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  };
}
