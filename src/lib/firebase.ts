import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAzbtvoDMC7tOFeaWKpy0C6_uOTtmXeF2E",
  authDomain: "devhub-i.firebaseapp.com",
  projectId: "devhub-i",
  storageBucket: "devhub-i.firebasestorage.app",
  messagingSenderId: "446996193755",
  appId: "1:446996193755:web:20a142272fe854f44247fe"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export default app;
