import { MongoClient, Db } from 'mongodb'

let client: MongoClient | null = null
let db: Db | null = null

export async function connectMongo(uri: string, dbName: string) {
 if (client && db) return { client, db }

 client = new MongoClient(uri, {
 maxPoolSize: 10,
 minPoolSize: 2,
 serverSelectionTimeoutMS: 5000,
 socketTimeoutMS: 45000,
 connectTimeoutMS: 10000,
 retryWrites: true,
 retryReads: true
 })
 
 await client.connect()
 db = client.db(dbName)

 // ensure index
 await db.collection('waitlist').createIndex({ email: 1 }, { unique: true })

 console.info('MongoDB connected and indexes created')
 return { client, db }
}

export function getDb() {
 if (!db) throw new Error('MongoDB not connected')
 return db
}

export async function closeMongo() {
 if (client) {
 await client.close()
 client = null
 db = null
 console.info('MongoDB connection closed')
 }
}

export async function checkMongoHealth(): Promise<boolean> {
 try {
 if (!client || !db) {
 return false
 }
 await db.admin().ping()
 return true
 } catch {
 return false
 }
}
