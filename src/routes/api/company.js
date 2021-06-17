import { Router } from 'express'
import errorToJson from 'error-to-json'
import ensureRoles from '../../middlewares/ensureRoles'

const companyRouter = services => {
  const router = Router()

  router.get('/:company?/employees', async (req, res) => {
    const query = {}

    if (req.user.roles.indexOf('superadmin') !== -1 && req.params.company)
      query._id = req.params.company
    else
      query._id = req.user.company._id || req.user.company

    try {
      const company = await services.company.send({ type: 'findBy', query })

      const eQuery = { _id: company.data.employees, company: query._id }

      const response = await services.employee.send({ type: 'findAllBy', query: eQuery, options: req.query })

      return res.status(response.code).json(response)
    } catch (e) {
      return res.status(e.code || 500).json(e instanceof Error ? errorToJson(e) : e)
    }
  })

  router.get('/:company?/departments', async (req, res) => {
    const query = {}

    if (req.user.roles.indexOf('superadmin') !== -1 && req.params.company)
      query._id = req.params.company
    else
      query._id = req.user.company._id || req.user.company

    try {
      const company = await services.company.send({ type: 'findBy', query })

      const dQuery = { _id: { $in: company.data.employees }, company: query._id }

      const response = await services.employee.send({ type: 'findAllBy', query: dQuery, options: req.query })

      response.data = response.data.map(e => e.department).filter(d => d)

      return res.status(response.code).json(response)
    } catch (e) {
      return res.status(e.code || 500).json(e instanceof Error ? errorToJson(e) : e)
    }
  })

  router.get('/:company?', async (req, res) => {
    const query = {}

    if (req.user.roles.indexOf('superadmin') !== -1) {
      if (req.params.company && req.params.company.length)
        query._id = req.params.company

      try {
        const response = await services.company.send({ type: 'findAllBy', query, options: req.query })
        return res.status(response.code).json(response)
      } catch (e) {
        return res.status(e.code || 500).json(e instanceof Error ? errorToJson(e) : e)
      }
    }

    query._id = req.user.company._id || req.user.company

    try {
      const response = await services.company.send({ type: 'findBy', query })
      return res.status(response.code).json(response)
    } catch (e) {
      return res.status(e.code || 500).json(e instanceof Error ? errorToJson(e) : e)
    }
  })

  router.put('/:company?', ensureRoles(['owner', 'admin']), async (req, res) => {
    const query = {
      ...req.body
    }

    if (req.user.roles.indexOf('superadmin') !== -1 && req.params.company) {
      req.body.employees = undefined
      delete req.body.employees

      query._id = req.params.company
    } else {
      req.body.employees = undefined
      delete req.body.employees

      req.body.domain = undefined
      delete req.body.domain

      req.body.emailDomains = undefined
      delete req.body.emailDomains

      query._id = req.user.company._id || req.user.company
    }

    try {
      const response = await services.company.send({ type: 'updateCompany', query })
      return res.status(response.code).json(response)
    } catch (e) {
      return res.status(e.code || 500).json(e instanceof Error ? errorToJson(e) : e)
    }
  })

  router.delete('/:company?', ensureRoles(['owner']), async (req, res) => {
    let id = req.user.company._id || req.user.company
    const owner = req.user._id

    if (req.user.roles.indexOf('superadmin') !== -1 && req.params.company)
      id = req.params.company

    let employees
    let trainings
    let categories
    let budgets

    try {
      employees = await services.employee.send({
        type: 'findAllBy', query: { company: req.user.company._id || req.user.company, roles: { $nin: ['owner'] } }, useResolve: true, options: req.query
      })
      trainings = await services.training.send({
        type: 'findAllBy', query: { company: req.user.company._id || req.user.company }, useResolve: true, options: req.query
      })
      categories = await services.category.send({
        type: 'findAllBy', query: { company: req.user.company._id || req.user.company }, useResolve: true, options: req.query
      })
      budgets = await services.budget.send({
        type: 'findAllBy', query: { company: req.user.company._id || req.user.company }, useResolve: true, options: req.query
      })

      const deleteEverything = []

      if (employees.data && employees.data.length) {
        deleteEverything.push(...employees.data.map(
          employee => services.employee.send({ type: 'deleteEmployee', query: { _id: employee._id } })
        ))
      }

      if (trainings.data && trainings.data.length) {
        deleteEverything.push(...trainings.data.map(
          training => services.training.send({ type: 'deleteTraining', query: { _id: training._id } })
        ))
      }

      if (categories.data && categories.data.length) {
        deleteEverything.push(...categories.data.map(
          category => services.category.send({ type: 'deleteCategory', query: { _id: category._id } })
        ))
      }

      if (budgets.data && budgets.data.length) {
        deleteEverything.push(...budgets.data.map(
          budget => services.budget.send({ type: 'deleteBudget', query: { _id: budget._id } })
        ))
      }

      await Promise.all(deleteEverything)

      const response = await services.company.send({ type: 'deleteCompany', query: { owner, id } })
      await services.employee.send({ type: 'deleteCompanyOwner', query: { _id: owner, company: id } })

      if (req.user.roles.indexOf('superadmin') !== -1)
        req.logout()

      return res.status(response.code).json(response)
    } catch (e) {
      return res.status(e.code || 500).json(e instanceof Error ? errorToJson(e) : e)
    }
  })

  return router
}

export default companyRouter
