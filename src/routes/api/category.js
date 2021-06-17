import { Router } from 'express'
import errorToJson from 'error-to-json'
import ensureRoles from '../../middlewares/ensureRoles'

const categoryRouter = services => {
  const router = Router()

  router.get('/', async (req, res) => {
    try {
      const response = await services.category.send({
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

  router.get('/:category', async (req, res) => {
    try {
      const response = await services.category.send({
        type: 'findBy',
        query: {
          company: req.user.company._id || req.user.company,
          _id: req.params.category
        }
      })

      return res.status(response.code).json(response)
    } catch (e) {
      return res.status(e.code || 500).json(e instanceof Error ? errorToJson(e) : e)
    }
  })

  router.post('/', async (req, res) => {
    try {
      if (!req.body.label || !req.body.label.length || typeof req.body.label !== 'string') {
        return res.status(400).json({
          i18n: 'MISSING_PARAM', error: 'label', domain: 'api', code: 400
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

      const response = await services.category.send({
        type: 'createCategory',
        query: req.body
      })

      return res.status(response.code).json(response)
    } catch (e) {
      return res.status(e.code || 500).json(e instanceof Error ? errorToJson(e) : e)
    }
  })

  router.put('/:category', async (req, res) => {
    req.body._id = req.params.category

    if (!req.body.label || !req.body.label.length || typeof req.body.label !== 'string') {
      return res.status(400).json({
        i18n: 'MISSING_PARAM', error: 'label', domain: 'api', code: 400
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
      const response = await services.category.send({
        type: 'updateCategory',
        query: req.body
      })

      return res.status(response.code).json(response)
    } catch (e) {
      return res.status(e.code || 500).json(e instanceof Error ? errorToJson(e) : e)
    }
  })

  router.delete('/:category', ensureRoles(['admin', 'owner', 'hr']), async (req, res) => {
    try {
      const response = await services.category.send({
        type: 'deleteCategory',
        query: {
          _id: req.params.category,
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

export default categoryRouter
