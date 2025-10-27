import { MongoClient, Db } from 'mongodb'

let client: MongoClient | null = null
let db: Db | null = null

export async function connectMongo(uri: string, dbName: string) {
 if (client && db) return { client, db }

 // MongoDB Free Tier (M0) Optimizations:
 // - M0 has 500 max connections shared across all apps
 // - Keep pool small (max 5) to avoid exhausting connections
 // - Use aggressive timeouts to free up connections quickly
 client = new MongoClient(uri, {
 maxPoolSize: 3, // Even more conservative for Render free tier
 minPoolSize: 1,
 maxIdleTimeMS: 10000, // Close idle connections after 10s
 serverSelectionTimeoutMS: 10000, // Increased from 5s
 socketTimeoutMS: 45000, // Increased for stability
 connectTimeoutMS: 15000, // Increased from 10s
 retryWrites: true,
 retryReads: true,
 heartbeatFrequencyMS: 10000,
 compressors: ['snappy', 'zlib'], // Enable compression to reduce data transfer
 tlsAllowInvalidCertificates: false,
 tlsAllowInvalidHostnames: false,
 directConnection: false, // Important for replica sets
 })
 
 await client.connect()
 db = client.db(dbName)
 
 // Verify connection
 await db.admin().ping()

 // Ensure indexes with background creation to not block
 try {
 await db.collection('waitlist').createIndex(
 { email: 1 }, 
 { unique: true, background: true }
 )
 console.info('MongoDB indexes created successfully')
 } catch (error) {
 console.warn('Index creation warning:', error)
 // Don't fail on index creation errors in production
 }
 
 // Add TTL index for automatic cleanup if needed (optional)
 // Uncomment to auto-delete entries after 365 days
 // await db.collection('waitlist').createIndex(
 //   { createdAt: 1 }, 
 //   { expireAfterSeconds: 31536000, background: true }
 // )

 console.info('MongoDB connected and ready')
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
