import passport from 'passport'
import fs from 'fs'
import path from 'path'
import { Strategy as LocalStrategy } from 'passport-local'
import { Strategy as JWTStrategy } from 'passport-jwt'
import ServiceClient from '../services/client'

const secret = fs.readFileSync(path.resolve(__dirname, '../keys/public.pem'), 'utf8')

const services = {
  employee: new ServiceClient('employee'),
  auth: new ServiceClient('auth'),
  company: new ServiceClient('company'),
  department: new ServiceClient('department'),
  category: new ServiceClient('category')
}

passport.use(new LocalStrategy({
  usernameField: 'identifier',
  passwordField: 'password',
  session: true
}, async (identifier, password, done) => {
  try {
    const response = await services.auth.send({ type: 'authenticate', query: { identifier, password } })

    if (!response.data || !response.data._id || !response.data._id.length)
      return done(response, false)

    if (!response.data.activated)
      return done(response, false, { i18n: 'ACTIVATION_NEEDED' })

    return done(null, response)
  } catch (e) {
    return done(e, false)
  }
}))

const expiredMessage = {
  domain: 'auth',
  code: 403,
  i18n: 'JWT_EXPIRED',
  error: null,
  stack: null,
  data: null
}

passport.use(new JWTStrategy({
  jwtFromRequest: req => req.cookies['sproud.jwt'],
  secretOrKey: secret,
  algorithms: ['RS256']
}, async (jwtPayload, done) => {
  if (Date.now() > jwtPayload.expires)
    return done(expiredMessage)

  const response = await services.employee.send({ type: 'findBy', query: { _id: jwtPayload._id } })

  if (!response.data || !response.data._id || !response.data._id.length)
    return done(response, false)

  if (!response.data.activated)
    return done(response, false, { i18n: 'ACTIVATION_NEEDED' })

  return done(null, response)
}))

passport.serializeUser((employee, cb) => cb(null, employee._id))

passport.deserializeUser(async (_id, cb) => {
  const query = { _id }

  try {
    const employee = await services.employee.send({ type: 'findBy', query })

    const company = await services.company.send({ type: 'findBy', query: { _id: employee.data.company } })
    employee.data.company = company.data

    const department = await services.department.send({ type: 'findBy', query: { _id: employee.data.department } })
    employee.data.department = department.data

    const categories = []
    await Promise.all(employee.data.interests.map(async interest => {
      const { data: i } = await services.category.send({ type: 'findBy', query: { _id: interest } })
      categories.push(i)
    }))

    employee.data.interests = categories

    return cb(null, employee.data)
  } catch (e) {
    return cb(e, null)
  }
})

export default passport
