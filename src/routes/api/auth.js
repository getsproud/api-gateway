import { Router } from 'express'
import validate from 'deep-email-validator'
import jwt from 'jsonwebtoken'
import fs from 'fs'
import path from 'path'
import errorToJson from 'error-to-json'
import passport from '../../middlewares/passport'

const secret = fs.readFileSync(path.resolve(__dirname, '../../keys/private.pem'), 'utf8')

const authRoutes = services => {
  const router = Router()

  router.post('/', (req, res, next) => passport.authenticate('local', { failWithError: true, session: false }, (err, employee, info) => {
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

      try {
        const token = jwt.sign(JSON.stringify(payload), secret, { algorithm: 'RS256' })
        const domain = req.get('origin').match(/(https:\/\/)?(([^.]+)\.)(([^.]+)\.)?(sproud(\.dev|\.io))$/)[6]

        res.cookie('sproud.jwt', token, { secure: true, domain: `${domain}` })

        const query = { _id: employee.data.company }

        const company = await services.company.send({ type: 'findBy', query })
        employee.data.company = company.data

        return res.status(employee.code).json(employee)
      } catch (e) {
        return res.status(e.code || 500).json(e instanceof Error ? errorToJson(e) : e)
      }
    })
  }, (err, req, res) => res.status(err.code).json(err))(req, res, next))

  router.post('/register', async (req, res) => {
    const c = req.body.company
    const e = req.body.employee

    if (!c) {
      return res.status(400).json({
        i18n: 'MISSING_PARAM', error: 'company', domain: 'api', code: 400
      })
    }

    if (!e) {
      return res.status(400).json({
        i18n: 'MISSING_PARAM', error: 'employee', domain: 'api', code: 400
      })
    }

    const reservedDomains = [
      'join',
      'admin',
      'signin',
      'signup',
      'intern',
      'mail',
      'test',
      'stage',
      'sproud',
      'employee',
      'subscribe',
      'tracking',
      'track',
      'blog',
      'app',
      'help',
      'static',
      'stats',
      'cdn'
    ]

    if (reservedDomains.indexOf(c.domain) !== -1) {
      return res.status(400).json({
        i18n: 'DOMAINS_ALREADY_TAKEN', error: 'company.domain', domain: 'api', code: 400
      })
    }

    try {
      const emailValid = await validate(e.identifier)

      if (!emailValid.valid && process.env.NODE_ENV === 'production') {
        return res.status(400).json({
          message: 'INVALID_EMAIL', domain: 'api', error: emailValid.validators, code: 400
        })
      }

      const emailDomain = e.identifier.replace(/[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@((?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)/i, '$1')

      c.emailDomains = [emailDomain]

      const company = await services.company.send({ type: 'createCompany', query: c })

      const query = {
        ...e,
        roles: ['owner', 'admin'],
        company: company.data._id
      }

      const employee = await services.employee.send({ type: 'createEmployee', query })

      const token = await services.auth.send({ type: 'generateActivationToken', query: { id: employee.data._id } })

      company.data.employees = [employee.data._id]

      await services.company.send({ type: 'updateCompany', query: company.data })

      const predefinedDepartments = [
        { name: 'FINANCE', company: company.data._id },
        { name: 'HUMAN_RESOURCES', company: company.data._id },
        { name: 'MANAGEMENT', company: company.data._id },
        { name: 'DEVELOPMENT', company: company.data._id },
        { name: 'MARKETING', company: company.data._id },
        { name: 'SALES', company: company.data._id },
        { name: 'CUSTOMER_SUPPORT', company: company.data._id },
        { name: 'IT', company: company.data._id }
      ]

      await services.department.send({ type: 'createDepartment', query: predefinedDepartments })
      await services.mail.send({
        type: 'sendActivationMail',
        query: {
          to: e.identifier,
          code: token.data.code
        }
      })

      if (process.env.NODE_ENV !== 'production')
        return res.status(token.code).json(token)

      return res.sendStatus(204)
    } catch (e) {
      return res.status(e.code || 500).json(e instanceof Error ? errorToJson(e) : e)
    }
  })

  router.post('/register/invite/:token', async (req, res) => {
    if (!req.params.token || typeof req.params.token !== 'string')
      return res.status(400).json({ message: 'MISSING_PARAM', error: 'token', domain: 'api' })

    const domain = req.get('origin').match(/(https:\/\/)?(([^.]+)\.)(([^.]+)\.)?(sproud(\.dev|\.io))$/)[3]

    try {
      const company = await services.company.send({ type: 'findBy', query: { domain } })

      const invite = await services.auth.send({ type: 'validateInvitation', query: { token: req.params.token, company: company.data._id } })

      const data = req.body

      data.activated = true
      data.company = invite.data.company
      data.roles = ['employee']
      data.identifier = invite.data.identifier

      const employee = await services.employee.send({ type: 'createEmployee', query: req.body })

      company.data.employees.push(employee.data._id)

      await services.company.send({ type: 'updateCompany', query: company.data })

      return res.sendStatus(204)
    } catch (e) {
      return res.status(e.code || 500).json(e instanceof Error ? errorToJson(e) : e)
    }
  })

  router.post('/register/:company', async (req, res) => {
    if (!req.params.company || typeof req.params.company !== 'string') {
      return res.status(400).json({
        i18n: 'MISSING_PARAM', error: 'company', domain: 'api', code: 400
      })
    }

    const create = {
      ...req.body,
      roles: ['employee'],
      company: req.params.company
    }

    const query = { _id: req.params.company }
    try {
      const company = await services.company.send({ type: 'findBy', query })

      const emailDomain = req.body.identifier.replace(/[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@((?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)/i, '$1')

      if (company.data.emailDomains.indexOf(emailDomain) === -1) {
        return res.status(403).json({
          i18n: 'INVALID_COMPANY_EMAIL', error: 'domain not in list', domain: 'api', code: 403
        })
      }

      const employee = await services.employee.send({ type: 'createEmployee', query: create })

      const token = await services.auth.send({ type: 'generateActivationToken', query: { id: employee.data._id } })

      company.data.employees.push(employee.data._id)

      await services.company.send({ type: 'updateCompany', query: company.data })

      if (process.env.NODE_ENV !== 'production')
        return res.status(token.code).json(token)

      return res.sendStatus(204)
    } catch (e) {
      return res.status(e.code || 500).json(e instanceof Error ? errorToJson(e) : e)
    }
  })

  router.get('/logout', (req, res) => {
    req.logout()

    const domain = req.get('origin').match(/(https:\/\/)?(([^.]+)\.)(([^.]+)\.)?(sproud(\.dev|\.io))$/)[6]

    res.cookie('sproud.jwt', {}, {
      secure: true, domain: `${domain}`, maxAge: -1
    })
    return res.sendStatus(204)
  })

  router.post('/activate/:token', async (req, res) => {
    if (!req.params.token || typeof req.params.token !== 'string') {
      return res.status(400).json({
        i18n: 'MISSING_PARAM', error: 'token', domain: 'api', code: 400
      })
    }
    if (!req.body.code || typeof req.body.code !== 'number') {
      return res.status(400).json({
        i18n: 'MISSING_PARAM', error: 'code', domain: 'api', code: 400
      })
    }
    const { code } = req.body
    const { token } = req.params

    try {
      const activated = await services.auth.send({ type: 'validateActivation', query: { token, code } })

      if (!activated.data)
        return res.status(activated.code).json(activated)

      return res.sendStatus(204)
    } catch (e) {
      return res.status(e.code || 500).json(e instanceof Error ? errorToJson(e) : e)
    }
  })

  return router
}

export default authRoutes
