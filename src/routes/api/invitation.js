import { Router } from 'express'
import fs from 'fs'
import path from 'path'
import errorToJson from 'error-to-json'
import ensureRoles from '../../middlewares/ensureRoles'

const invitationRoutes = services => {
  const router = Router()

  router.post('/send', ensureRoles(['hr', 'admin', 'owner']), async (req, res) => {
    const baseUrl = `http://join.${process.env.DOMAIN}`
    const employeeHqPicto = fs.readFileSync(path.resolve(__dirname, '../../assets/sproud_picto.png'))
    const icon = req.company && req.company.logo ? Buffer.from(req.company.logo).toString('base64') : employeeHqPicto.toString('base64')

    try {
      const invite = await services.auth.send({
        type: 'generateInvitationToken',
        query: {
          identifier: req.body.to,
          company: req.user.company
        }
      })

      await services.mail.send({
        type: 'sendInvitationMail',
        query: {
          to: req.body.to,
          sender: req.user.firstname,
          sender_mail: req.user.identifier,
          link: `${baseUrl}/${req.company && req.company.name ? req.company.name : 'test'}/invite/${invite.data.token}`,
          icon
        }
      })

      return res.sendStatus(204)
    } catch (e) {
      return res.status(e.code || 500).json(e instanceof Error ? errorToJson(e) : e)
    }
  })

  return router
}

export default invitationRoutes
