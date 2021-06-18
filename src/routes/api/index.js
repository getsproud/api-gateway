import { Router } from 'express'
import jwt from 'jsonwebtoken'
import fs from 'fs'
import path from 'path'
import errorToJson from 'error-to-json'

import passport from '../../middlewares/passport'
import ensureCompany from '../../middlewares/ensureCompany'

import auth from './auth'
import employee from './employee'
import company from './company'
import training from './training'
import category from './category'
import budget from './budget'
import feedback from './feedback'
import brownbag from './brownbag'
import invitation from './invitation'
import department from './department'

import services from '../../services'

const secret = fs.readFileSync(path.resolve(__dirname, '../../keys/private.pem'), 'utf8')

const router = Router()

router.use('/v1/auth', auth(services))

router.get('/v1/check/company', async (req, res) => {
  const domain = req.get('origin').match(/(https:\/\/)?(([^.]+)\.)(([^.]+)\.)?(sproud(\.dev|\.io))$/)[3]

  try {
    const company = await services.company.send({ type: 'findBy', query: { domain } })

    return res.status(company.code).json(company)
  } catch (e) {
    return res.status(e.code || 500).json(e instanceof Error ? errorToJson(e) : e)
  }
})

router.use((req, res, next) => passport.authenticate('jwt', { session: false }, (err, employee, info) => {
  if (info)
    return res.status(401).json(info)

  if (err)
    return res.status(err.code).json(err)

  if (!employee.data || !employee.data._id || !employee.data._id.length)
    return res.status(employee.code).json(employee)

  const payload = {
    _id: employee.data._id,
    expires: Date.now() + (60 * 1000 * 30)
  }

  return req.login(employee.data, async err => {
    if (err) {
      return res.status(401).json({
        i18n: 'UNAUTHORIZED', domain: 'api', code: 401, data: null, message: err.message, stack: err.stack
      })
    }

    const token = jwt.sign(JSON.stringify(payload), secret, { algorithm: 'RS256' })

    const domain = process.env.DOMAIN

    res.cookie('sproud.jwt', token, { httpOnly: true, secure: false, domain })

    return next()
  })
  // eslint-disable-next-line
}, (err, req, res) => res.status(err.code || 500).json(err instanceof Error ? errorToJson(err) : err))(req, res, next))

router.use(ensureCompany(services.company))

router.get('/v1/check/employee', async (req, res) => res.status(200).json({
  i18n: 'CURRENT_USER', error: null, domain: 'api', code: 200, data: req.user
}))

router.use('/v1/invite', invitation(services))

router.use('/v1/employee', employee(services))

router.use('/v1/company', company(services))

router.use('/v1/training', training(services))

router.use('/v1/feedback', feedback(services))

router.use('/v1/brownbag', brownbag(services))

router.use('/v1/department', department(services))
router.use('/v1/category', category(services))
router.use('/v1/budget', budget(services))

export default router
