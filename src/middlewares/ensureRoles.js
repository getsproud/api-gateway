const ensureRoles = roles => (req, res, next) => {
  if (!req.user || !req.user.roles || !req.user.roles.length) {
    return res.status(401).json({
      i18n: 'UNAUTHORIZED', domain: 'api', error: 'no session', code: 401
    })
  }

  if (req.user.roles.indexOf('superadmin') !== -1)
    return next()

  if (((req.user.roles.indexOf('owner') !== -1 || req.user.roles.indexOf('admin') !== -1)) && roles.indexOf('superadmin') === -1)
    return next()

  const compare = (roles, userRoles) => roles.some(role => userRoles.includes(role))

  if (compare(roles, req.user.roles)) {
    return res.status(403).json({
      i18n: 'INSUFFICIENT_PERMISSIONS', domain: 'api', error: 'permissions required', code: 403
    })
  }

  return next()
}

export const ensureRolesStrict = roles => (req, res, next) => {
  if (!req.user || !req.user.roles || !req.user.roles.length) {
    return res.status(401).json({
      i18n: 'UNAUTHORIZED', domain: 'api', error: 'no session', code: 401
    })
  }

  if (req.user.roles.indexOf('superadmin') !== -1)
    return next()

  if (((req.user.roles.indexOf('owner') !== -1 || req.user.roles.indexOf('admin') !== -1)) && roles.indexOf('superadmin') === -1)
    return next()

  const compare = (roles, userRoles) => roles.every(role => userRoles.includes(role))

  if (compare(roles, req.user.roles)) {
    return res.status(403).json({
      i18n: 'INSUFFICIENT_PERMISSIONS', domain: 'api', error: 'permissions required', code: 403
    })
  }

  return next()
}

export default ensureRoles
