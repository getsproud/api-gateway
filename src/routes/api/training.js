import { Router } from 'express'
import ical from 'ical-generator'
import errorToJson from 'error-to-json'
import { Types } from 'mongoose'

const getFullTrainingInfo = async (training, services, req) => {
  if (!training)
    return training

  if (training.participants && training.participants.length) {
    const promises = training.participants.map(p => {
      const id = Types.ObjectId(p.participant)

      return new Promise(resolve => services.budget.send({
        type: 'findBy',
        query: {
          employee: Types.ObjectId(id),
          fromDate: { $lte: new Date(new Date().toISOString()) },
          toDate: { $gte: new Date(new Date().toISOString()) }
        }
      }, budget => {
        if (budget && budget.data) {
          return services.budget.send({
            type: 'getSpendings',
            query: {
              reference: training._id,
              _id: {
                $in: budget.data.spendings.map(b => Types.ObjectId(b))
              }
            }
          }, approved => resolve({
            approval: approved.approved ? 'approved' : 'pending',
            _id: id
          }))
        }

        return resolve({
          approval: 'pending',
          _id: id
        })
      }))
    })

    const approvals = await Promise.all(promises)

    const participants = await services.employee.send({
      type: 'findAllBy',
      query: {
        _id: {
          $in: training.participants.map(p => Types.ObjectId(p.participant))
        }
      },
      useResolve: true,
      options: req.query
    })

    const [mergedParticipants] = participants.data.docs.map(p => approvals.map(a => {
      p.approval = a.approval
      return p
    }))

    const [finalParticipants] = mergedParticipants
      .map(p => training.participants.map(t => {
        t.participant = p
        return t
      }))

    training.participants = finalParticipants

    const participantsWithDepartment = []
    await Promise.all(training.participants.map(async participant => {
      const { data: i } = await services.department.send({ type: 'findBy', query: { _id: participant.participant.department } })
      participant.participant.department = i
      participantsWithDepartment.push(participant)
    }))

    training.participants = participantsWithDepartment
  }

  if (training.departments && training.departments.length) {
    const departments = await services.department.send({
      type: 'findAllBy',
      query: { _id: { $in: training.departments.map(p => Types.ObjectId(p)) } },
      useResolve: true,
      options: req.query
    })

    training.departments = departments.data.docs
  }

  const author = await services.employee.send({
    type: 'findBy',
    query: { _id: training.author }
  })

  if (training.categories && training.categories.length) {
    const categories = await services.category.send({
      type: 'findAllBy',
      query: { _id: { $in: training.categories.map(c => Types.ObjectId(c)) } },
      useResolve: true,
      options: req.query
    })

    training.categories = categories.data.docs
  }

  const company = await services.company.send({
    type: 'findBy',
    query: { _id: training.company }
  })

  training.author = author.data
  training.company = company.data

  return training
}

