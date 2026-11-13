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

// La clave de Fedra sólo permite guardar sus guiones de R14 y de la grabación especial.
// No habilita organizar, eliminar, marcar estados ni editar otros clientes.
export const FEDRA_EDITABLE = ['r14-01', 'r14-02', 'esp-01', 'esp-02', 'esp-03'];
export function canEditScript(password, client, slug, env = process.env) {
  if (canEdit(password, env)) return true;
  if (client !== 'fedra-ald-t84qz' || !FEDRA_EDITABLE.includes(slug)) return false;
  const secret = env.FEDRA_R14_EDIT_PASSWORD;
  if (typeof password !== 'string' || !password || typeof secret !== 'string' || !secret) return false;
  const supplied = Buffer.from(password), expected = Buffer.from(secret);
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}
