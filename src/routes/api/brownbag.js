import { Router } from 'express'
import ical from 'ical-generator'
import errorToJson from 'error-to-json'

const brownbagRoutes = services => {
  const router = Router()

  router.get('/', async (req, res) => {
    try {
      const response = await services.brownbag.send({
        type: 'findAllBy',
        query: {
          company: req.user.company._id || req.user.company
        },
        options: req.query
      })

      const speaker = await services.employee.send({ type: 'findBy', query: { _id: response.data.speaker } })
      response.data.speaker = speaker.data

      return res.status(response.code).json(response)
    } catch (e) {
      return res.status(e.code || 500).json(e instanceof Error ? errorToJson(e) : e)
    }
  })

  router.get('/speaker/:speaker', async (req, res) => {
    try {
      const response = await services.brownbag.send({
        type: 'findAllBy',
        query: {
          company: req.user.company._id || req.user.company,
          speaker: req.params.speaker
        },
        options: req.query
      })

      const speaker = await services.employee.send({ type: 'findBy', query: { _id: response.data.speaker } })
      response.data.forEach(bb => { bb.speaker = speaker.data })

      return res.status(response.code).json(response)
    } catch (e) {
      return res.status(e.code || 500).json(e instanceof Error ? errorToJson(e) : e)
    }
  })

  router.get('/:brownbag/participants', async (req, res) => {
    const query = {
      _id: req.params.brownbag
    }

    try {
      const brownbag = await services.brownbag.send({ type: 'findBy', query })

      const q = {
        _id: brownbag.participants
      }

      const participants = await services.employee.send({ type: 'findAllBy', query: q, options: req.query })

      return res.status(participants.code).json(participants)
    } catch (e) {
      return res.status(e.code || 500).json(e instanceof Error ? errorToJson(e) : e)
    }
  })

  router.get('/:brownbag/calendar', async (req, res) => {
    try {
      const brownbag = await services.brownbag.send({
        type: 'findBy',
        query: { _id: req.params.brownbag }
      })

      const appointment = ical({
        events: [{
          start: brownbag.data.fromDate,
          end: brownbag.data.toDate,
          summary: brownbag.data.title,
          description: brownbag.data.description,
          location: brownbag.data.location,
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

  router.get('/:brownbag', async (req, res) => {
    try {
      const response = await services.brownbag.send({
        type: 'findBy',
        query: {
          company: req.user.company._id || req.user.company,
          _id: req.params.brownbag
        }
      })

      const speaker = await services.employee.send({ type: 'findBy', query: { _id: response.data.speaker } })
      response.data.speaker = speaker.data

      return res.status(response.code).json(response)
    } catch (e) {
      return res.status(e.code || 500).json(e instanceof Error ? errorToJson(e) : e)
    }
  })

  router.post('/', async (req, res) => {
    if ((req.user.roles.indexOf('superadmin') === -1 && !(['owner', 'admin', 'hr'].some(role => req.user.roles.includes(role)))) && req.body.speaker) {
      req.body.speaker = req.user._id || req.user
      req.body.company = req.user.company._id || req.user.company
    }

    req.body.participants = undefined
    delete req.body.participants

    try {
      const brownbag = await services.brownbag.send({ type: 'createBrownbag', query: req.body })

      return res.status(brownbag.code).json(brownbag)
    } catch (e) {
      return res.status(e.code || 500).json(e instanceof Error ? errorToJson(e) : e)
    }
  })

  router.put('/:brownbag/participate', async (req, res) => {
    const query = {
      _id: req.params.brownbag
    }

    try {
      const brownbag = await services.brownbag.send({ type: 'findBy', query })

      let participant = req.user._id

      if ((req.user.roles.indexOf('superadmin') !== -1 || (['owner', 'admin', 'hr'].some(role => req.user.roles.includes(role)))) && req.body.employee)
        participant = req.body.employee._id || req.body.employee

      const participate = await services.brownbag.send({
        type: 'participate',
        query: {
          brownbag: brownbag.data._id,
          employee: participant,
          remove: req.body.remove || false
        }
      })

      return res.status(participate.code).json(participate)
    } catch (e) {
      return res.status(e.code || 500).json(e instanceof Error ? errorToJson(e) : e)
    }
  })

  router.put('/:brownbag', async (req, res) => {
    const query = {
      _id: req.params.brownbag
    }

    try {
      const brownbag = await services.brownbag.send({ type: 'findBy', query })

      if (req.user.roles.indexOf('superadmin') === -1 || (brownbag.data.speaker !== req.user._id || !(['owner', 'admin', 'hr'].some(role => req.user.roles.includes(role)))))
        return res.status(403).json({ message: 'INSUFFICIENT_PERMISSIONS', domain: 'api', code: 403 })

      req.body.speaker = undefined
      delete req.body.speaker

      req.body.company = undefined
      delete req.body.company

      req.body.participants = undefined
      delete req.body.participants

      req.body._id = req.params.brownbag

      const update = await services.brownbag.send({ type: 'updateBrownbag', query: req.body })

      return res.status(update.code).json(update)
    } catch (e) {
      return res.status(e.code || 500).json(e instanceof Error ? errorToJson(e) : e)
    }
  })

  router.delete('/:brownbag', async (req, res) => {
    const query = {
      _id: req.params.brownbag
    }

    try {
      const brownbag = await services.brownbag.send({ type: 'findBy', query })

      if (req.user.roles.indexOf('superadmin') === -1 || (brownbag.data.speaker !== req.user._id || !(['owner', 'admin', 'hr'].some(role => req.user.roles.includes(role)))))
        return res.status(403).json({ message: 'INSUFFICIENT_PERMISSIONS', domain: 'api', code: 403 })

      await services.brownbag.send({ type: 'deleteBrownbag', query: { _id: brownbag.data._id } })

      return res.sendStatus(204)
    } catch (e) {
      return res.status(e.code || 500).json(e instanceof Error ? errorToJson(e) : e)
    }
  })

  return router
}

export default brownbagRoutes