const trainingRouter = services => {
  const router = Router()

  router.get('/', async (req, res) => {
    const query = {
      company: req.user.company._id || req.user.company,
      ...req.query.query
    }

    try {
      let trainings

      if (req.query.q) {
        trainings = await services.training.send({
          type: 'search', query: req.query.q, searchOptions: query, options: req.query
        })
      } else
        trainings = await services.training.send({ type: 'findAllBy', query, options: req.query })

      const fullTrainings = []
      await Promise.all(trainings.data.docs.map(async training => {
        const t = await getFullTrainingInfo(training, services, req)

        fullTrainings.push(t)
      }))

      trainings.data.docs = fullTrainings

      return res.status(trainings.code).json(trainings)
    } catch (e) {
      return res.status(e.code || 500).json(e instanceof Error ? errorToJson(e) : e)
    }
  })

  router.get('/:training/participants', async (req, res) => {
    const query = {
      _id: req.params.training
    }

    try {
      const training = await services.training.send({ type: 'findBy', query })

      const q = {
        _id: { $in: training.data.participants.map(p => Types.ObjectId(p.participant)) }
      }

      const participants = await services.employee.send({ type: 'findAllBy', query: q, options: req.query })

      if (participants.docs) {
        participants.docs = participants.docs.map(async p => {
          p.participant.department = await services.department.send({ type: 'findBy', query: { _id: p.department }, useResolve: true })
          p.participant.interests = await services.category.send({ type: 'findAllBy', query: { _id: { $in: p.interests } }, useResolve: true })
        })
      }

      return res.status(participants.code).json(participants)
    } catch (e) {
      return res.status(e.code || 500).json(e instanceof Error ? errorToJson(e) : e)
    }
  })

  router.get('/:training/calendar', async (req, res) => {
    try {
      const training = await services.training.send({
        type: 'findBy',
        query: { _id: req.params.training }
      })

      const appointment = ical({
        events: [{
          start: training.data.fromDate,
          end: training.data.toDate,
          allDay: !training.data.toDate,
          summary: training.data.title,
          description: `${training.data.description}\n\n${training.data.website}`,
          location: training.data.location,
          method: 'ADD',
          status: 'CONFIRMED'
        }],
        domain: 'sproud.io'
      })

      appointment.prodId({
        company: 'sproud',
        product: 'sproud.io'
      })

      return appointment.serve(res)
    } catch (e) {
      return res.status(e.code || 500).json(e instanceof Error ? errorToJson(e) : e)
    }
  })

  router.post('/departments', async (req, res) => {
    const query = {
      departments: { $in: req.body.departments.map(d => Types.ObjectId(d)) },
      company: req.user.company._id || req.user.company
    }

    try {
      const trainings = await services.training.send({ type: 'findAllBy', query, options: req.query })

      const fullTrainings = []
      await Promise.all(trainings.data.docs.map(async training => {
        const { data: t } = await getFullTrainingInfo(training, services, req)

        fullTrainings.push(t)
      }))

      trainings.data.docs = fullTrainings

      return res.status(trainings.code).json(trainings)
    } catch (e) {
      return res.status(e.code || 500).json(e instanceof Error ? errorToJson(e) : e)
    }
  })

  router.post('/categories', async (req, res) => {
    const query = {
      categories: { $in: req.body.categories.map(c => Types.ObjectId(c)) },
      company: req.user.company._id || req.user.company
    }

    try {
      const trainings = await services.training.send({ type: 'findAllBy', query, options: req.query })

      const fullTrainings = []
      await Promise.all(trainings.data.docs.map(async training => {
        const { data: t } = await getFullTrainingInfo(training, services, req)

        fullTrainings.push(t)
      }))

      trainings.data.docs = fullTrainings

      return res.status(trainings.code).json(trainings)
    } catch (e) {
      return res.status(e.code || 500).json(e instanceof Error ? errorToJson(e) : e)
    }
  })

  router.get('/employee/:employee?', async (req, res) => {
    const query = {
      participants: req.user._id
    }

    if (req.params.employee && req.params.employee.lenght)
      query.participants = req.params.employee

    try {
      const trainings = await services.training.send({ type: 'findAllBy', query, options: req.query })

      const fullTrainings = []
      await Promise.all(trainings.data.docs.map(async training => {
        const { data: t } = await getFullTrainingInfo(training, services, req)

        fullTrainings.push(t)
      }))

      trainings.data.docs = fullTrainings

      return res.status(trainings.code).json(trainings)
    } catch (e) {
      return res.status(e.code || 500).json(e instanceof Error ? errorToJson(e) : e)
    }
  })

  router.get('/recommendations', async (req, res) => {
    const query = {
      fromDate: { $gt: Date.now() },
      categories: { $in: req.user.interests.map(i => Types.ObjectId(i)) }
    }

    try {
      const trainings = await services.training.send({ type: 'getRecommended', query, options: req.query })

      const fullTrainings = []
      await Promise.all(trainings.data.docs.map(async training => {
        const { data: t } = await getFullTrainingInfo(training, services, req)

        fullTrainings.push(t)
      }))

      trainings.data.docs = fullTrainings

      return res.status(trainings.code).json(trainings)
    } catch (e) {
      return res.status(e.code || 500).json(e instanceof Error ? errorToJson(e) : e)
    }
  })

  router.get('/:training', async (req, res) => {
    try {
      const training = await services.training.send({
        type: 'findBy',
        query: { _id: req.params.training }
      })

      const { data: t } = await getFullTrainingInfo(training, services, req)

      training.data = t

      return res.status(training.code).json(training)
    } catch (e) {
      return res.status(e.code || 500).json(e instanceof Error ? errorToJson(e) : e)
    }
  })

  router.post('/', async (req, res) => {
    req.body.author = req.user._id
    req.body.company = req.user.company._id || req.user.company

    req.body.participants = undefined
    delete req.body.participants

    try {
      const training = await services.training.send({ type: 'createTraining', query: req.body })

      return res.status(training.code).json(training)
    } catch (e) {
      return res.status(e.code || 500).json(e instanceof Error ? errorToJson(e) : e)
    }
  })

  router.put('/:training/participate', async (req, res) => {
    const query = {
      _id: req.params.training
    }

    try {
      const training = await services.training.send({ type: 'findBy', query })

      let participant = req.user._id

      if ((req.user.roles.indexOf('superadmin') !== -1 || (['owner', 'admin', 'hr'].some(role => req.user.roles.includes(role)))) && req.body.employee)
        participant = req.body.employee._id || req.body.employee

      const participate = await services.training.send({
        type: 'participate',
        query: {
          training: training.data._id,
          employee: participant,
          remove: req.body.remove || false,
          ticket: req.body.ticket
        }
      })

      const budget = await services.budget.send({
        type: 'findBy',
        query: {
          employee: participant
        }
      })

      await services.budget.send({
        type: 'spendBudget',
        query: {
          budget: budget.data._id,
          reference: req.params.training,
          type: 'training',
          amount: req.body.ticket.price
        }
      })

      return res.status(participate.code).json(participate)
    } catch (e) {
      return res.status(e.code || 500).json(e instanceof Error ? errorToJson(e) : e)
    }
  })

  router.put('/:training', async (req, res) => {
    const query = {
      _id: req.params.training
    }

    try {
      const training = await services.training.send({ type: 'findBy', query })

      if (req.user.roles.indexOf('superadmin') === -1 || (training.data.author !== req.user._id || !(['owner', 'admin', 'hr'].some(role => req.user.roles.includes(role)))))
        return res.status(403).json({ message: 'INSUFFICIENT_PERMISSIONS', domain: 'api', code: 403 })

      req.body.author = undefined
      delete req.body.author

      req.body.company = undefined
      delete req.body.company

      req.body.departments = undefined
      delete req.body.departments

      req.body.categories = undefined
      delete req.body.categories

      req.body.participants = undefined
      delete req.body.participants

      req.body._id = req.params.training

      const update = await services.training.send({ type: 'updateTraining', query: req.body })

      return res.status(update.code).json(update)
    } catch (e) {
      return res.status(e.code || 500).json(e instanceof Error ? errorToJson(e) : e)
    }
  })

  router.delete('/:training', async (req, res) => {
    const query = {
      _id: req.params.training
    }

    try {
      const training = await services.training.send({ type: 'findBy', query })

      if (req.user.roles.indexOf('superadmin') === -1 || (training.data.author !== req.user._id || !(['owner', 'admin', 'hr'].some(role => req.user.roles.includes(role)))))
        return res.status(403).json({ message: 'INSUFFICIENT_PERMISSIONS', domain: 'api', code: 403 })

      await services.training.send({ type: 'deleteTraining', query: { _id: training.data._id } })

      return res.sendStatus(204)
    } catch (e) {
      return res.status(e.code || 500).json(e instanceof Error ? errorToJson(e) : e)
    }
  })

  return router
}

export default trainingRouter
