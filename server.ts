// Custom production server (run via `tsx`, same pattern navigator-ts uses
// for its own server) - NOT Next.js's instrumentation.ts hook. Next.js
// compiles instrumentation.ts for both the edge AND nodejs runtimes, and the
// edge bundle can't resolve better-sqlite3's native bindings no matter how
// the import is guarded/deferred - a structural incompatibility, not a config
// fix. A plain long-lived Node process sidesteps it entirely, and is what
// `next start` already amounts to under the hood.
import { createServer } from 'node:http'
import next from 'next'
import cron from 'node-cron'
import { checkCouponActivations } from './src/lib/couponActivation.js'

const port = Number(process.env.PORT || 3000)
const app = next({ dev: process.env.NODE_ENV !== 'production' })
const handle = app.getRequestHandler()

app.prepare().then(() => {
  cron.schedule('*/30 * * * *', () => {
    checkCouponActivations().catch((error) => {
      console.error('Scheduled coupon-activation check failed', error)
    })
  })

  createServer((req, res) => handle(req, res)).listen(port, () => {
    console.log(`Ready on port ${port}`)
  })
})
