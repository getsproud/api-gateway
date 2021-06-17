import { Router } from 'express'
import errorToJson from 'error-to-json'
import ensureRoles from '../../middlewares/ensureRoles'

const employeeRouter = services => {
  const router = Router()

  router.get('/', async (req, res) => {
    const query = {}

    query.company = req.user.company._id || req.user.company

    if (req.user.roles.indexOf('superadmin') !== -1)
      delete query.company

    try {
      const response = await services.employee.send({ type: 'findAllBy', query, options: req.query })
      return res.status(response.code).json(response)
    } catch (e) {
      return res.status(e.code || 500).json(e instanceof Error ? errorToJson(e) : e)
    }
  })

  router.get('/:employee', async (req, res) => {
    if (!req.params.employee || !req.params.employee.length || typeof req.params.employee !== 'string') {
      return res.status(400).json({
        i18n: 'MISSING_PARAM', error: 'employee', domain: 'api', code: 400
      })
    }

    const query = { company: req.user.company, _id: req.params.employee }

    if (req.user.roles.indexOf('superadmin') !== -1)
      delete query.company

    try {
      const response = await services.employee.send({ type: 'findBy', query })
      return res.status(response.code).json(response)
    } catch (e) {
      return res.status(e.code || 500).json(e instanceof Error ? errorToJson(e) : e)
    }
  })

  router.put('/:employee?', async (req, res) => {
    if (!req.params.employee || !req.params.employee.length || typeof req.params.employee !== 'string') {
      return res.status(400).json({
        i18n: 'MISSING_PARAM', error: 'employee', domain: 'api', code: 400
      })
    }

    if (req.user.roles.indexOf('superadmin') === -1 && (req.params.employee !== req.user._id && !(['owner', 'admin', 'hr'].some(role => req.user.roles.includes(role))))) {
      return res.status(403).json({
        i18n: 'INSUFFICIENT_PERMISSIONS', domain: 'api', code: 403
      })
    }

    if (!Object.keys(req.body).length) {
      return res.status(400).json({
        i18n: 'MISSING_PARAM', error: 'body', domain: 'api', code: 400
      })
    }

    req.body.password = undefined
    delete req.body.password

    req.body._id = req.user._id || req.user

    if (req.user.roles.indexOf('superadmin') !== -1 || (['owner', 'admin', 'hr'].some(role => req.user.roles.includes(role))))
      req.body._id = req.params.employee

    if (req.user.roles.indexOf('superadmin') === -1) {
      req.body.company = undefined
      delete req.body.company
      req.body.internalEmail = undefined
      delete req.body.internalEmail
    }

    const query = req.body

    try {
      const response = await services.employee.send({ type: 'updateEmployee', query })
      return res.status(response.code).json(response)
    } catch (e) {
      return res.status(e.code || 500).json(e instanceof Error ? errorToJson(e) : e)
    }
  })

  router.put('/:employee/password', async (req, res) => {
    if (!req.params.employee || !req.params.employee.length || typeof req.params.employee !== 'string') {
      return res.status(400).json({
        i18n: 'MISSING_PARAM', error: 'employee', domain: 'api', code: 400
      })
    }

    if (req.user.roles.indexOf('superadmin') === -1 && (req.params.employee !== req.user._id || !(['owner', 'admin', 'hr'].some(role => req.user.roles.includes(role))))) {
      return res.status(403).json({
        i18n: 'INSUFFICIENT_PERMISSIONS', domain: 'api', code: 403
      })
    }

    if (!req.body.newPassword || !req.body.newPassword.length) {
      return res.status(400).json({
        i18n: 'MISSING_PARAM', error: 'newPassword', domain: 'api', code: 400
      })
    }

    const query = {
      _id: req.params.employee,
      password: req.body.newPassword
    }

    try {
      if (req.params.employee === req.user._id) {
        if (!req.body.currentPassword || !req.body.currentPassword.length) {
          return res.status(400).json({
            i18n: 'MISSING_PARAM', error: 'currentPassword', domain: 'api', code: 400
          })
        }

        const permission = await services.auth.send({ type: 'authenticate', query: { identifier: req.user.identifier, password: req.body.currentPassword } })

        if (!permission.data || !permission.data._id || !permission.data._id.length)
          return res.status(permission.code).json(permission)
      }

      const response = await services.employee.send({ type: 'updateEmployee', query })
      return res.status(response.code).json(response)
    } catch (e) {
      return res.status(e.code || 500).json(e instanceof Error ? errorToJson(e) : e)
    }
  })

  router.delete('/:employee', ensureRoles(['hr', 'admin', 'owner']), async (req, res) => {
    if (!req.params.employee || !req.params.employee.length || typeof req.params.employee !== 'string') {
      return res.status(400).json({
        i18n: 'MISSING_PARAM', error: 'employee', domain: 'api', code: 400
      })
    }

    const query = { _id: req.params.employee }

    try {
      const employee = await services.employee.send({ type: 'findBy', query })

      if (req.user.roles.indexOf('superadmin') === -1 && employee.data.company !== req.user.company)
        return res.status(404).json({ i18n: 'EMPLOYEE_NOT_FOUND', domain: 'api', code: 404 })

      if (req.user.roles.indexOf('superadmin') === -1)
        query.company = req.user.company._id || req.user.company

      if (req.user._id === req.params.employee)
        req.logout()

      await services.employee.send({ type: 'deleteEmployee', query })

      return res.sendStatus(204)
    } catch (e) {
      return res.status(e.code || 500).json(e instanceof Error ? errorToJson(e) : e)
    }
  })

  return router
}

export default employeeRouter
