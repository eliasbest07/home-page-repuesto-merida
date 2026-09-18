function canonicalPhone(value) {
  let phone = String(value || '').replace(/\D/g, '')
  if (phone.startsWith('58') && phone.length >= 12) phone = phone.slice(2)
  return phone.replace(/^0+/, '')
}

export function hasStoredCedula(profiles = []) {
  const candidates = Array.isArray(profiles) ? profiles : [profiles]
  return candidates.some((profile) => (
    profile
    && typeof profile === 'object'
    && !Array.isArray(profile)
    && String(profile.cedula || '').replace(/\D/g, '').length >= 6
    && String(profile.cedula || '').replace(/\D/g, '').length <= 10
    && String(profile.cedula_estado || '').trim().toLowerCase() === 'aprobado'
  ))
}

export function isRealtimeAccountUid(uid = '') {
  const key = String(uid || '').trim()
  return Boolean(key) && !/^\+?\d+$/.test(key) && !/^(?:com_|phone_)/.test(key)
}

export function findAuthorizedCommerce(commerces = [], { phone = '', commerceId = '' } = {}) {
  const target = canonicalPhone(phone)
  const targetId = String(commerceId || '').trim()

  return (Array.isArray(commerces) ? commerces : []).find((commerce) => {
    if (!commerce || typeof commerce !== 'object' || Array.isArray(commerce)) return false
    if (commerce.autorizado !== true) return false
    if (targetId && String(commerce.comercio_id || commerce.id || '').trim() === targetId) return true
    if (target.length < 10) return false
    return [
      commerce.whatsapp,
      commerce.whatsapp_normalizado,
      commerce.telefono_usuario,
      commerce.telefono_key,
    ].some((value) => canonicalPhone(value) === target)
  }) || null
}

export function findAuthorizedCommerceByPhone(commerces = [], rawPhone = '') {
  return findAuthorizedCommerce(commerces, { phone: rawPhone })
}

export function evaluateCommercePublicationEligibility({
  phone,
  commerceId = '',
  identityProfiles = [],
  authorizedCommerces = [],
  profile = {},
  commerce = {},
  ownerUid = '',
} = {}) {
  const validWhatsapp = canonicalPhone(phone).length >= 10
  const hasCedula = validWhatsapp && hasStoredCedula(identityProfiles)
  const authorizedCommerce = validWhatsapp
    ? findAuthorizedCommerce(authorizedCommerces, { phone, commerceId })
    : null
  const commerceAuthorized = commerce?.autorizado === true
  const canSell = profile?.vender === true
  const validName = Boolean(String(commerce?.nombre_comercio || profile?.nombre_comercio || profile?.nombre || '').trim())
  const linkedAppAccount = isRealtimeAccountUid(ownerUid)

  return {
    allowed: Boolean(
      validWhatsapp
      && hasCedula
      && authorizedCommerce
      && commerceAuthorized
      && canSell
      && validName
      && linkedAppAccount
    ),
    validWhatsapp,
    hasCedula,
    authorizedCommerce: Boolean(authorizedCommerce),
    commerceAuthorized,
    canSell,
    validName,
    linkedAppAccount,
    commerce: authorizedCommerce,
  }
}
