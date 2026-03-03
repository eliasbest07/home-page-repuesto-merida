import { initializeApp, getApps } from 'firebase/app'
import { getDatabase } from 'firebase/database'
import { getFirestore } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'
import { getAuth } from 'firebase/auth'

const firebaseConfig = {
  apiKey: 'AIzaSyDHuOCIJToHntWd4zh4BpC_o7ja15gi4Z0',
  authDomain: 'repuestos-merida.firebaseapp.com',
  databaseURL: 'https://repuestos-merida-default-rtdb.firebaseio.com',
  projectId: 'repuestos-merida',
  storageBucket: 'repuestos-merida.appspot.com',
  messagingSenderId: '348607426054',
  appId: '1:348607426054:web:003f8656980e92ca1b1d87',
  measurementId: 'G-DPYXKDGBY2',
}

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0]

export const rtdb    = getDatabase(app)
export const firestore = getFirestore(app)
export const storage = getStorage(app)
export const auth    = getAuth(app)
// alias legacy
export const db = rtdb
export default app
