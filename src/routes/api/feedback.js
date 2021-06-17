import { Router } from 'express'
import errorToJson from 'error-to-json'

const feedbackRouter = services => {
  const router = Router()

  router.get('/:feedback', async (req, res) => {
    const query = {
      _id: req.params.feedback
    }

    try {
      const feedback = await services.feedback.send({ type: 'findBy', query })
      const author = await services.employee.send({ type: 'findBy', query: { _id: feedback.data.author } })
      const training = await services.training.send({ type: 'findBy', query: { _id: feedback.data.training } })

      feedback.data.author = author.data
      feedback.data.training = training.data

      return res.status(feedback.code).json(feedback)
    } catch (e) {
      return res.status(e.code || 500).json(e instanceof Error ? errorToJson(e) : e)
    }
  })

  router.get('/:field/:id', async (req, res) => {
    if (['author', 'training'].indexOf(req.params.field) === -1)
      return res.status(400).json({ i18n: 'FEEDBACK_FIELD_NOT_ALLOWED', domain: 'feedback', code: 400 })

    const query = {
      [req.params.field]: req.params.id
    }

    try {
      const feedbacks = await services.feedback.send({ type: 'findAllBy', query, options: req.query })

      feedbacks.data.docs = feedbacks.data.docs.map(async feedback => {
        const author = await services.employee.send({ type: 'findBy', query: { _id: feedback.author } })
        feedback.author = author.data
        return feedback
      })

      feedbacks.data.docs = await Promise.all(feedbacks.data.docs)

      return res.status(feedbacks.code).json(feedbacks)
    } catch (e) {
      return res.status(e.code || 500).json(e instanceof Error ? errorToJson(e) : e)
    }
  })

  router.post('/', async (req, res) => {
    req.body._id = undefined
    delete req.body._id

    req.body.author = req.user._id

    try {
      const feedback = await services.feedback.send({ type: 'createFeedback', query: req.body })

      return res.status(feedback.code).json(feedback)
    } catch (e) {
      return res.status(e.code || 500).json(e instanceof Error ? errorToJson(e) : e)
    }
  })

  router.put('/:feedback', async (req, res) => {
    const query = {
      _id: req.params.feedback,
      author: req.user._id || req.user
    }

    const feedback = await services.feedback.send({ type: 'findBy', query, useResolve: true })

    if (feedback.code !== 200 && !(['superadmin', 'hr', 'admin', 'owner', 'finance'].some(role => req.user.roles.includes(role))))
      return res.status(403).json({ i18n: 'INSUFFICIENT_PERMISSIONS', domain: 'feedback', code: 403 })

    req.body._id = req.params.feedback

    try {
      const feedback = await services.feedback.send({ type: 'updateFeedback', query: req.body })

      return res.status(feedback.code).json(feedback)
    } catch (e) {
      return res.status(e.code || 500).json(e instanceof Error ? errorToJson(e) : e)
    }
  })

  router.delete('/:feedback', async (req, res) => {
    const query = {
      _id: req.params.feedback,
      author: req.user._id || req.user
    }

    const feedback = await services.feedback.send({ type: 'findBy', query, useResolve: true })

    if (feedback.code !== 200 && !(['superadmin', 'hr', 'admin', 'owner', 'finance'].some(role => req.user.roles.includes(role))))
      return res.status(403).json({ i18n: 'INSUFFICIENT_PERMISSIONS', domain: 'feedback', code: 403 })

    try {
      const feedback = await services.feedback.send({ type: 'deleteFeedback', query: { _id: req.params.feedback } })

      return res.status(feedback.code).json(feedback)
    } catch (e) {
      return res.status(e.code || 500).json(e instanceof Error ? errorToJson(e) : e)
    }
  })

  return router
}

export default feedbackRouter
