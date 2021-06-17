import { Router } from 'express'
import errorToJson from 'error-to-json'

import ensureRoles from '../../middlewares/ensureRoles'

const budgetRouter = services => {
  const router = Router()

  router.get('/:employee?', async (req, res) => {
    const query = {
      employee: req.user._id || req.user,
      company: req.user.company._id || req.user.company
    }

    let type = 'findBy'

    if ((['superadmin', 'hr', 'admin', 'owner', 'finance'].some(role => req.user.roles.includes(role))) && req.params.employee)
      query.employee = req.params.employee

    if ((['superadmin', 'hr', 'admin', 'owner', 'finance'].some(role => req.user.roles.includes(role))) && (!req.params.employee || !req.params.employee.length)) {
      type = 'findAllBy'
      delete query.employee
    }

    if (req.user.roles.indexOf('superadmin') !== -1)
      delete query.company

    try {
      const response = await services.budget.send({ type, query, options: req.query })

      if (response.data && response.data.docs && response.data.docs.length) {
        response.data.docs = response.data.docs.map(async budget => {
          if (budget.spendings.length) {
            const spendings = await services.budget.send({
              type: 'getSpendings',
              query: { _id: { $in: budget.spendings } },
              options: { limit: 9999 }
            })

            budget.spendings = spendings.data.docs
          }

          return budget
        })

        response.data.docs = await Promise.all(response.data.docs)

        response.data.docs = response.data.docs.map(async budget => {
          const employee = await services.employee.send({
            type: 'findBy',
            query: { _id: budget.employee }
          })

          budget.employee = employee.data
          return budget
        })

        response.data.docs = await Promise.all(response.data.docs)
      }

      return res.status(response.code).json(response)
    } catch (e) {
      return res.status(e.code || 500).json(e instanceof Error ? errorToJson(e) : e)
    }
  })

  router.get('/:employee/:approval', async (req, res) => {
    const query = {
      employee: req.user._id || req.user,
      company: req.user.company._id || req.user.company,
      approved: false
    }

    let type = 'findBy'

    if (req.params.approval !== 'approved' && req.params.approval !== 'unapproved') {
      return res.status(404).json({
        i18n: 'NOT_FOUND', error: 'route', domain: 'api', code: 404
      })
    }

    if (req.params.approval === 'approved')
      query.approved = true

    if ((['superadmin', 'hr', 'admin', 'owner', 'finance'].some(role => req.user.roles.includes(role))) && req.params.employee)
      query.employee = req.params.employee

    if ((['superadmin', 'hr', 'admin', 'owner', 'finance'].some(role => req.user.roles.includes(role))) && (!req.params.employee || !req.params.employee.length)) {
      type = 'findAllBy'
      delete query.employee
    }

    if (['superadmin'].some(role => req.user.roles.includes(role)) && req.params.company)
      query.company = req.params.company

    if (req.user.roles.indexOf('superadmin') !== -1)
      delete query.company

    try {
      const response = await services.budget.send({ type, query, options: req.query })

      response.data.docs = response.data.docs.map(async budget => {
        const spendings = await services.budget.send({
          type: 'getSpendings',
          query: { ...query, _id: { $in: budget.spendings } },
          options: { limit: 9999 }
        })

        budget.spendings = spendings
        return budget
      })

      response.data.docs = await Promise.all(response.data.docs)

      return res.status(response.code).json(response)
    } catch (e) {
      return res.status(e.code || 500).json(e instanceof Error ? errorToJson(e) : e)
    }
  })

  router.get('/:budget', ensureRoles(['owner', 'hr', 'finance', 'admin']), async (req, res) => {
    try {
      const response = await services.budget.send({
        type: 'findBy',
        query: {
          company: req.user.company._id || req.user.company,
          _id: req.params.budget
        }
      })

      const spendings = await services.budget.send({ type: 'getSpendings', query: response.data.spendings })
      response.data.spendings = spendings

      return res.status(response.code).json(response)
    } catch (e) {
      return res.status(e.code || 500).json(e instanceof Error ? errorToJson(e) : e)
    }
  })

  router.put('/spending/:spending/:approval', ensureRoles(['owner', 'hr', 'finance', 'admin']), async (req, res) => {
    if (req.params.approval !== 'approved' && req.params.approval !== 'unapproved') {
      return res.status(404).json({
        i18n: 'NOT_FOUND', error: 'route', domain: 'api', code: 404
      })
    }

    const query = {
      _id: req.params.spending,
      approved: false,
      approvedBy: req.user._id || req.user
    }

    if (req.params.approval === 'approved')
      query.approved = true

    if (!query.approved)
      query.approvedBy = null

    try {
      const response = await services.budget.send({
        type: 'approveSpending',
        query
      })

      return res.status(response.code).json(response)
    } catch (e) {
      return res.status(e.code || 500).json(e instanceof Error ? errorToJson(e) : e)
    }
  })

  router.put('/:budget', ensureRoles(['owner', 'hr', 'finance', 'admin']), async (req, res) => {
    try {
      const response = await services.budget.send({
        type: 'updateBudget',
        query: {
          ...req.body,
          _id: req.params.budget
        }
      })

      return res.status(response.code).json(response)
    } catch (e) {
      return res.status(e.code || 500).json(e instanceof Error ? errorToJson(e) : e)
    }
  })

  router.delete('/:budget', ensureRoles(['owner', 'hr', 'finance', 'admin']), async (req, res) => {
    try {
      const response = await services.budget.send({
        type: 'deleteBudget',
        query: {
          _id: req.params.budget
        }
      })

      return res.status(response.code).json(response)
    } catch (e) {
      return res.status(e.code || 500).json(e instanceof Error ? errorToJson(e) : e)
    }
  })

  router.post('/', ensureRoles(['owner', 'hr', 'finance', 'admin']), async (req, res) => {
    try {
      const response = await services.budget.send({
        type: 'createBudget',
        query: req.body
      })

      return res.status(response.code).json(response)
    } catch (e) {
      return res.status(e.code || 500).json(e instanceof Error ? errorToJson(e) : e)
    }
  })

  return router
}

export default budgetRouter
