import { Router } from 'express'

const router = Router()

router.get('/:company/signup', (req, res) => res.redirect(`//${req.params.company}.${process.env.DOMAIN}/join/signup`))

router.get('/:company/invite/:token', (req, res) => res.redirect(`//${req.params.company}.${process.env.DOMAIN}/invite/${req.params.token}`))

export default router
