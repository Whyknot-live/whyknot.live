#!/usr/bin/env bun
/**
 * Utility script to generate bcrypt hashes for admin passwords
 * 
 * Usage:
 *   bun run src/scripts/hash-password.ts "your-secure-password"
 * 
 * With environment pepper (optional, for environment-specific hashes):
 *   ADMIN_PASSWORD_PEPPER="your-env-pepper" bun run src/scripts/hash-password.ts "your-password"
 * 
 * The generated hash should be stored in the ADMIN_PASSWORD_HASH environment variable.
 * 
 * Security notes:
 * - Use a strong password (12+ chars, mix of uppercase, lowercase, numbers, symbols)
 * - The cost factor (12) provides good security while keeping login reasonable (~250ms)
 * - Never commit the actual password or hash to version control
 * - Store the hash in environment variables or a secrets manager
 * - Use different peppers for different environments (dev, staging, prod)
 */

import bcrypt from 'bcrypt'

// Cost factor of 12 provides ~250ms hash time on modern hardware
// This is a good balance between security and performance
// See: https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html
const BCRYPT_ROUNDS = 12

async function main() {
    const password = process.argv[2]
    const pepper = process.env.ADMIN_PASSWORD_PEPPER ?? ''

    if (!password) {
        console.error('Usage: bun run src/scripts/hash-password.ts "your-password"')
        console.error('')
        console.error('Example:')
        console.error('  bun run src/scripts/hash-password.ts "MySecureP@ssw0rd!"')
        console.error('')
        console.error('With environment pepper (optional):')
        console.error('  ADMIN_PASSWORD_PEPPER="my-secret-pepper" bun run src/scripts/hash-password.ts "MySecureP@ssw0rd!"')
        console.error('')
        console.error('The generated hash should be stored in ADMIN_PASSWORD_HASH env variable.')
        process.exit(1)
    }

    // Validate password strength before hashing
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*#?&])[A-Za-z\d@$!%*#?&]/
    if (password.length < 12) {
        console.error('Error: Password must be at least 12 characters long.')
        process.exit(1)
    }
    if (!passwordRegex.test(password)) {
        console.error('Error: Password must contain:')
        console.error('  - At least one uppercase letter')
        console.error('  - At least one lowercase letter')
        console.error('  - At least one number')
        console.error('  - At least one special character (@$!%*#?&)')
        process.exit(1)
    }

    console.log(`Generating bcrypt hash with ${BCRYPT_ROUNDS} rounds...`)
    if (pepper) {
        console.log('🔐 Using environment pepper (ADMIN_PASSWORD_PEPPER)')
    }
    console.log('')

    const startTime = Date.now()
    // Combine password with pepper for additional security
    const passwordWithPepper = pepper ? `${password}${pepper}` : password
    const hash = await bcrypt.hash(passwordWithPepper, BCRYPT_ROUNDS)
    const duration = Date.now() - startTime

    console.log('Generated hash:')
    console.log('')
    console.log(`  ${hash}`)
    console.log('')
    console.log(`Hash generated in ${duration}ms`)
    console.log('')

    // Escape $ characters for .env file (dotenv interprets $ as variable reference)
    const escapedHash = hash.replace(/\$/g, '\\$')

    console.log('📋 Copy this line to your .env file:')
    console.log('')
    console.log(`  ADMIN_PASSWORD_HASH=${escapedHash}`)
    console.log('')
    console.log('⚠️  Security reminders:')
    console.log('  - Never commit the password or hash to version control')
    console.log('  - Store the hash in environment variables or a secrets manager')
    console.log('  - Use different passwords for different environments')
}

main().catch((error) => {
    console.error('Error generating hash:', error)
    process.exit(1)
})
