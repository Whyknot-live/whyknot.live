import Razorpay from 'razorpay'
import { validateEnv } from './env'

// P1 payments-india.md: Razorpay-first, INR-only at launch (C1).
// One-time Verified + Pro/Team subscriptions. Backend is source of truth.

export const PLANS = {
    verified: { kind: 'one_time' as const, amountPaise: 99900, currency: 'INR', label: 'Verified' },
    pro: { kind: 'subscription' as const, label: 'Pro' },
    team: { kind: 'subscription' as const, label: 'Team' }
} as const

export type PlanId = keyof typeof PLANS

export function isPaymentsConfigured(): boolean {
    const env = validateEnv()
    return Boolean(env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET)
}

export function getPaymentsPublicConfig() {
    const env = validateEnv()
    return {
        configured: isPaymentsConfigured(),
        keyId: env.RAZORPAY_KEY_ID ?? '',
        currency: env.RAZORPAY_CURRENCY ?? 'INR',
        plans: {
            verified: { amountPaise: PLANS.verified.amountPaise, currency: env.RAZORPAY_CURRENCY ?? 'INR' },
            pro: { planIdConfigured: Boolean(env.RAZORPAY_PLAN_PRO_ID) },
            team: { planIdConfigured: Boolean(env.RAZORPAY_PLAN_TEAM_ID) }
        }
    }
}

let singleton: Razorpay | null = null

export function getRazorpay(): Razorpay {
    const env = validateEnv()
    if (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET) {
        throw new Error('Payments not configured (RAZORPAY_KEY_ID/SECRET missing)')
    }
    if (!singleton) {
        singleton = new Razorpay({
            key_id: env.RAZORPAY_KEY_ID,
            key_secret: env.RAZORPAY_KEY_SECRET
        })
    }
    return singleton
}

export function getSubscriptionPlanId(plan: 'pro' | 'team'): string | null {
    const env = validateEnv()
    if (plan === 'pro') return env.RAZORPAY_PLAN_PRO_ID ?? null
    return env.RAZORPAY_PLAN_TEAM_ID ?? null
}
