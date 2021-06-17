const ensureCompany = service => async (req, res, next) => {
  if (!req.user || !req.user.company) {
    return res.status(401).json({
      i18n: 'UNAUTHORIZED', domain: 'api', error: 'no session', code: 401
    })
  }

  if (process.env.NODE_ENV === 'test' || req.user.roles.indexOf('superadmin') !== -1)
    return next()

  const domain = req.get('origin').match(/(https:\/\/)?(([^.]+)\.)?(([^.]+)\.)?(employee|sproud(hq\.dev|hq\.io|\.hq|\.dev))$/)[3]

  try {
    const company = await service.send({ type: 'findBy', query: { domain } })

    if (company.data._id === req.user.company._id || company.data._id === req.user.company) {
      req.company = company.data
      return next()
    }
  } catch (e) {
    return res.status(401).json({
      i18n: 'UNAUTHORIZED', domain: 'api', error: 'no session', code: 401
    })
  }

  req.logout()

  return res.status(401).json({
    i18n: 'UNAUTHORIZED', domain: 'api', error: 'no session', code: 401
  })
}

export default ensureCompany
