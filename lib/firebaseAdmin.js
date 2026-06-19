import 'server-only'
import { applicationDefault, cert, getApp, getApps, initializeApp } from 'firebase-admin/app'
import { getDatabase } from 'firebase-admin/database'
import { FieldValue, getFirestore } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'

const PROJECT_ID = process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.FIREBASE_PROJECT_ID || 'repuestos-merida'
const STORAGE_BUCKET = process.env.FIREBASE_ADMIN_STORAGE_BUCKET || process.env.FIREBASE_STORAGE_BUCKET || 'repuestos-merida.appspot.com'
const DATABASE_URL = process.env.FIREBASE_ADMIN_DATABASE_URL || process.env.FIREBASE_DATABASE_URL || 'https://repuestos-merida-default-rtdb.firebaseio.com'

function serviceAccountFromEnv() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    return JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON)
  }

  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')

  if (clientEmail && privateKey) {
    return {
      projectId: PROJECT_ID,
      clientEmail,
      privateKey,
    }
  }

  return null
}

function initializeAdminApp() {
  if (getApps().length > 0) return getApp()

  const serviceAccount = serviceAccountFromEnv()
  const credential = serviceAccount
    ? cert(serviceAccount)
    : applicationDefault()

  return initializeApp({
    credential,
    projectId: PROJECT_ID,
    storageBucket: STORAGE_BUCKET,
    databaseURL: DATABASE_URL,
  })
}

function adminApp() {
  return initializeAdminApp()
}

export const adminFieldValue = FieldValue
export { STORAGE_BUCKET }

export function getAdminDb() {
  return getFirestore(adminApp())
}

export function getAdminBucket() {
  return getStorage(adminApp()).bucket()
}

export function getAdminRealtimeDb() {
  return getDatabase(adminApp())
}
