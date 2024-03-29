// import http from 'http'
// import stoppable from 'stoppable'
import express from 'express'
import subdomain from 'express-subdomain'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import winston from 'winston'
import expressWinston from 'express-winston'
import bodyParser from 'body-parser'
import redis from 'redis'
import RateLimit from 'express-rate-limit'
import RateLimitStore from 'rate-limit-redis'
import helmet from 'helmet'

import apiRoutes from './routes/api'
import joinRoutes from './routes/join'
import passport from './middlewares/passport'

import services from './services'

const app = express()
const PORT = 8080

const corsOptionsDelegate = (req, callback) => {
  const corsOptions = {
    credentials: true,
    optionsSuccessStatus: 200
  }

  corsOptions.origin = (origin, callback) => {
    const domain = origin.match(/^(https?:\/\/.*\.sproud\.(dev|io)$)/)

    if (!origin || domain === null) {
      const msg = 'The CORS policy for this site does not allow access from the specified Origin.'
      return callback(new Error(msg), false)
    }

    return callback(null, true)
  }

  return callback(null, corsOptions)
}

const rateLimiter = new RateLimit({
  store: new RateLimitStore({
    client: redis.createClient(`redis://${process.env.COTE_DISCOVERY_REDIS_HOST}:6379/1`)
  }),
  max: 1000,
  windowMs: 1000 * 60
})

services.authentication = services.auth
services.email = services.mail
app.get('/healthz/:type/:service?', async (req, res) => {
  try {
    if (!req.params.service || req.params.service === 'api-gateway')
      return res.sendStatus(200)

    const service = services[req.params.service]
    return service.send({ type: req.params.type }, (err, status) => {
      if (status !== 200)
        return res.sendStatus(500)

      return res.sendStatus(status)
    })
  } catch (e) {
    return res.sendStatus(500)
  }
})

app.use(expressWinston.logger({
  transports: [
    new winston.transports.Console()
  ],
  format: winston.format.combine(
    winston.format.json()
  ),
  meta: true
}))

app.options('*', cors(corsOptionsDelegate))
app.use(cors(corsOptionsDelegate))
app.use(helmet())
app.use(cookieParser())
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }))

app.use(passport.initialize())

app.use((err, req, res, next) => {
  if (err && err.code === 404)
    req.logout()

  if (err)
    return res.status(err.code || 500).json(err)

  return next()
})

if (process.env.NODE_ENV === 'production')
  app.use(rateLimiter)

if (process.env.STAGING === 'true') {
  app.use(subdomain('api.*', apiRoutes))
  app.use(subdomain('join.*', joinRoutes))
} else {
  app.use(subdomain('api', apiRoutes))
  app.use(subdomain('join', joinRoutes))
}

app.use(expressWinston.errorLogger({
  transports: [
    new winston.transports.Console()
  ],
  format: winston.format.combine(
    winston.format.json()
  ),
  meta: true
}))

app.listen(PORT, () => {
  // eslint-disable-next-line
  console.log(`🤩 sproud.io API Gateway listening on port ${PORT}!`)
})

// const server = stoppable(http.createServer(app))
// server.listen(PORT)

// server.once('listening', () => {
//   const { port } = server.address()
//   // eslint-disable-next-line
//   console.log(`🤩 sproud.io API Gateway listening on port ${port}!`)
// })

// server.once('error', err => {
//   // eslint-disable-next-line
//   console.error('server error', err)

//   server.stop()
//   throw err
// })
