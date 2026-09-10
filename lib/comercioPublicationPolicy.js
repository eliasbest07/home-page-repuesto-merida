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
    && String(profile.cedula || '').trim().length > 0
  ))
}

export function findAuthorizedCommerceByPhone(commerces = [], rawPhone = '') {
  const target = canonicalPhone(rawPhone)
  if (target.length < 10) return null

  return (Array.isArray(commerces) ? commerces : []).find((commerce) => {
    if (!commerce || typeof commerce !== 'object' || Array.isArray(commerce)) return false
    return [
      commerce.whatsapp,
      commerce.whatsapp_normalizado,
      commerce.telefono_usuario,
      commerce.telefono_key,
    ].some((value) => canonicalPhone(value) === target)
  }) || null
}

export function evaluateCommercePublicationEligibility({
  phone,
  identityProfiles = [],
  authorizedCommerces = [],
} = {}) {
  const validWhatsapp = canonicalPhone(phone).length >= 10
  const hasCedula = validWhatsapp && hasStoredCedula(identityProfiles)
  const commerce = validWhatsapp
    ? findAuthorizedCommerceByPhone(authorizedCommerces, phone)
    : null

  return {
    allowed: Boolean(validWhatsapp && hasCedula && commerce),
    validWhatsapp,
    hasCedula,
    authorizedCommerce: Boolean(commerce),
    commerce,
  }
}
