import { Router } from 'express'
import errorToJson from 'error-to-json'
import ensureRoles from '../../middlewares/ensureRoles'

const departmentRouter = services => {
  const router = Router()

  router.get('/', async (req, res) => {
    try {
      const response = await services.department.send({
        type: 'findAllBy',
        query: {
          company: req.user.company._id || req.user.company
        },
        options: req.query
      })

      return res.status(response.code).json(response)
    } catch (e) {
      return res.status(e.code || 500).json(e instanceof Error ? errorToJson(e) : e)
    }
  })

  router.get('/:department', async (req, res) => {
    try {
      const response = await services.department.send({
        type: 'findBy',
        query: {
          company: req.user.company._id || req.user.company,
          _id: req.params.department
        }
      })

      return res.status(response.code).json(response)
    } catch (e) {
      return res.status(e.code || 500).json(e instanceof Error ? errorToJson(e) : e)
    }
  })

  router.post('/', ensureRoles(['admin', 'owner', 'hr']), async (req, res) => {
    try {
      if (!req.body.name || !req.body.name.length || typeof req.body.name !== 'string') {
        return res.status(400).json({
          i18n: 'MISSING_PARAM', error: 'name', domain: 'api', code: 400
        })
      }

      if (req.user.roles.indexOf('superadmin') !== -1 && req.body.company && (!req.body.company.length || typeof req.body.company !== 'string')) {
        return res.status(400).json({
          i18n: 'MISSING_PARAM', error: 'company', domain: 'api', code: 400
        })
      }

      if (req.user.roles.indexOf('superadmin') === -1)
        req.body.company = req.user.company._id || req.user.company

      req.body._id = undefined
      delete req.body._id

      const response = await services.department.send({
        type: 'createDepartment',
        query: req.body
      })

      return res.status(response.code).json(response)
    } catch (e) {
      return res.status(e.code || 500).json(e instanceof Error ? errorToJson(e) : e)
    }
  })

  router.put('/:department', ensureRoles(['admin', 'owner', 'hr']), async (req, res) => {
    req.body._id = req.params.department

    if (!req.body.name || !req.body.name.length || typeof req.body.name !== 'string') {
      return res.status(400).json({
        i18n: 'MISSING_PARAM', error: 'name', domain: 'api', code: 400
      })
    }

    if (req.user.roles.indexOf('superadmin') !== -1 && req.body.company && (!req.body.company.length || typeof req.body.company !== 'string')) {
      return res.status(400).json({
        i18n: 'MISSING_PARAM', error: 'company', domain: 'api', code: 400
      })
    }

    if (req.user.roles.indexOf('superadmin') === -1)
      req.body.company = req.user.company._id || req.user.company

    try {
      const response = await services.department.send({
        type: 'updateDepartment',
        query: req.body
      })

      return res.status(response.code).json(response)
    } catch (e) {
      return res.status(e.code || 500).json(e instanceof Error ? errorToJson(e) : e)
    }
  })

  router.delete('/:department', ensureRoles(['admin', 'owner', 'hr']), async (req, res) => {
    try {
      const response = await services.department.send({
        type: 'deleteDepartment',
        query: {
          _id: req.params.department,
          company: req.user.company._id || req.user.company
        }
      })

      return res.status(response.code).json(response)
    } catch (e) {
      return res.status(e.code || 500).json(e instanceof Error ? errorToJson(e) : e)
    }
  })

  return router
}

export default departmentRouter
