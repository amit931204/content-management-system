import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getAnalytics, isSupported } from 'firebase/analytics';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyA51Poo0szLYWM_aBQDYs58PtTZAt8D1CY',
  authDomain: 'user-management-amit.firebaseapp.com',
  projectId: 'user-management-amit',
  messagingSenderId: '898658034449',
  appId: '1:898658034449:web:0e37967b6d8247bc94e2b0',
  measurementId: 'G-GLR931YWBQ'
};

export const firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(firebaseApp);
export const firestore = getFirestore(firebaseApp);
export const analytics = isSupported().then((supported) =>
  supported ? getAnalytics(firebaseApp) : null
);