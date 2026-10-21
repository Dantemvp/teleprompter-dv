import { timingSafeEqual } from 'node:crypto';

// Las claves permanecen en el servidor; ambas habilitan la edición del equipo.
export function canEdit(password, env = process.env) {
  if (typeof password !== 'string' || !password) return false;
  const supplied = Buffer.from(password);
  return [env.EDIT_PASSWORD, env.EDIT_PASSWORD_SECONDARY].some(secret => {
    if (typeof secret !== 'string' || !secret) return false;
    const expected = Buffer.from(secret);
    return supplied.length === expected.length && timingSafeEqual(supplied, expected);
  });
}
