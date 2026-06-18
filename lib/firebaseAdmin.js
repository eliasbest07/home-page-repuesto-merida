import 'server-only'
import admin from 'firebase-admin'

const PROJECT_ID = process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.FIREBASE_PROJECT_ID || 'repuestos-merida'
const STORAGE_BUCKET = process.env.FIREBASE_ADMIN_STORAGE_BUCKET || process.env.FIREBASE_STORAGE_BUCKET || 'repuestos-merida.appspot.com'

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
  if (admin.apps.length > 0) return admin.app()

  const serviceAccount = serviceAccountFromEnv()
  const credential = serviceAccount
    ? admin.credential.cert(serviceAccount)
    : admin.credential.applicationDefault()

  return admin.initializeApp({
    credential,
    projectId: PROJECT_ID,
    storageBucket: STORAGE_BUCKET,
  })
}

function adminApp() {
  return initializeAdminApp()
}

export const adminFieldValue = admin.firestore.FieldValue
export { STORAGE_BUCKET }

export function getAdminDb() {
  return admin.firestore(adminApp())
}

export function getAdminBucket() {
  return admin.storage(adminApp()).bucket()
}
