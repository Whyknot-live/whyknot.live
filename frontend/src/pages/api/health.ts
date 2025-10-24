// Health check endpoint for monitoring and deployment verification
export async function GET() {
 const healthCheck = {
 status: 'ok',
 timestamp: new Date().toISOString(),
 version: '1.0.0',
 environment: import.meta.env.MODE,
 uptime: process.uptime ? Math.floor(process.uptime()) : null,
 memory: process.memoryUsage ? {
 rss: Math.round(process.memoryUsage().rss / 1024 / 1024),
 heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
 heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024)
 } : null
 };

 return new Response(JSON.stringify(healthCheck, null, 2), {
 status: 200,
 headers: {
 'Content-Type': 'application/json',
 'Cache-Control': 'no-cache, no-store, must-revalidate',
 'Pragma': 'no-cache',
 'Expires': '0'
 }
 });
}