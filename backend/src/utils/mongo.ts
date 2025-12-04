import { MongoClient, Db, ServerApiVersion } from 'mongodb'
import { dbLogger } from './logger'

let client: MongoClient | null = null
let db: Db | null = null

export async function connectMongo(uri: string, dbName: string) {
    if (client && db) {
        dbLogger.debug('Using existing MongoDB connection')
        return { client, db }
    }

    dbLogger.debug('Creating new MongoDB connection', { dbName })

    // MongoDB Free Tier (M0) Optimizations:
    // - M0 has 500 max connections shared across all apps
    // - Keep pool small (max 5) to avoid exhausting connections
    // - Use aggressive timeouts to free up connections quickly
    client = new MongoClient(uri, {
        maxPoolSize: 3, // Even more conservative for Render free tier
        minPoolSize: 1,
        maxIdleTimeMS: 10000, // Close idle connections after 10s
        serverSelectionTimeoutMS: 60000, // Allow cold-started Atlas clusters to come back online
        socketTimeoutMS: 60000,
        connectTimeoutMS: 60000,
        retryWrites: true,
        retryReads: true,
        heartbeatFrequencyMS: 10000,
        compressors: ['zlib'],
        serverApi: {
            version: ServerApiVersion.v1,
            strict: false,
            deprecationErrors: true,
        },
        // Bun TLS compatibility - only disable validation in development
        tls: true,
        tlsAllowInvalidCertificates: process.env.NODE_ENV === 'development',
        tlsAllowInvalidHostnames: process.env.NODE_ENV === 'development',
        directConnection: false, // Important for replica sets
    })

    dbLogger.debug('Connecting to MongoDB...')
    await client.connect()
    db = client.db(dbName)

    // Verify connection
    await db.admin().ping()
    dbLogger.debug('MongoDB ping successful')

    // Ensure indexes with background creation to not block
    try {
        await db.collection('waitlist').createIndex(
            { email: 1 },
            { unique: true, background: true }
        )
        dbLogger.info('MongoDB indexes created successfully')
    } catch (error) {
        dbLogger.warn('Index creation warning', {
            error: error instanceof Error ? error.message : 'Unknown error'
        })
        // Don't fail on index creation errors in production
    }

    // Add TTL index for automatic cleanup if needed (optional)
    // Uncomment to auto-delete entries after 365 days
    // await db.collection('waitlist').createIndex(
    //   { createdAt: 1 }, 
    //   { expireAfterSeconds: 31536000, background: true }
    // )

    dbLogger.info('MongoDB connected and ready', { dbName })
    return { client, db }
}

export function getDb() {
    if (!db) throw new Error('MongoDB not connected')
    return db
}

export async function closeMongo() {
    if (client) {
        dbLogger.debug('Closing MongoDB connection...')
        await client.close()
        client = null
        db = null
        dbLogger.info('MongoDB connection closed')
    }
}

export async function checkMongoHealth(): Promise<boolean> {
    try {
        if (!client || !db) {
            dbLogger.debug('MongoDB health check: not connected')
            return false
        }
        await db.admin().ping()
        dbLogger.debug('MongoDB health check: healthy')
        return true
    } catch (error) {
        dbLogger.warn('MongoDB health check failed', {
            error: error instanceof Error ? error.message : 'Unknown error'
        })
        return false
    }
}
